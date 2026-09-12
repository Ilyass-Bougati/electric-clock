import { app, dialog, net, protocol, type BrowserWindow } from 'electron'
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { MAX_WALLPAPER_BYTES, WALLPAPER_SCHEME, type Wallpaper } from '@shared/types'

const ACCEPTED = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp']

/**
 * The chosen image is copied in here rather than referenced where it sits.
 * A wallpaper that vanishes because the user tidied their Downloads folder
 * would be a poor surprise, and it keeps the renderer from ever learning a
 * path outside the app's own storage.
 */
function wallpaperDir(): string {
  return join(app.getPath('userData'), 'wallpaper')
}

export function wallpaperPath(wallpaper: Wallpaper | null): string | null {
  return wallpaper ? join(wallpaperDir(), wallpaper.file) : null
}

/**
 * Must run before `app.ready`. Marking the scheme standard and secure lets
 * the renderer treat it like any other image source; it is still subject to
 * the page's CSP, which names this scheme explicitly.
 */
export function registerWallpaperScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: WALLPAPER_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true }
    }
  ])
}

/**
 * Serves whatever the current wallpaper is. The renderer asks for a fixed
 * URL and never handles a filesystem path, so there is no way for a crafted
 * request to reach a file the user did not pick.
 */
export function serveWallpaper(current: () => Wallpaper | null): void {
  protocol.handle(WALLPAPER_SCHEME, async () => {
    const file = wallpaperPath(current())
    if (!file) return new Response(null, { status: 404 })

    try {
      return await net.fetch(pathToFileURL(file).toString())
    } catch (error) {
      console.warn('[wallpaper] could not read', file, error)
      return new Response(null, { status: 404 })
    }
  })
}

function clearDirectory(): void {
  try {
    for (const entry of readdirSync(wallpaperDir())) {
      rmSync(join(wallpaperDir(), entry), { force: true })
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') console.warn('[wallpaper] could not clear:', error)
  }
}

export function removeWallpaper(): null {
  clearDirectory()
  return null
}

/**
 * Returns the new wallpaper, or `undefined` when the user cancelled -- which
 * the caller must treat as "leave the config alone", distinct from `null`
 * meaning "remove the wallpaper".
 */
export async function chooseWallpaper(
  parent: BrowserWindow | null
): Promise<Wallpaper | null | undefined> {
  const picker: Electron.OpenDialogOptions = {
    title: 'Choose a wallpaper',
    buttonLabel: 'Use image',
    filters: [{ name: 'Images', extensions: ACCEPTED }],
    properties: ['openFile']
  }

  const result = parent
    ? await dialog.showOpenDialog(parent, picker)
    : await dialog.showOpenDialog(picker)

  const source = result.filePaths[0]
  if (result.canceled || !source) return undefined

  let size = 0
  try {
    size = statSync(source).size
  } catch (error) {
    console.warn('[wallpaper] could not stat the chosen file:', error)
    return undefined
  }

  if (size > MAX_WALLPAPER_BYTES) {
    const warning: Electron.MessageBoxOptions = {
      type: 'warning',
      title: 'Image too large',
      message: 'That image is too large to use as a wallpaper.',
      detail:
        `The limit is ${Math.round(MAX_WALLPAPER_BYTES / 1024 / 1024)} MB; ` +
        `that file is ${Math.round(size / 1024 / 1024)} MB.`
    }
    if (parent) await dialog.showMessageBox(parent, warning)
    else await dialog.showMessageBox(warning)
    return undefined
  }

  const extension = extname(source).toLowerCase() || '.png'
  // One wallpaper at a time: clear first so old files cannot accumulate in
  // userData every time the user changes their mind.
  clearDirectory()

  const file = `current${extension}`
  try {
    mkdirSync(wallpaperDir(), { recursive: true })
    copyFileSync(source, join(wallpaperDir(), file))
  } catch (error) {
    console.error('[wallpaper] could not copy the chosen image:', error)
    return undefined
  }

  return { file, updatedAt: Date.now() }
}
