import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import type { ClockMode } from '@shared/types'
import { describeWeatherCode, toneForIcon } from '@shared/weather-codes'
import { Background } from './components/Background'
import { Chrono, ChronoControls } from './components/Chrono'
import { Timer, TimerControls } from './components/Timer'
import { Clock } from './components/Clock'
import { Crossfade } from './components/Crossfade'
import { DevMenu } from './components/DevMenu'
import { Planning } from './components/Planning'
import { Settings } from './components/Settings'
import { TitleBar } from './components/TitleBar'
import { TodayAgenda } from './components/TodayAgenda'
import { WeatherStrip } from './components/WeatherStrip'
import {
  useCalendar,
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
import { toWallClockEvents } from './lib/planning'
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
  const calendar = useCalendar()
  const { maximized, fullScreen } = useWindowState()
  const chromeIdle = useIdleChrome(fullScreen)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [planningOpen, setPlanningOpen] = useState(false)
  // Either panel takes the keyboard and keeps the chrome awake.
  const panelOpen = settingsOpen || planningOpen

  // Detection happens once per launch; an explicit override wins over it.
  const systemTimeZone = useMemo(() => detectTimeZone(), [])
  const timeZone = config?.timezoneOverride ?? systemTimeZone

  // Google's events are real instants; read here in the zone the clock shows,
  // so they move with a zone override while local entries stay put.
  const google = useMemo(
    () => toWallClockEvents(calendar.events, timeZone),
    [calendar.events, timeZone]
  )
  const planning = config?.planning
  const today = useMemo(() => [...(planning ?? []), ...google.timed], [planning, google])

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
      // Anything typed into a field belongs to that field.
      const target = event.target
      const typing =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)

      if (event.key === 'F11') {
        event.preventDefault()
        window.api.window.toggleFullScreen()
      }
      // An open panel owns Escape, and a ringing alarm owns it before full
      // screen does.
      if (event.key === 'Escape' && !panelOpen) {
        if (mode === 'timer' && getTimerStatus() === 'ringing') {
          dismissTimer()
          return
        }
        if (fullScreen) window.api.window.toggleFullScreen()
      }

      // Mode keys, but never while a field has focus -- a space in the city
      // search must stay a space.
      if (panelOpen || typing) return

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
  }, [fullScreen, panelOpen, mode])

  if (!config) {
    // A single frame at most, and the window is already painted in the
    // theme's base colour, so there is nothing to see here.
    return <div className="drag h-full" />
  }

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
        Three rows, the middle one sized to its content. The clock sits a
        little above centre so today's planning has room beneath the weather,
        and the split is the same in every mode, so switching between them
        still moves nothing. The outer rows hold their share even when the
        bottom one has more to say than fits -- the planning trims itself
        there rather than pushing the clock upwards.
      */}
      <main className="relative grid h-full grid-rows-[minmax(0,2fr)_auto_minmax(0,3fr)] px-10">
        <div aria-hidden />

        <div className="flex items-center justify-center">
          {/* Both halves cross-fade on the same clock, so the readout and the
              bar beneath it change together rather than in sequence. */}
          <Crossfade value={mode} leavingClassName="inset-0 flex items-center justify-center">
            {(shown) =>
              shown === 'chrono' ? (
                <Chrono />
              ) : shown === 'timer' ? (
                <Timer />
              ) : (
                <Clock timeZone={timeZone} hour12={hour12} />
              )
            }
          </Crossfade>
        </div>

        <div className="flex min-h-0 flex-col items-center gap-[clamp(0.75rem,2.5vh,1.75rem)] overflow-hidden pb-[clamp(1rem,3vh,2rem)] pt-[clamp(2rem,6vh,4.5rem)]">
          <Crossfade
            value={mode}
            className="shrink-0"
            leavingClassName="inset-x-0 top-0 flex justify-center"
          >
            {(shown) =>
              shown === 'chrono' ? (
                <ChronoControls />
              ) : shown === 'timer' ? (
                <TimerControls />
              ) : (
                <WeatherStrip
                  state={weather}
                  unit={config.temperatureUnit}
                  timeZone={timeZone}
                  hour12={hour12}
                />
              )
            }
          </Crossfade>

          {/* Only the clock has a "today"; the stopwatch and timer stay bare. */}
          <Crossfade
            value={mode}
            className="flex min-h-0 w-full flex-col items-center"
            contentClassName="flex min-h-0 w-full flex-col items-center"
            leavingClassName="inset-x-0 top-0 flex justify-center"
          >
            {(shown) =>
              shown === 'clock' ? (
                <TodayAgenda
                  events={today}
                  allDay={google.allDay}
                  timeZone={timeZone}
                  hour12={hour12}
                  onOpen={() => setPlanningOpen(true)}
                />
              ) : null
            }
          </Crossfade>
        </div>
      </main>

      <TitleBar
        place={PLACE_LABEL[mode] ?? shortLocation(config.location)}
        mode={mode}
        onSelectMode={(next) => update({ mode: next })}
        maximized={maximized}
        fullScreen={fullScreen}
        dimmed={chromeIdle && !panelOpen}
        onOpenPlanning={() => setPlanningOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Vite folds this to false when building, so the dev menu and
          everything it imports drop out of the shipped bundle. */}
      {import.meta.env.DEV ? <DevMenu /> : null}

      {planningOpen ? (
        <Planning
          events={config.planning}
          external={google.timed}
          allDay={google.allDay}
          calendar={calendar}
          timeZone={timeZone}
          hour12={hour12}
          onChange={(planning) => update({ planning })}
          onClose={() => setPlanningOpen(false)}
        />
      ) : null}

      {settingsOpen ? (
        <Settings
          config={config}
          calendar={calendar}
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
