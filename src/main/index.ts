import { app, BrowserWindow, ipcMain, nativeTheme, screen } from 'electron'
import { join } from 'node:path'
import {
  IPC,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  type AppConfig,
  type ResolvedTheme,
  type WindowBounds
} from '@shared/types'
import { ConfigStore } from './store'
import { searchCities, WeatherService } from './weather'

/**
 * Mirrors --bg in the renderer stylesheet. Set as the window's
 * backgroundColor so the first paint is already the right colour instead
 * of a white flash.
 */
const BACKDROP: Record<ResolvedTheme, string> = {
  light: '#f2f2f0',
  dark: '#101214'
}

let mainWindow: BrowserWindow | null = null
let store: ConfigStore
let weather: WeatherService

function resolvedTheme(): ResolvedTheme {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
}

function broadcast(channel: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

/**
 * A window saved on a monitor that is no longer attached would open
 * off-screen, so a position is only honoured if some display still
 * overlaps it. Otherwise we keep the size and let Electron centre it.
 */
function placement(bounds: WindowBounds): { x?: number; y?: number; width: number; height: number } {
  const { x, y, width, height } = bounds
  if (x === null || y === null) return { width, height }

  const visible = screen.getAllDisplays().some(({ workArea }) => {
    return (
      x < workArea.x + workArea.width &&
      x + width > workArea.x &&
      y < workArea.y + workArea.height &&
      y + height > workArea.y
    )
  })

  return visible ? { x, y, width, height } : { width, height }
}

function applyConfigPatch(patch: Partial<AppConfig>, notify = true): AppConfig {
  const previous = store.get()
  const next = store.update(patch)

  if (next.theme !== previous.theme) {
    nativeTheme.themeSource = next.theme
  }
  // The service compares coordinates itself and no-ops when they match.
  weather.setLocation(next.location)
  if (notify) {
    broadcast(IPC.configChanged, next)
  }
  return next
}

function trackBounds(window: BrowserWindow): void {
  // Only ever record a plain, restored window. Maximized and full-screen
  // geometry must not become the remembered size, or un-maximizing after a
  // restart would leave the window still filling the screen -- and on X11
  // getNormalBounds() is not always updated before the resize event lands.
  const save = (): void => {
    if (window.isDestroyed()) return
    if (window.isMinimized() || window.isMaximized() || window.isFullScreen()) return
    const { x, y, width, height } = window.getNormalBounds()
    applyConfigPatch({ windowBounds: { x, y, width, height } }, false)
  }

  window.on('resize', save)
  window.on('move', save)
}

function createWindow(): void {
  const config = store.get()
  const theme = resolvedTheme()

  mainWindow = new BrowserWindow({
    ...placement(config.windowBounds),
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: BACKDROP[theme],
    title: 'Electric Clock',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      additionalArguments: [`--app-theme=${theme}`],
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  mainWindow.on('maximize', () => broadcast(IPC.windowMaximizedChanged, true))
  mainWindow.on('unmaximize', () => broadcast(IPC.windowMaximizedChanged, false))
  mainWindow.on('enter-full-screen', () => broadcast(IPC.windowFullScreenChanged, true))
  mainWindow.on('leave-full-screen', () => broadcast(IPC.windowFullScreenChanged, false))
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  trackBounds(mainWindow)

  const devServerUrl = process.env['ELECTRON_RENDERER_URL']

  // This app never opens a second window and never leaves its own document.
  // Anything else -- an injected link, a stray redirect -- is refused. The
  // app's own origin stays allowed so Vite's full reloads still work in dev.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const own = devServerUrl ? url.startsWith(devServerUrl) : url.startsWith('file://')
    if (!own) event.preventDefault()
  })

  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC.configGet, () => store.get())

  ipcMain.handle(IPC.configUpdate, (_event, patch: unknown) => {
    if (typeof patch !== 'object' || patch === null) return store.get()
    // ConfigStore re-validates every field, so an untrusted patch can only
    // ever produce a valid config or leave the existing value in place.
    return applyConfigPatch(patch as Partial<AppConfig>)
  })

  ipcMain.handle(IPC.weatherGet, () => weather.getState())
  ipcMain.handle(IPC.weatherRefresh, () => weather.refresh())

  ipcMain.handle(IPC.geocodingSearch, async (_event, query: unknown) => {
    if (typeof query !== 'string') return []
    try {
      return await searchCities(query)
    } catch (error) {
      console.warn('[geocoding] search failed:', error)
      return []
    }
  })

  ipcMain.handle(IPC.themeGet, () => resolvedTheme())

  ipcMain.on(IPC.windowMinimize, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.on(IPC.windowToggleMaximize, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })
  ipcMain.on(IPC.windowToggleFullScreen, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return
    window.setFullScreen(!window.isFullScreen())
  })
  ipcMain.on(IPC.windowClose, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
  ipcMain.handle(IPC.windowIsMaximized, (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  })
  ipcMain.handle(IPC.windowIsFullScreen, (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false
  })
}

app.whenReady().then(() => {
  store = new ConfigStore()
  const config = store.get()

  nativeTheme.themeSource = config.theme
  nativeTheme.on('updated', () => {
    const theme = resolvedTheme()
    mainWindow?.setBackgroundColor(BACKDROP[theme])
    broadcast(IPC.themeChanged, theme)
  })

  weather = new WeatherService(config.location)
  weather.subscribe((state) => broadcast(IPC.weatherChanged, state))

  registerIpc()
  createWindow()
  weather.start()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  weather?.stop()
  store?.flush()
})
