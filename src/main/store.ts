import { app } from 'electron'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DEFAULT_CONFIG,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  type AppConfig,
  type AppLocation,
  type BackgroundChoice,
  type CustomPalette,
  type FontChoice,
  type PaletteChoice,
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

function normalizeBounds(raw: unknown): WindowBounds {
  if (!isRecord(raw)) return { ...DEFAULT_CONFIG.windowBounds }
  return {
    x: typeof raw.x === 'number' && Number.isFinite(raw.x) ? Math.round(raw.x) : null,
    y: typeof raw.y === 'number' && Number.isFinite(raw.y) ? Math.round(raw.y) : null,
    width: Math.max(MIN_WINDOW_WIDTH, Math.round(finite(raw.width, DEFAULT_CONFIG.windowBounds.width))),
    height: Math.max(MIN_WINDOW_HEIGHT, Math.round(finite(raw.height, DEFAULT_CONFIG.windowBounds.height)))
  }
}

/**
 * Every field is validated independently, so one bad value costs only that
 * value -- a config with a garbled theme keeps the user's saved city.
 */
function normalizeConfig(raw: unknown): AppConfig {
  if (!isRecord(raw)) return structuredClone(DEFAULT_CONFIG)

  const override = typeof raw.timezoneOverride === 'string' ? raw.timezoneOverride : null

  return {
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
      ['inter', 'grotesk', 'fraunces', 'mono'],
      'inter'
    ),
    background: oneOf<BackgroundChoice>(
      raw.background,
      ['ambient', 'mesh', 'warp', 'grain', 'swirl', 'dither'],
      'mesh'
    ),
    palette: oneOf<PaletteChoice>(
      raw.palette,
      ['weather', 'ember', 'tide', 'custom'],
      'weather'
    ),
    customPalette: normalizeCustomPalette(raw.customPalette),
    windowBounds: normalizeBounds(raw.windowBounds)
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
