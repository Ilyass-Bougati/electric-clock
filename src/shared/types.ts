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
 * costs nothing; the rest are live WebGL shaders, and all of them take their
 * colours from the current conditions.
 */
export type BackgroundChoice = 'ambient' | 'mesh' | 'warp' | 'grain' | 'swirl' | 'dither'

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
  palette: PaletteChoice
  customPalette: CustomPalette
  windowBounds: WindowBounds
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
  windowFullScreenChanged: 'window:full-screen-changed'
} as const

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
  palette: 'weather',
  customPalette: { accent: '#e0913f', accentAlt: '#4b7fb5' },
  windowBounds: { x: null, y: null, width: 880, height: 620 }
}
