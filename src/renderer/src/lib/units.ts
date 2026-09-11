import type { AppLocation, TemperatureUnit } from '@shared/types'

/** Snapshots are cached in metric, so switching units never refetches. */
export function toDisplayTemperature(celsius: number, unit: TemperatureUnit): number {
  return unit === 'fahrenheit' ? celsius * (9 / 5) + 32 : celsius
}

export function formatTemperature(celsius: number, unit: TemperatureUnit): string {
  return `${Math.round(toDisplayTemperature(celsius, unit))}°`
}

export function formatHumidity(percent: number): string {
  return `${Math.round(percent)}%`
}

/** "Casablanca, Casablanca-Settat, Morocco" -- enough to disambiguate. */
export function describeLocation(location: AppLocation | null): string {
  if (!location) return ''
  return [location.name, location.admin1, location.country].filter(Boolean).join(', ')
}

/** "Casablanca, Morocco" -- the title-bar variant, without the region. */
export function shortLocation(location: AppLocation): string {
  return [location.name, location.country].filter(Boolean).join(', ')
}
