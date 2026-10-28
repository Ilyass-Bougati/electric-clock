import {
  MAX_PLAN_TITLE,
  type CalendarState,
  type ExternalEvent,
  type GoogleCalendarInfo,
  type PlanColor
} from '@shared/types'
import { CancelledError, RevokedError, type GoogleAuth } from './google-auth'
import { describeError, getJson, HttpError, isRecord } from './http'

const API = 'https://www.googleapis.com/calendar/v3'

const POLL_INTERVAL_MS = 10 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The span of events kept on hand: a few weeks back for a glance at last
 * month, a few months ahead for planning. Weeks outside it show local
 * entries only.
 */
const PAST_DAYS = 28
const FUTURE_DAYS = 112

/** Every recurrence is its own event once expanded, so a daily standup alone is ~140. */
const MAX_EVENTS = 3000
const PAGE_SIZE = 2500

type Listener = (state: CalendarState) => void

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** The planning's eight colours, by hue, for snapping Google's free hex to one. */
const HUES: ReadonlyArray<[PlanColor, number]> = [
  ['red', 0],
  ['orange', 22],
  ['amber', 45],
  ['green', 135],
  ['teal', 180],
  ['blue', 220],
  ['violet', 270],
  ['pink', 330]
]

function nearestColor(hex: unknown): PlanColor {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return 'blue'
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  // Grey has no hue to speak of; it gets the planning's quietest colour.
  if (delta < 0.08) return 'blue'

  let hue =
    max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
  hue = (hue * 60 + 360) % 360

  let best: PlanColor = 'blue'
  let bestDistance = Infinity
  for (const [color, target] of HUES) {
    const raw = Math.abs(hue - target)
    const distance = Math.min(raw, 360 - raw)
    if (distance < bestDistance) {
      best = color
      bestDistance = distance
    }
  }
  return best
}

/**
 * Google's fixed per-event colours (Lavender, Sage, Grape...), by `colorId`.
 * Graphite has no counterpart and falls back to the calendar's colour.
 */
const EVENT_COLORS: Record<string, PlanColor> = {
  '1': 'violet',
  '2': 'green',
  '3': 'violet',
  '4': 'pink',
  '5': 'amber',
  '6': 'orange',
  '7': 'teal',
  '9': 'blue',
  '10': 'green',
  '11': 'red'
}

function nextDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date + 1)).toISOString().slice(0, 10)
}

function parseCalendar(entry: unknown): GoogleCalendarInfo | null {
  if (!isRecord(entry) || typeof entry.id !== 'string' || entry.hidden === true) return null
  const name = [entry.summaryOverride, entry.summary].find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  )
  return {
    id: entry.id,
    name: name ?? entry.id,
    color: nearestColor(entry.backgroundColor),
    primary: entry.primary === true,
    selectedInGoogle: entry.selected === true
  }
}

function parseEvent(entry: unknown, calendar: GoogleCalendarInfo): ExternalEvent | null {
  if (!isRecord(entry) || typeof entry.id !== 'string') return null
  if (entry.status === 'cancelled') return null
  // "Working from home" markers fill every day and say nothing about the day.
  if (entry.eventType === 'workingLocation') return null
  const declined =
    Array.isArray(entry.attendees) &&
    entry.attendees.some(
      (attendee) => isRecord(attendee) && attendee.self === true && attendee.responseStatus === 'declined'
    )
  if (declined) return null

  const summary = typeof entry.summary === 'string' ? entry.summary.trim() : ''
  const base = {
    id: `${calendar.id}:${entry.id}`,
    calendarId: calendar.id,
    title: summary.length > 0 ? summary.slice(0, MAX_PLAN_TITLE) : '(No title)',
    color: (typeof entry.colorId === 'string' && EVENT_COLORS[entry.colorId]) || calendar.color,
    link: typeof entry.htmlLink === 'string' ? entry.htmlLink : null
  }

  const start = isRecord(entry.start) ? entry.start : {}
  const end = isRecord(entry.end) ? entry.end : {}

  if (typeof start.date === 'string' && DATE.test(start.date)) {
    const endDate =
      typeof end.date === 'string' && DATE.test(end.date) && end.date > start.date
        ? end.date
        : nextDay(start.date)
    return { ...base, allDay: true, startDate: start.date, endDate }
  }

  // RFC 3339 with an offset, which Date.parse reads as the exact instant.
  const from = typeof start.dateTime === 'string' ? Date.parse(start.dateTime) : NaN
  const to = typeof end.dateTime === 'string' ? Date.parse(end.dateTime) : NaN
  if (!Number.isFinite(from)) return null
  return { ...base, allDay: false, start: from, end: Number.isFinite(to) && to > from ? to : from }
}

function sameSelection(a: string[] | null, b: string[] | null): boolean {
  if (a === null || b === null) return a === b
  return a.length === b.length && a.every((id) => b.includes(id))
}

const DISCONNECTED: CalendarState = {
  status: 'disconnected',
  account: null,
  calendars: [],
  events: [],
  fetchedAt: null,
  error: null
}

/**
 * Keeps a copy of the chosen Google calendars and refreshes it on a timer.
 * Like the weather, a failed sync never throws away events already shown:
 * they stay up, marked stale.
 */
export class CalendarService {
  private readonly auth: GoogleAuth | null
  private state: CalendarState
  private selection: string[] | null
  private timer: NodeJS.Timeout | null = null
  private listeners = new Set<Listener>()
  /** Guards against a slow sync landing after a disconnect or a newer sync. */
  private requestId = 0

  /** `auth` is null in a build without a Google client ID. */
  constructor(auth: GoogleAuth | null, selection: string[] | null) {
    this.auth = auth
    this.selection = selection
    this.state = auth ? { ...DISCONNECTED } : { ...DISCONNECTED, status: 'unavailable' }
  }

  get connected(): boolean {
    return this.auth?.connected ?? false
  }

  getState(): CalendarState {
    return this.state
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  start(): void {
    if (this.connected) void this.run()
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.listeners.clear()
  }

  setSelection(next: string[] | null): void {
    if (sameSelection(this.selection, next)) return
    this.selection = next
    if (!this.connected) return

    // Unticking is answered at once from what is already here; ticking
    // something new needs a sync either way.
    const chosen = new Set(this.chosen(this.state.calendars).map((calendar) => calendar.id))
    this.setState({
      ...this.state,
      events: this.state.events.filter((event) => chosen.has(event.calendarId))
    })
    void this.run()
  }

  async connect(): Promise<CalendarState> {
    if (!this.auth || this.state.status === 'connecting') return this.state

    const previous = this.state
    this.setState({ ...previous, status: 'connecting', error: null })
    try {
      await this.auth.connect()
    } catch (error) {
      this.setState({
        ...DISCONNECTED,
        error: error instanceof CancelledError ? null : describeError(error)
      })
      return this.state
    }

    this.setState({ ...DISCONNECTED, status: 'loading' })
    await this.run()
    return this.state
  }

  cancelConnect(): void {
    this.auth?.cancelConnect()
  }

  async disconnect(): Promise<CalendarState> {
    if (!this.auth) return this.state
    // Anything still in flight belongs to the account being let go of.
    this.requestId += 1
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.setState({ ...DISCONNECTED })
    await this.auth.disconnect()
    return this.state
  }

  async refresh(): Promise<CalendarState> {
    if (this.connected) await this.run()
    return this.state
  }

  private setState(next: CalendarState): void {
    this.state = next
    for (const listener of this.listeners) listener(next)
  }

  /** Until the user picks, whatever they have ticked in Google itself. */
  private chosen(calendars: GoogleCalendarInfo[]): GoogleCalendarInfo[] {
    const selection = this.selection
    if (selection === null) return calendars.filter((calendar) => calendar.selectedInGoogle)
    return calendars.filter((calendar) => selection.includes(calendar.id))
  }

  /** One retry with a fresh token, for a token Google dropped before its expiry. */
  private async get(url: string): Promise<unknown> {
    const auth = this.auth
    if (!auth) throw new RevokedError()
    try {
      return await getJson(url, { authorization: `Bearer ${await auth.accessToken()}` })
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 401) throw error
      auth.invalidate()
      return getJson(url, { authorization: `Bearer ${await auth.accessToken()}` })
    }
  }

  /** Follows nextPageToken until Google runs out or `limit` items are in. */
  private async getAll(url: string, params: URLSearchParams, limit: number): Promise<unknown[]> {
    const items: unknown[] = []
    let pageToken: string | null = null
    do {
      if (pageToken) params.set('pageToken', pageToken)
      const body = await this.get(`${url}?${params.toString()}`)
      if (!isRecord(body)) throw new Error('Malformed response from Google')
      if (Array.isArray(body.items)) items.push(...(body.items as unknown[]))
      pageToken = typeof body.nextPageToken === 'string' ? body.nextPageToken : null
    } while (pageToken && items.length < limit)
    return items
  }

  private async fetchCalendars(): Promise<GoogleCalendarInfo[]> {
    const params = new URLSearchParams({
      minAccessRole: 'reader',
      maxResults: '250',
      fields: 'items(id,summary,summaryOverride,backgroundColor,primary,selected,hidden),nextPageToken'
    })
    const items = await this.getAll(`${API}/users/me/calendarList`, params, 250)
    return items.flatMap((entry) => parseCalendar(entry) ?? [])
  }

  private async fetchEvents(calendar: GoogleCalendarInfo, now: number): Promise<ExternalEvent[]> {
    const params = new URLSearchParams({
      // Google expands every recurrence into its own instance, so there is
      // no RRULE to interpret here.
      singleEvents: 'true',
      orderBy: 'startTime',
      timeMin: new Date(now - PAST_DAYS * DAY_MS).toISOString(),
      timeMax: new Date(now + FUTURE_DAYS * DAY_MS).toISOString(),
      maxResults: String(PAGE_SIZE),
      fields:
        'items(id,status,summary,start,end,htmlLink,colorId,eventType,attendees(self,responseStatus)),nextPageToken'
    })
    const items = await this.getAll(
      `${API}/calendars/${encodeURIComponent(calendar.id)}/events`,
      params,
      MAX_EVENTS
    )
    return items.flatMap((entry) => parseEvent(entry, calendar) ?? [])
  }

  private async run(): Promise<void> {
    const id = ++this.requestId

    try {
      const calendars = await this.fetchCalendars()
      const now = Date.now()
      const lists = await Promise.all(
        this.chosen(calendars).map((calendar) => this.fetchEvents(calendar, now))
      )
      if (id !== this.requestId) return

      this.setState({
        status: 'ok',
        // A primary calendar's id is its owner's address.
        account: calendars.find((calendar) => calendar.primary)?.id ?? this.state.account,
        calendars,
        events: lists.flat().slice(0, MAX_EVENTS),
        fetchedAt: Date.now(),
        error: null
      })
    } catch (error) {
      if (id !== this.requestId) return
      if (error instanceof RevokedError) {
        this.setState({ ...DISCONNECTED, error: error.message })
        return
      }
      const hasData = this.state.fetchedAt !== null
      this.setState({
        ...this.state,
        status: hasData ? 'stale' : 'error',
        error: describeError(error)
      })
    } finally {
      if (id === this.requestId && this.connected) this.schedule()
    }
  }

  /** Re-armed after every attempt so a manual refresh rebases the cycle. */
  private schedule(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      void this.run()
    }, POLL_INTERVAL_MS)
  }
}
