import type { ReactNode } from 'react'
import { Check, RefreshCw } from 'lucide-react'
import type { CalendarState } from '@shared/types'
import { cn } from '../lib/cn'
import { planColorVar } from '../lib/planning'

const PILL = 'transition-soft shrink-0 rounded-full px-4 py-2 text-meta font-medium'

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

/** Recomputed whenever the panel re-renders -- every sync broadcasts, so it never drifts far. */
function syncedLabel(fetchedAt: number): string {
  const minutes = Math.round((Date.now() - fetchedAt) / 60_000)
  if (minutes < 60) return `Synced ${relative.format(-minutes, 'minute')}`
  return `Synced ${relative.format(-Math.round(minutes / 60), 'hour')}`
}

interface GoogleCalendarSectionProps {
  state: CalendarState
  /** The stored choice; null until the user ticks or unticks something. */
  selection: string[] | null
  onSelectionChange: (ids: string[]) => void
}

/**
 * Connects the planning to Google Calendar, read-only. Signing in happens in
 * the system browser -- Google will not allow it inside an app's own window
 * -- so while it is under way all this shows is a way to call it off.
 */
export function GoogleCalendarSection({
  state,
  selection,
  onSelectionChange
}: GoogleCalendarSectionProps): ReactNode {
  if (state.status === 'connecting') {
    return (
      <div className="flex items-center justify-between gap-6">
        <span className="text-meta text-fg-muted">Finish signing in in your browser…</span>
        <button
          type="button"
          onClick={() => window.api.calendar.cancelConnect()}
          className={cn(PILL, 'bg-hover text-fg-muted hover:text-fg')}
        >
          Cancel
        </button>
      </div>
    )
  }

  if (state.status === 'disconnected' || state.status === 'unavailable') {
    return (
      <div className="flex items-center justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-meta font-medium text-fg">Show your Google events</span>
          <span className="text-meta text-fg-faint">
            {state.error ?? 'Read-only. They appear in the planning beside your own entries.'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void window.api.calendar.connect()}
          className={cn(PILL, 'bg-accent text-accent-fg')}
        >
          Connect
        </button>
      </div>
    )
  }

  const chosen = new Set(
    selection ??
      state.calendars.filter((calendar) => calendar.selectedInGoogle).map((calendar) => calendar.id)
  )

  const toggle = (id: string): void => {
    const next = new Set(chosen)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    // Kept in Google's own order, so the stored list does not depend on click order.
    onSelectionChange(state.calendars.filter((calendar) => next.has(calendar.id)).map((c) => c.id))
  }

  const status =
    state.status === 'loading'
      ? 'Syncing…'
      : state.status === 'ok' && state.fetchedAt !== null
        ? syncedLabel(state.fetchedAt)
        : `Couldn't sync · ${state.error ?? 'unknown error'}`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-meta font-medium text-fg">
            {state.account ? `Connected as ${state.account}` : 'Connected'}
          </span>
          <span className="truncate text-meta text-fg-faint">{status}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Sync now"
            title="Sync now"
            onClick={() => void window.api.calendar.refresh()}
            className="transition-soft grid size-8 place-items-center rounded-[0.625rem] text-fg-faint hover:bg-hover hover:text-fg"
          >
            <RefreshCw
              className={cn('size-4', state.status === 'loading' && 'animate-spin')}
              strokeWidth={1.75}
            />
          </button>
          <button
            type="button"
            onClick={() => void window.api.calendar.disconnect()}
            className={cn(PILL, 'text-fg-muted hover:bg-hover hover:text-fg')}
          >
            Disconnect
          </button>
        </div>
      </div>

      {state.calendars.length > 0 ? (
        <div role="group" aria-label="Calendars to show" className="flex flex-col">
          {state.calendars.map((calendar) => {
            const on = chosen.has(calendar.id)
            return (
              <button
                key={calendar.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(calendar.id)}
                className="transition-soft flex w-full items-center gap-3 rounded-xl px-3.5 py-2 text-left hover:bg-hover"
              >
                <span
                  aria-hidden
                  className={cn(
                    'grid size-4 shrink-0 place-items-center rounded-[0.3rem] transition-soft',
                    !on && 'opacity-45'
                  )}
                  style={{ backgroundColor: planColorVar(calendar.color) }}
                >
                  {on ? <Check className="size-3 text-bg" strokeWidth={3} /> : null}
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-meta font-medium',
                    on ? 'text-fg' : 'text-fg-muted'
                  )}
                >
                  {calendar.name}
                </span>
                {calendar.primary ? (
                  <span className="shrink-0 text-meta text-fg-faint">Primary</span>
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
