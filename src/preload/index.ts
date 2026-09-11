import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type AppConfig, type GeoResult, type ResolvedTheme, type WeatherApi, type WeatherState } from '@shared/types'

/**
 * Wraps an ipcRenderer listener so the renderer never touches the event
 * object, and always gets an unsubscribe function back.
 */
function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.off(channel, handler)
  }
}

const THEME_FLAG = '--app-theme='
const VERSION_FLAG = '--app-version='

/**
 * The main process stamps the resolved theme onto the command line, so the
 * renderer can paint the right colours before its first IPC round-trip.
 */
function initialTheme(): ResolvedTheme {
  const flag = process.argv.find((arg) => arg.startsWith(THEME_FLAG))
  return flag?.slice(THEME_FLAG.length) === 'dark' ? 'dark' : 'light'
}

function appVersion(): string {
  const flag = process.argv.find((arg) => arg.startsWith(VERSION_FLAG))
  return flag?.slice(VERSION_FLAG.length) ?? '0.0.0'
}

const api: WeatherApi = {
  app: {
    version: appVersion()
  },
  config: {
    get: () => ipcRenderer.invoke(IPC.configGet) as Promise<AppConfig>,
    update: (patch) => ipcRenderer.invoke(IPC.configUpdate, patch) as Promise<AppConfig>,
    subscribe: (listener) => subscribe<AppConfig>(IPC.configChanged, listener)
  },
  weather: {
    get: () => ipcRenderer.invoke(IPC.weatherGet) as Promise<WeatherState>,
    refresh: () => ipcRenderer.invoke(IPC.weatherRefresh) as Promise<WeatherState>,
    subscribe: (listener) => subscribe<WeatherState>(IPC.weatherChanged, listener)
  },
  geocoding: {
    search: (query) => ipcRenderer.invoke(IPC.geocodingSearch, query) as Promise<GeoResult[]>
  },
  theme: {
    initial: initialTheme(),
    get: () => ipcRenderer.invoke(IPC.themeGet) as Promise<ResolvedTheme>,
    subscribe: (listener) => subscribe<ResolvedTheme>(IPC.themeChanged, listener)
  },
  window: {
    minimize: () => ipcRenderer.send(IPC.windowMinimize),
    toggleMaximize: () => ipcRenderer.send(IPC.windowToggleMaximize),
    toggleFullScreen: () => ipcRenderer.send(IPC.windowToggleFullScreen),
    close: () => ipcRenderer.send(IPC.windowClose),
    isMaximized: () => ipcRenderer.invoke(IPC.windowIsMaximized) as Promise<boolean>,
    isFullScreen: () => ipcRenderer.invoke(IPC.windowIsFullScreen) as Promise<boolean>,
    subscribeMaximized: (listener) => subscribe<boolean>(IPC.windowMaximizedChanged, listener),
    subscribeFullScreen: (listener) => subscribe<boolean>(IPC.windowFullScreenChanged, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
