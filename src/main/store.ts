import { app } from 'electron'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CONFIG_VERSION,
  DEFAULT_CONFIG,
  MAX_TIMER_MS,
  MAX_WALLPAPER_DIM,
  MAX_ZOOM,
  MIN_TIMER_MS,
  MIN_WALLPAPER_DIM,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  MIN_ZOOM,
  type AppConfig,
  type AppLocation,
  type BackgroundChoice,
  type ClockMode,
  type CustomPalette,
  type FontChoice,
  type PaletteChoice,
  type Wallpaper,
  type HourCyclePreference,
  type TemperatureUnit,
  type ThemePreference,
  type WindowBounds
} from '@shared/types'

const PERSIST_DEBOUNCE_MS = 400

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

const HEX_COLOUR = /^#[0-9a-f]{6}$/i

/** A bare file name inside the app's own wallpaper directory -- never a path. */
const WALLPAPER_FILE = /^current\.[a-z0-9]{1,8}$/i

function normalizeWallpaper(raw: unknown): Wallpaper | null {
  if (!isRecord(raw)) return null
  if (typeof raw.file !== 'string' || !WALLPAPER_FILE.test(raw.file)) return null
  const updatedAt = typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
    ? raw.updatedAt
    : 0
  return { file: raw.file, updatedAt }
}

/**
 * Faces that existed before the clock went monospace-only. Fraunces had no
 * tabular figures and shifted the time sideways on every tick; the others
 * were fine but went with it. Each maps to its nearest surviving relative so
 * an upgrade changes the typeface rather than silently resetting it.
 */
const RETIRED_FONTS: Record<string, FontChoice> = {
  mono: 'jetbrains',
  inter: 'geist',
  grotesk: 'martian',
  fraunces: 'martian'
}

/**
 * Rewrites values whose meaning changed between schema versions. Anything
 * merely added since is handled by the field-level defaults below, so only
 * genuine renames need to appear here.
 */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  const version = typeof raw.version === 'number' ? raw.version : 1
  if (version >= CONFIG_VERSION) return raw

  const next = { ...raw }
  const retired = typeof raw.fontFamily === 'string' ? RETIRED_FONTS[raw.fontFamily] : undefined
  if (retired) next.fontFamily = retired

  return next
}

function normalizeCustomPalette(raw: unknown): CustomPalette {
  const fallback = DEFAULT_CONFIG.customPalette
  if (!isRecord(raw)) return { ...fallback }

  const pick = (value: unknown, alternative: string): string =>
    typeof value === 'string' && HEX_COLOUR.test(value) ? value.toLowerCase() : alternative

  return {
    accent: pick(raw.accent, fallback.accent),
    accentAlt: pick(raw.accentAlt, fallback.accentAlt)
  }
}

/** A zone string is only accepted if the platform's ICU actually knows it. */
function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

function normalizeLocation(raw: unknown): AppLocation {
  if (!isRecord(raw)) return DEFAULT_CONFIG.location

  const latitude = finite(raw.latitude, NaN)
  const longitude = finite(raw.longitude, NaN)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return DEFAULT_CONFIG.location
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return DEFAULT_CONFIG.location

  const timezone = str(raw.timezone, DEFAULT_CONFIG.location.timezone)

  return {
    name: str(raw.name, 'Unknown'),
    admin1: typeof raw.admin1 === 'string' && raw.admin1.length > 0 ? raw.admin1 : null,
    country: str(raw.country, ''),
    latitude,
    longitude,
    timezone: isValidTimeZone(timezone) ? timezone : DEFAULT_CONFIG.location.timezone
  }
}

/*
 * The window's minimum size scales with the zoom -- at 75% the layout needs
 * three quarters of the room -- so the floor a remembered size is held to is
 * the smallest one any zoom can ask for. The window's own minimum, set in
 * main, takes it from there.
 */
const FLOOR_WIDTH = Math.round(MIN_WINDOW_WIDTH * MIN_ZOOM)
const FLOOR_HEIGHT = Math.round(MIN_WINDOW_HEIGHT * MIN_ZOOM)

function normalizeBounds(raw: unknown): WindowBounds {
  if (!isRecord(raw)) return { ...DEFAULT_CONFIG.windowBounds }
  return {
    x: typeof raw.x === 'number' && Number.isFinite(raw.x) ? Math.round(raw.x) : null,
    y: typeof raw.y === 'number' && Number.isFinite(raw.y) ? Math.round(raw.y) : null,
    width: Math.max(FLOOR_WIDTH, Math.round(finite(raw.width, DEFAULT_CONFIG.windowBounds.width))),
    height: Math.max(FLOOR_HEIGHT, Math.round(finite(raw.height, DEFAULT_CONFIG.windowBounds.height)))
  }
}

/**
 * Every field is validated independently, so one bad value costs only that
 * value -- a config with a garbled theme keeps the user's saved city.
 */
function normalizeConfig(input: unknown): AppConfig {
  if (!isRecord(input)) return structuredClone(DEFAULT_CONFIG)

  const raw = migrate(input)
  const override = typeof raw.timezoneOverride === 'string' ? raw.timezoneOverride : null

  return {
    version: CONFIG_VERSION,
    location: normalizeLocation(raw.location),
    timezoneOverride: override && isValidTimeZone(override) ? override : null,
    theme: oneOf<ThemePreference>(raw.theme, ['system', 'light', 'dark'], 'system'),
    temperatureUnit: oneOf<TemperatureUnit>(
      raw.temperatureUnit,
      ['celsius', 'fahrenheit'],
      'celsius'
    ),
    hourCycle: oneOf<HourCyclePreference>(raw.hourCycle, ['system', '12', '24'], 'system'),
    fontFamily: oneOf<FontChoice>(
      raw.fontFamily,
      ['jetbrains', 'geist', 'martian', 'redhat'],
      'jetbrains'
    ),
    zoomFactor: Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, finite(raw.zoomFactor, DEFAULT_CONFIG.zoomFactor))
    ),
    background: oneOf<BackgroundChoice>(
      raw.background,
      ['ambient', 'mesh', 'warp', 'grain', 'swirl', 'dither', 'wallpaper'],
      'mesh'
    ),
    wallpaper: normalizeWallpaper(raw.wallpaper),
    wallpaperDim: Math.min(
      MAX_WALLPAPER_DIM,
      Math.max(MIN_WALLPAPER_DIM, finite(raw.wallpaperDim, DEFAULT_CONFIG.wallpaperDim))
    ),
    mode: oneOf<ClockMode>(raw.mode, ['clock', 'chrono', 'timer'], 'clock'),
    timerDuration: Math.min(
      MAX_TIMER_MS,
      Math.max(MIN_TIMER_MS, Math.round(finite(raw.timerDuration, DEFAULT_CONFIG.timerDuration)))
    ),
    palette: oneOf<PaletteChoice>(
      raw.palette,
      ['weather', 'ember', 'tide', 'custom'],
      'weather'
    ),
    customPalette: normalizeCustomPalette(raw.customPalette),
    windowBounds: normalizeBounds(raw.windowBounds),
    windowMaximized: raw.windowMaximized === true,
    windowFullScreen: raw.windowFullScreen === true
  }
}

export class ConfigStore {
  private readonly filePath: string
  private config: AppConfig
  private persistTimer: NodeJS.Timeout | null = null

  constructor() {
    this.filePath = join(app.getPath('userData'), 'config.json')
    this.config = this.load()
  }

  private load(): AppConfig {
    try {
      const raw = readFileSync(this.filePath, 'utf-8')
      return normalizeConfig(JSON.parse(raw) as unknown)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') {
        // Unreadable or unparseable: fall back to defaults and get out of the
        // way of the broken file rather than refusing to start.
        console.warn(`[config] ignoring unreadable config at ${this.filePath}:`, error)
      }
      return structuredClone(DEFAULT_CONFIG)
    }
  }

  get(): AppConfig {
    return this.config
  }

  update(patch: Partial<AppConfig>): AppConfig {
    this.config = normalizeConfig({ ...this.config, ...patch })
    this.schedulePersist()
    return this.config
  }

  /**
   * Window moves fire continuously while dragging, so writes are coalesced.
   * `flush` on quit makes sure the final position still lands on disk.
   */
  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer)
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      this.persist()
    }, PERSIST_DEBOUNCE_MS)
  }

  flush(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer)
      this.persistTimer = null
    }
    this.persist()
  }

  private persist(): void {
    const temp = `${this.filePath}.tmp`
    try {
      mkdirSync(app.getPath('userData'), { recursive: true })
      writeFileSync(temp, JSON.stringify(this.config, null, 2), 'utf-8')
      // Write-then-rename: a crash mid-write leaves the old config intact
      // instead of a truncated file that would reset the user's settings.
      renameSync(temp, this.filePath)
    } catch (error) {
      console.error('[config] failed to persist:', error)
    }
  }
}
