import type { HourCyclePreference } from '@shared/types'

/** The zone Electron's host reports. Recomputed on demand, never cached. */
export function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** Whether this locale writes clocks as 12-hour by default. */
export function localeUsesHour12(): boolean {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 ?? false
  } catch {
    return false
  }
}

export function resolveHour12(preference: HourCyclePreference): boolean {
  if (preference === '12') return true
  if (preference === '24') return false
  return localeUsesHour12()
}

/**
 * Offsets are never added by hand anywhere in this app; Intl is handed the
 * zone and does the arithmetic.
 */
export function createTimeFormatter(timeZone: string, hour12: boolean): Intl.DateTimeFormat {
  const options: Intl.DateTimeFormatOptions = {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  }

  // hourCycle 'h23' keeps midnight at 00, where hour12:false can yield 24.
  if (hour12) options.hour12 = true
  else options.hourCycle = 'h23'

  return new Intl.DateTimeFormat(undefined, options)
}

export function createDateFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })
}

export function createShortTimeFormatter(timeZone: string, hour12: boolean): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    ...(hour12 ? { hour12: true } : { hourCycle: 'h23' as const })
  })
}

export interface ClockParts {
  digits: string
  meridiem: string
}

/**
 * Splits the formatted time into digits and day period so AM/PM can be set
 * smaller than the clock without a second formatter falling out of sync.
 */
export function splitClock(formatter: Intl.DateTimeFormat, timestamp: number): ClockParts {
  const parts = formatter.formatToParts(timestamp)

  let digits = ''
  let meridiem = ''

  for (const part of parts) {
    if (part.type === 'dayPeriod') {
      meridiem = part.value
    } else if (part.type === 'literal' && part.value.trim() === '') {
      // Spacing that only existed to separate the day period.
      continue
    } else {
      digits += part.value
    }
  }

  return { digits: digits.trim(), meridiem }
}

/** IANA zone list from ICU, with a usable fallback on older engines. */
export function listTimeZones(fallback: string): string[] {
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      const zones = Intl.supportedValuesOf('timeZone')
      if (zones.length > 0) return zones
    }
  } catch {
    // fall through
  }
  return Array.from(new Set(['UTC', fallback])).sort()
}

const offsetCache = new Map<string, string>()

/** "GMT+1" style label, so duplicate-sounding zones can be told apart. */
export function timeZoneOffsetLabel(timeZone: string): string {
  const cached = offsetCache.get(timeZone)
  if (cached !== undefined) return cached

  let label = ''
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset'
    }).formatToParts(Date.now())
    label = parts.find((part) => part.type === 'timeZoneName')?.value ?? ''
  } catch {
    label = ''
  }

  offsetCache.set(timeZone, label)
  return label
}
