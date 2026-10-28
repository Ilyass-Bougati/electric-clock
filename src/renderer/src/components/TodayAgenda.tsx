import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AllDayExternalEvent } from '@shared/types'
import { cn } from '../lib/cn'
import {
  allDayOn,
  createPlanTimeFormatter,
  createWallClockFormatter,
  eventsOn,
  formatPlanRange,
  parseWallClock,
  phaseAt,
  planColorVar,
  readWallClock,
  type ShownEvent
} from '../lib/planning'
import { useClockValue } from '../lib/useClockValue'

interface TodayAgendaProps {
  /** Local entries and Google's timed events, already in the clock's zone. */
  events: readonly ShownEvent[]
  /** Google's all-day events, which sit above the timed ones all day long. */
  allDay: readonly AllDayExternalEvent[]
  timeZone: string
  hour12: boolean
  onOpen: () => void
}

/**
 * What is left of today, under the weather. Entries drop off as they end, so
 * a glance from across the room lands on what is on now and what comes next
 * rather than on a morning that is already over.
 *
 * Set in the body scale like the weather readings, and allowed to shrink:
 * when the window is short, the rows that do not fit are left out and
 * counted in the header instead of pushing the clock out of place.
 */
export function TodayAgenda({
  events,
  allDay,
  timeZone,
  hour12,
  onOpen
}: TodayAgendaProps): ReactNode {
  const wallClock = useMemo(() => createWallClockFormatter(timeZone), [timeZone])
  const read = useCallback((at: number) => readWallClock(wallClock, at), [wallClock])
  const { day, minute } = parseWallClock(useClockValue(read))
  const formatTime = useMemo(() => createPlanTimeFormatter(hour12), [hour12])

  const today = useMemo(() => eventsOn(events, day), [events, day])
  const ahead = today.filter((event) => phaseAt(event, minute) !== 'done')
  const done = today.length - ahead.length
  const allDayToday = useMemo(() => allDayOn(allDay, day), [allDay, day])
  const rows = allDayToday.length + ahead.length

  const list = useRef<HTMLOListElement>(null)
  const [fitting, setFitting] = useState(Number.POSITIVE_INFINITY)

  // A row the bottom edge would cut through is hidden whole, never shown in
  // half. Re-measured whenever the space changes -- resizing, zoom, full screen.
  useLayoutEffect(() => {
    const element = list.current
    if (!element) return
    const measure = (): void => {
      let count = 0
      for (const row of Array.from(element.children)) {
        if (!(row instanceof HTMLElement)) break
        // A pixel of slack for rounding between the two measurements.
        if (row.offsetTop + row.offsetHeight > element.clientHeight + 1) break
        count += 1
      }
      setFitting(count)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [rows])

  const hidden = Math.max(0, rows - fitting)
  const summary = [done > 0 ? `${done} done` : null, hidden > 0 ? `+${hidden} later` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <section
      aria-label="Today's planning"
      className="flex min-h-0 w-[min(100%,26em)] flex-col gap-[0.5em] text-body"
    >
      <div className="flex shrink-0 items-baseline justify-between gap-4 px-[0.2em]">
        <h2 className="label-meta">Today</h2>
        {summary ? <span className="text-meta text-fg-faint">{summary}</span> : null}
      </div>

      {rows === 0 ? (
        <button
          type="button"
          onClick={onOpen}
          className="transition-soft self-start px-[0.2em] text-meta font-medium text-fg-faint hover:text-fg-muted"
        >
          {today.length === 0 ? 'Nothing planned — add something' : 'All done for today'}
        </button>
      ) : (
        <ol
          ref={list}
          className="relative flex min-h-0 flex-col gap-[0.3em] overflow-hidden px-[0.2em] leading-tight"
        >
          {allDayToday.map((event, index) => (
            <li
              key={event.id}
              className={cn('flex shrink-0 items-center gap-[0.7em]', index >= fitting && 'invisible')}
            >
              <span
                aria-hidden
                className="size-[0.42em] shrink-0 rounded-full"
                style={{ backgroundColor: planColorVar(event.color) }}
              />
              <span
                className={cn(
                  'display-face shrink-0 text-fg-faint',
                  hour12 ? 'min-w-[17ch]' : 'min-w-[11ch]'
                )}
              >
                All day
              </span>
              <span className="min-w-0 truncate font-medium text-fg-muted">{event.title}</span>
            </li>
          ))}
          {ahead.map((event, order) => {
            const now = phaseAt(event, minute) === 'now'
            const index = allDayToday.length + order
            return (
              <li
                key={event.id}
                className={cn(
                  'flex shrink-0 items-center gap-[0.7em]',
                  index >= fitting && 'invisible'
                )}
              >
                {/* Each entry's timetable colour, at full strength only for
                    what is happening right now. */}
                <span
                  aria-hidden
                  className={cn('size-[0.42em] shrink-0 rounded-full', !now && 'opacity-45')}
                  style={{ backgroundColor: planColorVar(event.color) }}
                />
                <span
                  className={cn(
                    'display-face shrink-0 tabular-nums',
                    hour12 ? 'min-w-[17ch]' : 'min-w-[11ch]',
                    now ? 'text-fg-muted' : 'text-fg-faint'
                  )}
                >
                  {formatPlanRange(event, formatTime)}
                </span>
                <span
                  className={cn('min-w-0 truncate font-medium', now ? 'text-fg' : 'text-fg-muted')}
                >
                  {event.title}
                </span>
                {now ? <span className="sr-only">(now)</span> : null}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
