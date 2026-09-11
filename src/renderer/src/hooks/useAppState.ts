import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import type { AppConfig, ResolvedTheme, WeatherState } from '@shared/types'

export function useConfig(): {
  config: AppConfig | null
  update: (patch: Partial<AppConfig>) => void
} {
  const [config, setConfig] = useState<AppConfig | null>(null)

  useEffect(() => {
    let active = true
    void window.api.config.get().then((next) => {
      if (active) setConfig(next)
    })
    const unsubscribe = window.api.config.subscribe(setConfig)
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const update = useCallback((patch: Partial<AppConfig>) => {
    // The main process is the authority: it normalises the patch and hands
    // back the config that was actually stored.
    void window.api.config.update(patch).then(setConfig)
  }, [])

  return { config, update }
}

export function useWeather(): WeatherState {
  const [state, setState] = useState<WeatherState>({
    status: 'idle',
    snapshot: null,
    error: null
  })

  useEffect(() => {
    let active = true
    void window.api.weather.get().then((next) => {
      if (active) setState(next)
    })
    const unsubscribe = window.api.weather.subscribe(setState)
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return state
}

/**
 * nativeTheme in the main process is the single source of truth -- it already
 * folds the user's override and the OS setting together.
 */
export function useTheme(): ResolvedTheme {
  const [theme, setTheme] = useState<ResolvedTheme>(() => window.api.theme.initial)

  useEffect(() => {
    let active = true
    void window.api.theme.get().then((next) => {
      if (active) setTheme(next)
    })
    return window.api.theme.subscribe(setTheme)
  }, [])

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return theme
}

export interface WindowState {
  maximized: boolean
  fullScreen: boolean
}

export function useWindowState(): WindowState {
  const [state, setState] = useState<WindowState>({ maximized: false, fullScreen: false })

  useEffect(() => {
    let active = true

    void window.api.window.isMaximized().then((maximized) => {
      if (active) setState((current) => ({ ...current, maximized }))
    })
    void window.api.window.isFullScreen().then((fullScreen) => {
      if (active) setState((current) => ({ ...current, fullScreen }))
    })

    const offMaximized = window.api.window.subscribeMaximized((maximized) =>
      setState((current) => ({ ...current, maximized }))
    )
    const offFullScreen = window.api.window.subscribeFullScreen((fullScreen) =>
      setState((current) => ({ ...current, fullScreen }))
    )

    return () => {
      active = false
      offMaximized()
      offFullScreen()
    }
  }, [])

  return state
}

/**
 * Fades the window chrome out while a full-screen clock is left alone, and
 * brings it straight back on the first mouse movement. Windowed mode always
 * shows it -- the controls are the only way to move or close the window.
 */
export function useIdleChrome(fullScreen: boolean, idleMs = 2600): boolean {
  const [idle, setIdle] = useState(false)

  useEffect(() => {
    if (!fullScreen) {
      setIdle(false)
      return
    }

    let timer = 0
    const wake = (): void => {
      setIdle(false)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setIdle(true), idleMs)
    }

    wake()
    window.addEventListener('mousemove', wake)
    window.addEventListener('mousedown', wake)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('mousemove', wake)
      window.removeEventListener('mousedown', wake)
    }
  }, [fullScreen, idleMs])

  return idle
}
