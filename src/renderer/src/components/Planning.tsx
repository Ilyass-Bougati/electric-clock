import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode
} from 'react'
import { Check, ChevronLeft, ChevronRight, Plus, Repeat, Trash2, X } from 'lucide-react'
import {
  MAX_PLAN_EVENTS,
  MAX_PLAN_TITLE,
  PLAN_COLORS,
  type PlanColor,
  type PlanEvent,
  type PlanRepeat
} from '@shared/types'
import { cn } from '../lib/cn'
import {
  COLOR_LABEL,
  createDayFormatter,
  createPlanTimeFormatter,
  createWallClockFormatter,
  eventsOn,
  formatPlanRange,
  layoutDay,
  occursOn,
  parseWallClock,
  planColorVar,
  readWallClock,
  REPEAT_LABEL,
  shiftDay,
  weekDays,
  weekStart,
  type PlacedEvent,
  type WallClock
} from '../lib/planning'
import { useClockValue } from '../lib/useClockValue'
import { Segmented } from './Segmented'

/** One hour of the grid, in CSS pixels. Clicks are mapped back in the same unit. */
const HOUR_PX = 48
const DAY_MINUTES = 24 * 60
/** The shortest a block is drawn, so a five-minute entry still has a title. */
const MIN_BLOCK_PX = 22

/**
 * The hour gutter plus seven days, shared by the header row and the body so
 * the two line up. The gutter is sized in the meta scale its labels are set
 * in, and 12-hour labels ("01:00 PM") need it wider.
 */
const COLUMNS_24H = 'grid grid-cols-[calc(var(--size-meta)*3.8)_repeat(7,minmax(0,1fr))]'
const COLUMNS_12H = 'grid grid-cols-[calc(var(--size-meta)*5.6)_repeat(7,minmax(0,1fr))]'

/**
 * Both the header and the grid reserve the same scrollbar gutter -- the
 * header has nothing to scroll, but holding the space keeps its days exactly
 * above their columns.
 */
const GUTTERED = 'scroll-thin [scrollbar-gutter:stable]'

const REPEATS = [
  { value: 'none', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' }
] as const satisfies ReadonlyArray<{ value: PlanRepeat; label: string }>

const FIELD =
  'transition-soft w-full rounded-xl bg-hover px-3.5 py-2.5 text-meta font-medium text-fg placeholder:font-normal placeholder:text-fg-faint'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function fromMinutes(minutes: number): string {
  const clamped = Math.max(0, Math.min(DAY_MINUTES - 1, minutes))
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`
}

/** The form's own state: blank strings where the stored entry has nulls. */
interface Draft {
  title: string
  date: string
  start: string
  end: string
  repeat: PlanRepeat
  color: PlanColor
}

interface EditorState {
  editing: PlanEvent | null
  draft: Draft
  /** Once a colour has been chosen by hand, a matching title stops overriding it. */
  colorChosen: boolean
}

function draftFrom(event: PlanEvent): Draft {
  return {
    title: event.title,
    date: event.date,
    start: event.start,
    end: event.end ?? '',
    repeat: event.repeat,
    color: event.color
  }
}

interface IconButtonProps {
  label: string
  onClick: () => void
  children: ReactNode
}

function IconButton({ label, onClick, children }: IconButtonProps): ReactNode {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="transition-soft grid size-8 shrink-0 place-items-center rounded-[0.625rem] text-fg-faint hover:bg-hover hover:text-fg"
    >
      {children}
    </button>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-meta text-fg-faint">{label}</span>
      {children}
    </label>
  )
}

interface BlockProps {
  placed: PlacedEvent
  past: boolean
  formatTime: (time: string) => string
  onPick: (event: PlanEvent) => void
}

/**
 * A tint of the entry's colour with a solid edge, the way a highlighter
 * marks a printed timetable. The text stays the theme's own colour, so it
 * reads the same on all eight.
 *
 * Each block is its own size container: what fits depends on the block's
 * real width -- a narrow window, or two entries sharing a slot -- so a
 * narrow one drops to the start time and never breaks a word in half.
 */
function Block({ placed, past, formatTime, onPick }: BlockProps): ReactNode {
  const { event, start, end, lane, lanes } = placed
  const height = Math.max(((end - start) / 60) * HOUR_PX, MIN_BLOCK_PX)
  const range = formatPlanRange(event, formatTime)

  const style = {
    '--plan': planColorVar(event.color),
    top: (start / 60) * HOUR_PX + 1,
    height: height - 2,
    left: `calc(${(lane / lanes) * 100}% + 2px)`,
    width: `calc(${100 / lanes}% - 4px)`
  } as CSSProperties

  return (
    <button
      type="button"
      title={[range, event.title, event.repeat === 'none' ? null : REPEAT_LABEL[event.repeat]]
        .filter(Boolean)
        .join(' · ')}
      onClick={(click) => {
        // The column underneath would otherwise read this as "new entry here".
        click.stopPropagation()
        onPick(event)
      }}
      style={style}
      className={cn(
        '@container transition-soft absolute flex flex-col overflow-hidden rounded-lg py-1 pl-2 pr-1 text-left',
        'bg-[color-mix(in_oklab,var(--plan)_22%,transparent)] shadow-[inset_3px_0_0_var(--plan)]',
        'hover:bg-[color-mix(in_oklab,var(--plan)_34%,transparent)]',
        past && 'opacity-55'
      )}
    >
      {/* Wraps between words only; a word wider than the block is clipped
          by its edge rather than split across lines. */}
      <span
        className={cn(
          'text-meta font-medium leading-tight text-fg',
          event.repeat !== 'none' && '@min-[5.25rem]:pr-4'
        )}
      >
        {event.title}
      </span>
      <span className="hidden truncate text-meta leading-tight tabular-nums text-fg-muted @min-[5.25rem]:block">
        {range}
      </span>
      <span className="truncate text-meta leading-tight tabular-nums text-fg-muted @min-[5.25rem]:hidden">
        {formatTime(event.start)}
      </span>
      {event.repeat === 'none' ? null : (
        <Repeat
          className="absolute right-1.5 top-1.5 hidden size-3 text-fg-faint @min-[5.25rem]:block"
          strokeWidth={2}
          aria-hidden
        />
      )}
    </button>
  )
}

interface TimetableProps {
  days: string[]
  events: readonly PlanEvent[]
  now: WallClock
  hour12: boolean
  formatTime: (time: string) => string
  onSlot: (day: string, minute: number) => void
  onPick: (event: PlanEvent) => void
}

function Timetable({
  days,
  events,
  now,
  hour12,
  formatTime,
  onSlot,
  onPick
}: TimetableProps): ReactNode {
  const scroller = useRef<HTMLDivElement>(null)
  const formatWeekday = useMemo(() => createDayFormatter({ weekday: 'short' }), [])
  const formatDate = useMemo(() => createDayFormatter({ day: 'numeric' }), [])
  const columns = useMemo(
    () => days.map((day) => ({ day, placed: layoutDay(eventsOn(events, day)) })),
    [days, events]
  )
  const grid = hour12 ? COLUMNS_12H : COLUMNS_24H

  // Opens on the week's earliest entry, or the current hour, instead of at
  // midnight. Only when the week changes: saving an entry must not yank the
  // grid away from where it was being looked at.
  useLayoutEffect(() => {
    const element = scroller.current
    if (!element) return
    const starts = columns.flatMap((column) => column.placed.map((placed) => placed.start))
    const anchor =
      starts.length > 0 ? Math.min(...starts) : days.includes(now.day) ? now.minute : 8 * 60
    element.scrollTop = Math.max(0, (Math.floor(anchor / 60) - 0.5) * HOUR_PX)
  }, [days])

  const slot = (day: string) => (click: MouseEvent<HTMLDivElement>) => {
    const rect = click.currentTarget.getBoundingClientRect()
    const minute = ((click.clientY - rect.top) / HOUR_PX) * 60
    // Snapped to the half hour the click fell in.
    onSlot(day, Math.floor(minute / 30) * 30)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn(grid, GUTTERED, 'shrink-0 overflow-y-hidden border-b border-hover')}>
        <div />
        {days.map((day) => (
          <div key={day} className="flex min-w-0 flex-col items-center gap-1 py-2.5">
            <span className="label-meta truncate">{formatWeekday(day)}</span>
            <span
              className={cn(
                'grid size-7 place-items-center rounded-full text-meta font-medium tabular-nums',
                day === now.day ? 'bg-accent text-accent-fg' : 'text-fg'
              )}
            >
              {formatDate(day)}
            </span>
          </div>
        ))}
      </div>

      <div ref={scroller} className={cn(GUTTERED, 'min-h-0 flex-1 overflow-y-auto')}>
        <div className={cn(grid, 'relative')} style={{ height: 24 * HOUR_PX }}>
          <div className="relative">
            {Array.from({ length: 23 }, (_, index) => index + 1).map((hour) => (
              <span
                key={hour}
                className="absolute right-2.5 -translate-y-1/2 text-meta tabular-nums text-fg-faint"
                style={{ top: hour * HOUR_PX }}
              >
                {formatTime(`${pad(hour)}:00`)}
              </span>
            ))}
          </div>
  
          {columns.map(({ day, placed }) => {
            const isToday = day === now.day
            return (
              <div
                key={day}
                onClick={slot(day)}
                title="Click to add an entry here"
                className={cn(
                  'relative border-l border-hover',
                  // One faint rule per hour, drawn by the background rather than
                  // by 24 elements per day.
                  'bg-[linear-gradient(to_bottom,var(--hover)_1px,transparent_1px)] bg-[length:100%_48px]',
                  isToday && 'bg-hover'
                )}
              >
                {placed.map((entry) => (
                  <Block
                    key={entry.event.id}
                    placed={entry}
                    past={day < now.day || (isToday && entry.end <= now.minute)}
                    formatTime={formatTime}
                    onPick={onPick}
                  />
                ))}
  
                {isToday ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 z-[1] h-0.5 bg-[var(--plan-red)]"
                    style={{ top: (now.minute / 60) * HOUR_PX }}
                  >
                    <span className="absolute -left-1 -top-[3px] size-2 rounded-full bg-[var(--plan-red)]" />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface EntryEditorProps {
  state: EditorState
  events: readonly PlanEvent[]
  onChange: (state: EditorState) => void
  onSave: (entry: PlanEvent, editing: PlanEvent | null) => void
  onDelete: (event: PlanEvent) => void
  onCancel: () => void
}

function EntryEditor({
  state,
  events,
  onChange,
  onSave,
  onDelete,
  onCancel
}: EntryEditorProps): ReactNode {
  const { editing, draft, colorChosen } = state
  const formatDay = useMemo(
    () => createDayFormatter({ weekday: 'long', day: 'numeric', month: 'long' }),
    []
  )
  const formatWeekday = useMemo(() => createDayFormatter({ weekday: 'long' }), [])

  const setDraft = (patch: Partial<Draft>): void =>
    onChange({ ...state, draft: { ...draft, ...patch } })

  // Typing the name of something already planned picks up its colour, so the
  // same class keeps the same colour across the week without thinking about it.
  const setTitle = (title: string): void => {
    const key = title.trim().toLowerCase()
    const twin = colorChosen
      ? undefined
      : events.find((event) => event.id !== editing?.id && event.title.toLowerCase() === key)
    setDraft(twin ? { title, color: twin.color } : { title })
  }

  const title = draft.title.trim()
  // Both are zero-padded `HH:MM`, so the strings compare as times.
  const endsTooEarly = draft.end !== '' && draft.end <= draft.start
  const canSave = title.length > 0 && draft.date !== '' && draft.start !== '' && !endsTooEarly

  const save = (): void => {
    if (!canSave) return
    onSave(
      {
        id: editing?.id ?? crypto.randomUUID(),
        title,
        date: draft.date,
        start: draft.start,
        end: draft.end === '' ? null : draft.end,
        repeat: draft.repeat,
        color: draft.color
      },
      editing
    )
  }

  // The weekday comes from the locale, like the clock's own date line, so it
  // is set apart rather than spliced into an English sentence.
  const repeatHint =
    draft.date === '' || draft.repeat === 'none'
      ? null
      : draft.repeat === 'weekly'
        ? `${REPEAT_LABEL.weekly} · ${formatWeekday(draft.date)}`
        : `${REPEAT_LABEL.daily} · ${formatDay(draft.date)} →`

  return (
    <div
      className="animate-overlay absolute inset-0 z-30 flex items-center justify-center p-6"
      style={{ backgroundColor: 'var(--scrim)' }}
      onClick={onCancel}
    >
      <form
        aria-label={editing ? 'Edit entry' : 'New entry'}
        onClick={(click) => click.stopPropagation()}
        onSubmit={(submit) => {
          submit.preventDefault()
          save()
        }}
        className="animate-panel scroll-thin flex max-h-full w-full max-w-[28rem] flex-col gap-4 overflow-y-auto rounded-[1.5rem] bg-raised p-6 shadow-[var(--shadow-panel)]"
      >
        <div className="flex items-center justify-between gap-4">
          <h3 className="label-meta">{editing ? 'Edit entry' : 'New entry'}</h3>
          <IconButton label="Cancel" onClick={onCancel}>
            <X className="size-4" strokeWidth={1.75} />
          </IconButton>
        </div>

        <input
          type="text"
          value={draft.title}
          maxLength={MAX_PLAN_TITLE}
          onChange={(change) => setTitle(change.target.value)}
          placeholder="What's on?"
          aria-label="Title"
          autoFocus={editing === null}
          className={FIELD}
        />

        <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <Field label="Date">
            <input
              type="date"
              required
              value={draft.date}
              onChange={(change) => setDraft({ date: change.target.value })}
              className={FIELD}
            />
          </Field>
          <Field label="Start">
            <input
              type="time"
              required
              value={draft.start}
              onChange={(change) => setDraft({ start: change.target.value })}
              className={FIELD}
            />
          </Field>
          <Field label="End">
            <input
              type="time"
              value={draft.end}
              onChange={(change) => setDraft({ end: change.target.value })}
              className={FIELD}
            />
          </Field>
        </div>

        <div role="radiogroup" aria-label="Colour" className="flex flex-wrap items-center gap-2.5">
          {PLAN_COLORS.map((color) => {
            const chosen = color === draft.color
            return (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={chosen}
                aria-label={COLOR_LABEL[color]}
                title={COLOR_LABEL[color]}
                onClick={() =>
                  onChange({ ...state, colorChosen: true, draft: { ...draft, color } })
                }
                style={{ backgroundColor: planColorVar(color) }}
                className={cn(
                  'transition-soft grid size-7 place-items-center rounded-full',
                  chosen ? 'ring-2 ring-fg ring-offset-2 ring-offset-raised' : 'hover:scale-110'
                )}
              >
                {chosen ? <Check className="size-3.5 text-bg" strokeWidth={3} aria-hidden /> : null}
              </button>
            )
          })}
        </div>

        {/* Wrapped so the control keeps its own width instead of stretching. */}
        <div>
          <Segmented
            label="Repeat"
            value={draft.repeat}
            options={REPEATS}
            onChange={(repeat) => setDraft({ repeat })}
          />
        </div>

        {repeatHint ? <p className="-mt-1 truncate text-meta text-fg-faint">{repeatHint}</p> : null}
        {endsTooEarly ? (
          <p className="text-meta text-fg-faint">The end time has to come after the start.</p>
        ) : null}

        <div className="flex items-center justify-between gap-2 pt-1">
          {editing ? (
            <button
              type="button"
              onClick={() => onDelete(editing)}
              className="transition-soft flex items-center gap-1.5 rounded-full px-3 py-2 text-meta font-medium text-fg-muted hover:bg-hover hover:text-fg"
            >
              <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
              {editing.repeat === 'none'
                ? 'Delete'
                : `Delete (${REPEAT_LABEL[editing.repeat].toLowerCase()})`}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="transition-soft rounded-full px-4 py-2 text-meta font-medium text-fg-muted hover:bg-hover hover:text-fg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className={cn(
                'transition-soft rounded-full px-4 py-2 text-meta font-medium',
                canSave ? 'bg-accent text-accent-fg' : 'bg-hover text-fg-faint'
              )}
            >
              {editing ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

interface PlanningProps {
  events: readonly PlanEvent[]
  timeZone: string
  hour12: boolean
  onChange: (events: PlanEvent[]) => void
  onClose: () => void
}

/**
 * The week as a timetable: a column per day, an hour per row, each entry a
 * block of its colour. Clicking an empty slot starts an entry there;
 * clicking a block edits it.
 */
export function Planning({ events, timeZone, hour12, onChange, onClose }: PlanningProps): ReactNode {
  const wallClock = useMemo(() => createWallClockFormatter(timeZone), [timeZone])
  const read = useCallback((at: number) => readWallClock(wallClock, at), [wallClock])
  // Minute resolution: the "now" line moves, and the panel re-renders, once a minute.
  const now = parseWallClock(useClockValue(read))
  const thisWeek = weekStart(now.day)

  const [week, setWeek] = useState(thisWeek)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const editorOpen = editor !== null

  // Escape backs out one layer at a time: the entry first, then the panel.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (editorOpen) setEditor(null)
      else onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [editorOpen, onClose])

  const formatTime = useMemo(() => createPlanTimeFormatter(hour12), [hour12])
  const formatShort = useMemo(() => createDayFormatter({ day: 'numeric', month: 'short' }), [])
  const formatLong = useMemo(
    () => createDayFormatter({ day: 'numeric', month: 'short', year: 'numeric' }),
    []
  )
  const days = useMemo(() => weekDays(week), [week])
  const full = events.length >= MAX_PLAN_EVENTS

  const startEntry = (date: string, start: number): void => {
    if (full) return
    setEditor({
      editing: null,
      colorChosen: false,
      draft: {
        title: '',
        date,
        start: fromMinutes(start),
        end: fromMinutes(start + 60),
        repeat: 'none',
        // Cycled, so entries added one after another come out distinguishable.
        color: PLAN_COLORS[events.length % PLAN_COLORS.length]
      }
    })
  }

  const save = (entry: PlanEvent, editing: PlanEvent | null): void => {
    onChange(
      editing ? events.map((event) => (event.id === entry.id ? entry : event)) : [...events, entry]
    )
    // Follow the entry if it landed outside the week on show, so it never seems to vanish.
    if (!days.some((day) => occursOn(entry, day))) setWeek(weekStart(entry.date))
    setEditor(null)
  }

  const remove = (target: PlanEvent): void => {
    onChange(events.filter((event) => event.id !== target.id))
    setEditor(null)
  }

  return (
    // Same overlay as Settings: `no-drag` keeps the scrim from dragging the window.
    <div
      className="no-drag animate-overlay fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-[14px]"
      style={{ backgroundColor: 'var(--scrim)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Planning"
        onClick={(event) => event.stopPropagation()}
        className="animate-panel glass-panel transition-soft flex h-full w-full max-w-[76rem] flex-col overflow-hidden rounded-[1.75rem]"
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 px-7 pb-4 pt-6">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
            <h2 className="text-body font-medium text-fg">Planning</h2>
            <div className="flex items-center gap-1">
              <IconButton label="Previous week" onClick={() => setWeek(shiftDay(week, -7))}>
                <ChevronLeft className="size-4" strokeWidth={1.75} />
              </IconButton>
              <span className="px-1 text-meta font-medium tabular-nums text-fg-muted">
                {formatShort(days[0])} – {formatLong(days[6])}
              </span>
              <IconButton label="Next week" onClick={() => setWeek(shiftDay(week, 7))}>
                <ChevronRight className="size-4" strokeWidth={1.75} />
              </IconButton>
            </div>
            {week === thisWeek ? null : (
              <button
                type="button"
                onClick={() => setWeek(thisWeek)}
                className="transition-soft rounded-full bg-hover px-3.5 py-1.5 text-meta font-medium text-fg-muted hover:text-fg"
              >
                This week
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={full}
              title={full ? `The planning holds ${MAX_PLAN_EVENTS} entries` : undefined}
              onClick={() =>
                startEntry(
                  days.includes(now.day) ? now.day : days[0],
                  // The next whole hour, so a fresh entry starts in the future.
                  Math.min(23, Math.floor(now.minute / 60) + 1) * 60
                )
              }
              className={cn(
                'transition-soft flex items-center gap-1.5 rounded-full px-4 py-2 text-meta font-medium',
                full ? 'bg-hover text-fg-faint' : 'bg-accent text-accent-fg'
              )}
            >
              <Plus className="size-3.5" strokeWidth={2} aria-hidden />
              New
            </button>
            <IconButton label="Close planning" onClick={onClose}>
              <X className="size-4" strokeWidth={1.75} />
            </IconButton>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
          <Timetable
            days={days}
            events={events}
            now={now}
            hour12={hour12}
            formatTime={formatTime}
            onSlot={startEntry}
            onPick={(event) => setEditor({ editing: event, colorChosen: true, draft: draftFrom(event) })}
          />
        </div>

        {editor ? (
          <EntryEditor
            state={editor}
            events={events}
            onChange={setEditor}
            onSave={save}
            onDelete={remove}
            onCancel={() => setEditor(null)}
          />
        ) : null}
      </div>
    </div>
  )
}
