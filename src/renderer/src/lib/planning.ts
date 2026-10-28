import type {
  AllDayExternalEvent,
  ExternalEvent,
  PlanColor,
  PlanEvent,
  PlanRepeat
} from '@shared/types'
import { createShortTimeFormatter } from './time'

/**
 * The planning works in day keys (`YYYY-MM-DD`) and minutes since midnight,
 * both read in the clock's zone. Day arithmetic runs on UTC dates used purely
 * as a calendar: no zone ever touches them, so a DST change can neither skip
 * nor repeat a day.
 */

export interface WallClock {
  day: string
  minute: number
}

export function createWallClockFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    // As in lib/time: 'h23' keeps midnight at 00 rather than 24.
    hourCycle: 'h23'
  })
}

/**
 * `YYYY-MM-DD HH:MM`. A string on purpose: handed to useClockValue it changes
 * once a minute, so whatever reads it re-renders once a minute too.
 */
export function readWallClock(formatter: Intl.DateTimeFormat, at: number): string {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {}
  for (const part of formatter.formatToParts(at)) parts[part.type] = part.value
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
}

export function parseWallClock(value: string): WallClock {
  const [day, time] = value.split(' ')
  return { day, minute: toMinutes(time) }
}

export function currentWallClock(timeZone: string): WallClock {
  return parseWallClock(readWallClock(createWallClockFormatter(timeZone), Date.now()))
}

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function toCalendar(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date))
}

export function shiftDay(day: string, delta: number): string {
  const date = toCalendar(day)
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}

/** The Monday of the week `day` falls in, as a timetable reads in Morocco and France. */
export function weekStart(day: string): string {
  // getUTCDay counts from Sunday; this counts from Monday.
  return shiftDay(day, -((toCalendar(day).getUTCDay() + 6) % 7))
}

export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, index) => shiftDay(monday, index))
}

export function occursOn(event: PlanEvent, day: string): boolean {
  if (event.repeat === 'none') return event.date === day
  // Zero-padded keys compare as dates.
  if (day < event.date) return false
  if (event.repeat === 'daily') return true
  return toCalendar(day).getUTCDay() === toCalendar(event.date).getUTCDay()
}

export function eventsOn<T extends PlanEvent>(events: readonly T[], day: string): T[] {
  return events
    .filter((event) => occursOn(event, day))
    .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title))
}

/**
 * How long an entry with no end time stays up after it starts. Without one,
 * a 14:00 reminder would vanish at 14:01 -- before anyone looked up.
 */
const MOMENT_MINUTES = 30

/** Minutes since midnight at which the entry is over. */
export function endMinute(event: PlanEvent): number {
  return event.end ? toMinutes(event.end) : toMinutes(event.start) + MOMENT_MINUTES
}

export type PlanPhase = 'done' | 'now' | 'later'

export function phaseAt(event: PlanEvent, minute: number): PlanPhase {
  if (minute >= endMinute(event)) return 'done'
  if (minute >= toMinutes(event.start)) return 'now'
  return 'later'
}

export interface PlacedEvent {
  event: ShownEvent
  start: number
  end: number
  /** Which of the side-by-side columns this entry takes... */
  lane: number
  /** ...out of how many its overlapping group needs. */
  lanes: number
}

/**
 * Lays a day's entries out the way a paper timetable would: entries that
 * overlap share the width side by side, and each group of overlaps is
 * split only as many ways as it actually needs.
 */
export function layoutDay(events: readonly ShownEvent[]): PlacedEvent[] {
  const items = events
    .map((event) => ({ event, start: toMinutes(event.start), end: endMinute(event) }))
    .sort((a, b) => a.start - b.start || b.end - a.end)

  const placed: PlacedEvent[] = []
  let group: PlacedEvent[] = []
  let groupEnd = -1
  // When each lane of the current group frees up again.
  const laneEnds: number[] = []

  const closeGroup = (): void => {
    for (const entry of group) entry.lanes = laneEnds.length
    group = []
    laneEnds.length = 0
  }

  for (const item of items) {
    if (item.start >= groupEnd) closeGroup()
    let lane = laneEnds.findIndex((end) => end <= item.start)
    if (lane === -1) lane = laneEnds.push(item.end) - 1
    else laneEnds[lane] = item.end

    const entry: PlacedEvent = { ...item, lane, lanes: 1 }
    group.push(entry)
    placed.push(entry)
    groupEnd = Math.max(groupEnd, item.end)
  }
  closeGroup()

  return placed
}

/** The theme-tuned token for a colour; see `--plan-*` in styles.css. */
export function planColorVar(color: PlanColor): string {
  return `var(--plan-${color})`
}

export const COLOR_LABEL: Record<PlanColor, string> = {
  blue: 'Blue',
  teal: 'Teal',
  green: 'Green',
  amber: 'Amber',
  orange: 'Orange',
  red: 'Red',
  pink: 'Pink',
  violet: 'Violet'
}

/** A stored `HH:MM`, written out in the app's 12- or 24-hour style. */
export function createPlanTimeFormatter(hour12: boolean): (time: string) => string {
  // UTC on both sides, so the formatter reads back exactly the hour it was given.
  const formatter = createShortTimeFormatter('UTC', hour12)
  return (time) => {
    const [hours, minutes] = time.split(':').map(Number)
    return formatter.format(Date.UTC(1970, 0, 1, hours, minutes))
  }
}

export function formatPlanRange(event: PlanEvent, formatTime: (time: string) => string): string {
  return event.end ? `${formatTime(event.start)}–${formatTime(event.end)}` : formatTime(event.start)
}

export function createDayFormatter(
  options: Intl.DateTimeFormatOptions
): (day: string) => string {
  const formatter = new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' })
  return (day) => formatter.format(toCalendar(day))
}

export const REPEAT_LABEL: Record<PlanRepeat, string> = {
  none: 'Once',
  daily: 'Every day',
  weekly: 'Every week'
}

/**
 * An entry as the timetable and agenda show it. Google events are folded
 * into the same shape so the layout code never has to tell them apart --
 * only clicking one does.
 */
export type ShownEvent = PlanEvent & { source?: 'google'; link?: string | null }

function minutesToTime(minutes: number): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
}

/** Plenty for a multi-day conference, and a ceiling on a malformed one. */
const MAX_SEGMENT_DAYS = 31

/**
 * Google's events pinned to real instants, read in the zone the clock is
 * showing. One that runs past midnight is cut into a piece per day, the
 * first ending at `24:00` -- which `toMinutes` reads as 1440, the very end
 * of the day.
 */
export function toWallClockEvents(
  events: readonly ExternalEvent[],
  timeZone: string
): { timed: ShownEvent[]; allDay: AllDayExternalEvent[] } {
  const formatter = createWallClockFormatter(timeZone)
  const timed: ShownEvent[] = []
  const allDay: AllDayExternalEvent[] = []

  for (const event of events) {
    if (event.allDay) {
      allDay.push(event)
      continue
    }

    const from = parseWallClock(readWallClock(formatter, event.start))
    const to = parseWallClock(readWallClock(formatter, event.end))
    let day = from.day
    for (let index = 0; index < MAX_SEGMENT_DAYS && day <= to.day; index += 1) {
      const start = day === from.day ? from.minute : 0
      const end = day === to.day ? to.minute : 24 * 60
      // An event ending exactly at midnight has nothing left on the next day.
      if (day !== from.day && end === 0) break
      timed.push({
        id: `${event.id}@${day}`,
        title: event.title,
        date: day,
        start: minutesToTime(start),
        end: end > start ? minutesToTime(end) : null,
        repeat: 'none',
        color: event.color,
        source: 'google',
        link: event.link
      })
      day = shiftDay(day, 1)
    }
  }

  return { timed, allDay }
}

/** All-day events covering `day`. Their end date is exclusive, as Google sends it. */
export function allDayOn(
  events: readonly AllDayExternalEvent[],
  day: string
): AllDayExternalEvent[] {
  return events
    .filter((event) => event.startDate <= day && day < event.endDate)
    .sort((a, b) => a.title.localeCompare(b.title))
}
