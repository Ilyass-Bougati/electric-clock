import { useMemo, type ReactNode } from 'react'
import type { TemperatureUnit, WeatherState } from '@shared/types'
import { describeWeatherCode } from '@shared/weather-codes'
import { formatHumidity, formatTemperature } from '../lib/units'
import { createShortTimeFormatter } from '../lib/time'
import { HumidityGlyph, UvGlyph, WeatherGlyph } from './WeatherGlyph'

/**
 * No surface of its own -- it lifts off the page purely by blurring it.
 * Sized in em from the body scale so the whole strip grows with the clock
 * rather than staying a postage stamp on a full-screen display.
 */
function Pill({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="glass display-face flex items-center rounded-full text-body px-[1.45em] py-[0.6em]">
      {children}
    </div>
  )
}

/**
 * Set at the same size and contrast as the temperature. These are readings
 * you glance at from across a room, not footnotes to the temperature.
 */
function Reading({ glyph, value, label }: { glyph: ReactNode; value: string; label: string }): ReactNode {
  return (
    <span className="flex items-center gap-[0.45em] text-body text-fg" title={label}>
      {glyph}
      <span className="font-medium">{value}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}

interface WeatherStripProps {
  state: WeatherState
  unit: TemperatureUnit
  timeZone: string
  hour12: boolean
}

export function WeatherStrip({ state, unit, timeZone, hour12 }: WeatherStripProps): ReactNode {
  const shortTime = useMemo(() => createShortTimeFormatter(timeZone, hour12), [timeZone, hour12])

  const { snapshot, status } = state

  if (!snapshot) {
    return (
      <Pill>
        {status === 'error' ? (
          <button
            type="button"
            onClick={() => void window.api.weather.refresh()}
            title="Retry now"
            className="text-meta font-medium text-fg-faint transition-soft hover:text-fg-muted"
          >
            {state.error ?? 'Weather unavailable'}
          </button>
        ) : (
          <span className="text-meta font-medium text-fg-faint">Loading weather</span>
        )}
      </Pill>
    )
  }

  const condition = describeWeatherCode(snapshot.weatherCode)

  return (
    <div className="flex flex-col items-center gap-2.5">
      <Pill>
        <div className="flex items-center gap-[0.45em]" title={condition.label}>
          <WeatherGlyph icon={condition.icon} className="size-[1.7em] shrink-0" />
          <span className="text-body font-medium text-fg">
            {formatTemperature(snapshot.temperatureC, unit)}
          </span>
          {/* Feels-like, in parentheses, subordinate to the real reading. */}
          <span className="text-body font-normal text-fg-faint">
            ({formatTemperature(snapshot.apparentTemperatureC, unit)})
          </span>
          <span className="sr-only">{condition.label}</span>
        </div>

        <div className="flex items-center gap-[1.5em] pl-[3.2em]">
          <Reading
            glyph={<UvGlyph className="size-[1.55em] shrink-0" />}
            value={String(Math.round(snapshot.uvIndex))}
            label={`UV index ${Math.round(snapshot.uvIndex)}`}
          />
          <Reading
            glyph={<HumidityGlyph className="size-[1.55em] shrink-0" />}
            value={formatHumidity(snapshot.humidity)}
            label={`Humidity ${formatHumidity(snapshot.humidity)}`}
          />
        </div>
      </Pill>

      {status === 'stale' ? (
        // The cached reading stays on screen; this is the only hint that the
        // last refresh did not land, and the only way to ask again early.
        <button
          type="button"
          onClick={() => void window.api.weather.refresh()}
          title={state.error ? `${state.error} — click to retry` : 'Retry now'}
          className="transition-soft rounded-full px-3 py-1 text-meta font-medium text-fg-faint hover:text-fg-muted"
        >
          Last updated {shortTime.format(snapshot.fetchedAt)}
        </button>
      ) : null}
    </div>
  )
}
