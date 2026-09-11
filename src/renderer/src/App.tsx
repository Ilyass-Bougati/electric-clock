import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { describeWeatherCode, toneForIcon } from '@shared/weather-codes'
import { Background } from './components/Background'
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
import { detectTimeZone, resolveHour12 } from './lib/time'
import { shortLocation } from './lib/units'

export default function App(): ReactNode {
  const theme = useTheme()

  const { config, update } = useConfig()
  const weather = useWeather()
  const { maximized, fullScreen } = useWindowState()
  const chromeIdle = useIdleChrome(fullScreen)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Detection happens once per launch; an explicit override wins over it.
  const systemTimeZone = useMemo(() => detectTimeZone(), [])

  const fontFamily = config?.fontFamily ?? 'inter'
  useEffect(() => {
    document.documentElement.dataset.font = fontFamily
  }, [fontFamily])

  // The whole window takes its colour cue from the sky. `data-tone` drives
  // the CSS washes; the shader palette is then read back out of those same
  // tokens, so both stay one palette rather than two that can drift.
  const tone = weather.snapshot
    ? toneForIcon(describeWeatherCode(weather.snapshot.weatherCode).icon)
    : 'cloud'

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'F11') {
        event.preventDefault()
        window.api.window.toggleFullScreen()
      }
      // Settings owns Escape while it is open.
      if (event.key === 'Escape' && fullScreen && !settingsOpen) {
        window.api.window.toggleFullScreen()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [fullScreen, settingsOpen])

  if (!config) {
    // A single frame at most, and the window is already painted in the
    // theme's base colour, so there is nothing to see here.
    return <div className="drag h-full" />
  }

  const timeZone = config.timezoneOverride ?? systemTimeZone
  const hour12 = resolveHour12(config.hourCycle)

  return (
    <div className="relative h-full overflow-hidden">
      <Background choice={config.background} palette={palette} />

      {/*
        Three rows, the middle one sized to its content: that puts the clock
        at the exact centre of the window and keeps it there, whatever the
        weather strip below happens to contain.
      */}
      <main className="relative grid h-full grid-rows-[1fr_auto_1fr] px-10">
        <div aria-hidden />

        <div className="flex items-center justify-center">
          <Clock timeZone={timeZone} hour12={hour12} />
        </div>

        <div className="flex items-start justify-center pt-[clamp(2rem,6vh,4.5rem)]">
          <WeatherStrip
            state={weather}
            unit={config.temperatureUnit}
            timeZone={timeZone}
            hour12={hour12}
          />
        </div>
      </main>

      <TitleBar
        place={shortLocation(config.location)}
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
