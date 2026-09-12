/**
 * The single source of truth for every value that crosses the process
 * boundary. Imported by the main process, the preload bridge and the
 * renderer alike -- if a shape changes here, all three fail to compile
 * together rather than drifting apart silently.
 */

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'
export type TemperatureUnit = 'celsius' | 'fahrenheit'

/** 'system' defers to the locale's own convention. */
export type HourCyclePreference = 'system' | '12' | '24'

/**
 * The typeface the clock is set in.
 *
 * All four are monospaced. A clock that reflows every second is unusable, and
 * `font-variant-numeric: tabular-nums` is silently ignored by fonts that do
 * not ship tabular figures -- `npm run check:fonts` measures this rather than
 * trusting it.
 */
export type FontChoice = 'jetbrains' | 'geist' | 'martian' | 'redhat'

/**
 * What fills the window behind the clock. 'ambient' is the plain CSS wash and
 * costs nothing; 'wallpaper' is an image the user picked; the rest are live
 * WebGL shaders that take their colours from the current conditions.
 */
export type BackgroundChoice =
  | 'ambient'
  | 'mesh'
  | 'warp'
  | 'grain'
  | 'swirl'
  | 'dither'
  | 'wallpaper'

/**
 * The chosen wallpaper, copied into userData so it survives the original
 * being moved, renamed or deleted.
 */
export interface Wallpaper {
  /** File name inside userData, not a path -- the directory is main's to know. */
  file: string
  /** Doubles as a cache-buster: the served URL is otherwise constant. */
  updatedAt: number
}

/**
 * How much of the theme's ground colour is laid back over the wallpaper.
 *
 * This has to be adjustable rather than a fixed value: a dark photograph
 * needs almost none, while a bright busy one will swallow the date line
 * whole. 0 shows the image untouched; 0.9 leaves barely a hint of it.
 */
export const MIN_WALLPAPER_DIM = 0
export const MAX_WALLPAPER_DIM = 0.9

/** What the big display shows. */
export type ClockMode = 'clock' | 'chrono' | 'timer'

/** Remembered between runs so the timer reopens on your usual duration. */
export const MIN_TIMER_MS = 1000
export const MAX_TIMER_MS = 24 * 60 * 60 * 1000 - 1000

/**
 * Where the background's two accent colours come from. 'weather' keeps them
 * tied to the current conditions; the rest are fixed. The ground colour is
 * never part of this -- it stays the theme's, so text contrast and the glass
 * lift hold no matter what is picked.
 */
export type PaletteChoice = 'weather' | 'ember' | 'tide' | 'custom'

export interface CustomPalette {
  /** Both are `#rrggbb`. */
  accent: string
  accentAlt: string
}

export interface GeoResult {
  id: number
  name: string
  /** State / region. Absent for city-states and small countries. */
  admin1: string | null
  country: string
  countryCode: string
  latitude: number
  longitude: number
  timezone: string
}

/** A city the user has chosen. Structurally a trimmed GeoResult. */
export interface AppLocation {
  name: string
  admin1: string | null
  country: string
  latitude: number
  longitude: number
  timezone: string
}

/**
 * The restored geometry only. Whether the window was left maximized or full
 * screen is tracked separately -- those states have no bounds of their own,
 * and the size to come back to when un-maximizing is this one.
 */
export interface WindowBounds {
  x: number | null
  y: number | null
  width: number
  height: number
}

/**
 * Bumped whenever a stored value needs rewriting rather than merely
 * defaulting. The store migrates old files forward so an upgrade never costs
 * the user their settings.
 */
export const CONFIG_VERSION = 2

export interface AppConfig {
  /** Schema version of the file this config was read from. */
  version: number
  location: AppLocation
  /** An IANA zone that wins over detection, or null to follow the system. */
  timezoneOverride: string | null
  theme: ThemePreference
  temperatureUnit: TemperatureUnit
  hourCycle: HourCyclePreference
  fontFamily: FontChoice
  background: BackgroundChoice
  wallpaper: Wallpaper | null
  wallpaperDim: number
  mode: ClockMode
  /** The countdown's last-used length, in milliseconds. */
  timerDuration: number
  palette: PaletteChoice
  customPalette: CustomPalette
  windowBounds: WindowBounds
  windowMaximized: boolean
  windowFullScreen: boolean
}

/**
 * Always stored in metric. Unit preference is a display concern, so
 * toggling C/F never invalidates the cache or forces a refetch.
 */
export interface WeatherSnapshot {
  temperatureC: number
  apparentTemperatureC: number
  weatherCode: number
  humidity: number
  uvIndex: number
  /** Epoch ms of the successful fetch this snapshot came from. */
  fetchedAt: number
  /** The place this snapshot describes, so a stale card never lies. */
  location: AppLocation
}

export type WeatherStatus =
  | 'idle'
  /** No cached value yet and a request is in flight. */
  | 'loading'
  /** Showing a value from the most recent successful fetch. */
  | 'ok'
  /** The last fetch failed; `snapshot` is the previous good value. */
  | 'stale'
  /** The last fetch failed and there is nothing cached to fall back on. */
  | 'error'

export interface WeatherState {
  status: WeatherStatus
  snapshot: WeatherSnapshot | null
  error: string | null
}

/** The typed surface exposed on `window.api` by the preload bridge. */
export interface WeatherApi {
  config: {
    get(): Promise<AppConfig>
    update(patch: Partial<AppConfig>): Promise<AppConfig>
    subscribe(listener: (config: AppConfig) => void): () => void
  }
  weather: {
    get(): Promise<WeatherState>
    refresh(): Promise<WeatherState>
    subscribe(listener: (state: WeatherState) => void): () => void
  }
  geocoding: {
    search(query: string): Promise<GeoResult[]>
  }
  wallpaper: {
    /**
     * Opens a native file picker and copies the chosen image into userData.
     * Resolves with the updated config, unchanged if the user cancelled.
     */
    choose(): Promise<AppConfig>
    clear(): Promise<AppConfig>
  }
  timer: {
    /**
     * Hands the deadline to the main process, which owns the moment the
     * countdown fires.
     *
     * The renderer cannot be trusted with it: a hidden or minimised window
     * has its timers throttled to once a minute by Chromium, so a timer set
     * from the renderer alone would go off late by however long you looked
     * away. Node's timers in main are not throttled.
     */
    arm(deadline: number): void
    disarm(): void
    /** Fires once when the countdown reaches zero. */
    subscribeElapsed(listener: () => void): () => void
  }
  app: {
    /** The running build's version, from package.json. */
    version: string
  }
  theme: {
    /** Handed over at window creation so the first paint is never wrong. */
    initial: ResolvedTheme
    get(): Promise<ResolvedTheme>
    subscribe(listener: (theme: ResolvedTheme) => void): () => void
  }
  window: {
    minimize(): void
    toggleMaximize(): void
    toggleFullScreen(): void
    close(): void
    isMaximized(): Promise<boolean>
    isFullScreen(): Promise<boolean>
    subscribeMaximized(listener: (maximized: boolean) => void): () => void
    subscribeFullScreen(listener: (fullScreen: boolean) => void): () => void
  }
}

export const IPC = {
  configGet: 'config:get',
  configUpdate: 'config:update',
  configChanged: 'config:changed',
  weatherGet: 'weather:get',
  weatherRefresh: 'weather:refresh',
  weatherChanged: 'weather:changed',
  geocodingSearch: 'geocoding:search',
  themeGet: 'theme:get',
  themeChanged: 'theme:changed',
  windowMinimize: 'window:minimize',
  windowToggleMaximize: 'window:toggle-maximize',
  windowToggleFullScreen: 'window:toggle-full-screen',
  windowClose: 'window:close',
  windowIsMaximized: 'window:is-maximized',
  windowMaximizedChanged: 'window:maximized-changed',
  windowIsFullScreen: 'window:is-full-screen',
  windowFullScreenChanged: 'window:full-screen-changed',
  wallpaperChoose: 'wallpaper:choose',
  wallpaperClear: 'wallpaper:clear',
  timerArm: 'timer:arm',
  timerDisarm: 'timer:disarm',
  timerElapsed: 'timer:elapsed'
} as const

/** The scheme the chosen wallpaper is served on. See main/wallpaper.ts. */
export const WALLPAPER_SCHEME = 'wallpaper'

/** Big enough for any screen, small enough to notice a mistake. */
export const MAX_WALLPAPER_BYTES = 40 * 1024 * 1024

/**
 * The smallest window where the clock, the date and a single row of weather
 * metrics all still fit without crowding.
 */
export const MIN_WINDOW_WIDTH = 600
export const MIN_WINDOW_HEIGHT = 460

/** Casablanca, Morocco. */
export const DEFAULT_LOCATION: AppLocation = {
  name: 'Casablanca',
  admin1: 'Casablanca-Settat',
  country: 'Morocco',
  latitude: 33.58831,
  longitude: -7.61138,
  timezone: 'Africa/Casablanca'
}

export const DEFAULT_CONFIG: AppConfig = {
  version: CONFIG_VERSION,
  location: DEFAULT_LOCATION,
  timezoneOverride: null,
  theme: 'system',
  temperatureUnit: 'celsius',
  hourCycle: 'system',
  fontFamily: 'jetbrains',
  background: 'mesh',
  wallpaper: null,
  wallpaperDim: 0.45,
  mode: 'clock',
  timerDuration: 5 * 60 * 1000,
  palette: 'weather',
  customPalette: { accent: '#e0913f', accentAlt: '#4b7fb5' },
  windowBounds: { x: null, y: null, width: 880, height: 620 },
  windowMaximized: false,
  windowFullScreen: false
}
