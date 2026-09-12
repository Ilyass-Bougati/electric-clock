import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import type { ClockMode } from '@shared/types'
import { describeWeatherCode, toneForIcon } from '@shared/weather-codes'
import { Background } from './components/Background'
import { Chrono, ChronoControls } from './components/Chrono'
import { Timer, TimerControls } from './components/Timer'
import { Clock } from './components/Clock'
import { Settings } from './components/Settings'
import { TitleBar } from './components/TitleBar'
import { WeatherStrip } from './components/WeatherStrip'
import {
  useConfig,
  useIdleChrome,
  useTheme,
  useWeather,
  useWindowState
} from './hooks/useAppState'
import { readShaderPalette, resolveToneOverrides } from './lib/shader-palette'
import { resetChrono, toggleChrono } from './lib/chrono'
import {
  dismissTimer,
  getTimerStatus,
  hydrateTimer,
  popTimerDigit,
  pushTimerDigit,
  resetTimer,
  ringTimer,
  toggleTimer
} from './lib/timer'
import { detectTimeZone, resolveHour12 } from './lib/time'
import { shortLocation } from './lib/units'

const PLACE_LABEL: Partial<Record<ClockMode, string>> = {
  chrono: 'Stopwatch',
  timer: 'Timer'
}

export default function App(): ReactNode {
  const theme = useTheme()

  const { config, update } = useConfig()
  const weather = useWeather()
  const { maximized, fullScreen } = useWindowState()
  const chromeIdle = useIdleChrome(fullScreen)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Detection happens once per launch; an explicit override wins over it.
  const systemTimeZone = useMemo(() => detectTimeZone(), [])

  const fontFamily = config?.fontFamily ?? 'jetbrains'
  useEffect(() => {
    document.documentElement.dataset.font = fontFamily
  }, [fontFamily])

  const onWallpaper = config?.background === 'wallpaper' && config.wallpaper !== null
  useEffect(() => {
    if (onWallpaper) document.documentElement.dataset.wallpaper = 'on'
    else delete document.documentElement.dataset.wallpaper
  }, [onWallpaper])

  // The whole window takes its colour cue from the sky. `data-tone` drives
  // the CSS washes; the shader palette is then read back out of those same
  // tokens, so both stay one palette rather than two that can drift.
  const tone = weather.snapshot
    ? toneForIcon(describeWeatherCode(weather.snapshot.weatherCode).icon)
    : 'cloud'

  // The countdown's firing is the main process's call, not the renderer's.
  useEffect(() => window.api.timer.subscribeElapsed(ringTimer), [])

  const timerDuration = config?.timerDuration
  useEffect(() => {
    if (timerDuration !== undefined) hydrateTimer(timerDuration)
  }, [timerDuration])

  const [palette, setPalette] = useState(readShaderPalette)
  const paletteChoice = config?.palette ?? 'weather'
  const customPalette = config?.customPalette

  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.tone = tone

    // A chosen palette is installed by overwriting the two tone variables
    // themselves. Everything downstream -- the CSS washes, the shaders, the
    // preview tiles -- already reads those, so nothing else has to care.
    const overrides = customPalette
      ? resolveToneOverrides(paletteChoice, customPalette, theme)
      : null
    if (overrides) {
      root.style.setProperty('--tone-a', overrides[0])
      root.style.setProperty('--tone-b', overrides[1])
    } else {
      root.style.removeProperty('--tone-a')
      root.style.removeProperty('--tone-b')
    }

    setPalette(readShaderPalette())
  }, [tone, theme, paletteChoice, customPalette])

  const mode = config?.mode ?? 'clock'

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'F11') {
        event.preventDefault()
        window.api.window.toggleFullScreen()
      }
      // Settings owns Escape while it is open, and a ringing alarm owns it
      // before full screen does.
      if (event.key === 'Escape' && !settingsOpen) {
        if (mode === 'timer' && getTimerStatus() === 'ringing') {
          dismissTimer()
          return
        }
        if (fullScreen) window.api.window.toggleFullScreen()
      }

      // Mode keys, but never while the settings panel is collecting typing --
      // a space in the city search must stay a space.
      if (settingsOpen) return

      if (mode === 'chrono') {
        if (event.key === ' ' || event.code === 'Space') {
          event.preventDefault()
          toggleChrono()
        }
        if (event.key === 'r' || event.key === 'R') resetChrono()
        return
      }

      if (mode === 'timer') {
        // Anything at all silences an alarm that is going off. Fumbling for
        // the right key while it rings would be its own small cruelty.
        if (getTimerStatus() === 'ringing') {
          event.preventDefault()
          dismissTimer()
          return
        }
        if (/^[0-9]$/.test(event.key)) {
          pushTimerDigit(event.key)
          return
        }
        if (event.key === 'Backspace') {
          popTimerDigit()
          return
        }
        if (event.key === ' ' || event.code === 'Space' || event.key === 'Enter') {
          event.preventDefault()
          toggleTimer()
          return
        }
        if (event.key === 'r' || event.key === 'R') resetTimer()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [fullScreen, settingsOpen, mode])

  if (!config) {
    // A single frame at most, and the window is already painted in the
    // theme's base colour, so there is nothing to see here.
    return <div className="drag h-full" />
  }

  const timeZone = config.timezoneOverride ?? systemTimeZone
  const hour12 = resolveHour12(config.hourCycle)

  return (
    <div className="relative h-full overflow-hidden">
      <Background
        choice={config.background}
        palette={palette}
        wallpaper={config.wallpaper}
        dim={config.wallpaperDim}
      />

      {/*
        Three rows, the middle one sized to its content: that puts the clock
        at the exact centre of the window and keeps it there, whatever the
        weather strip below happens to contain.
      */}
      <main className="relative grid h-full grid-rows-[1fr_auto_1fr] px-10">
        <div aria-hidden />

        <div className="flex items-center justify-center">
          {mode === 'chrono' ? (
            <Chrono />
          ) : mode === 'timer' ? (
            <Timer />
          ) : (
            <Clock timeZone={timeZone} hour12={hour12} />
          )}
        </div>

        <div className="flex items-start justify-center pt-[clamp(2rem,6vh,4.5rem)]">
          {mode === 'chrono' ? (
            <ChronoControls />
          ) : mode === 'timer' ? (
            <TimerControls />
          ) : (
            <WeatherStrip
              state={weather}
              unit={config.temperatureUnit}
              timeZone={timeZone}
              hour12={hour12}
            />
          )}
        </div>
      </main>

      <TitleBar
        place={PLACE_LABEL[mode] ?? shortLocation(config.location)}
        mode={mode}
        onSelectMode={(next) => update({ mode: next })}
        maximized={maximized}
        fullScreen={fullScreen}
        dimmed={chromeIdle && !settingsOpen}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {settingsOpen ? (
        <Settings
          config={config}
          systemTimeZone={systemTimeZone}
          palette={palette}
          theme={theme}
          onUpdate={update}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </div>
  )
}
