import { MAX_TIMER_MS, MIN_TIMER_MS } from '@shared/types'
import { primeChime, startChime, stopChime } from './chime'

export type TimerStatus = 'idle' | 'running' | 'paused' | 'ringing'

interface TimerState {
  status: TimerStatus
  /** The length the timer is set to. */
  duration: number
  /** What is left, while idle or paused. */
  remaining: number
  /** Wall-clock instant the countdown ends, while running. */
  deadline: number | null
  /** Digits typed so far, phone-style. Empty when not being edited. */
  draft: string
  /**
   * Whether the user has chosen a duration this session. A remembered value
   * shown on launch is a suggestion, not a decision, and the display dims
   * itself to say so.
   */
  touched: boolean
}

let state: TimerState = {
  status: 'idle',
  duration: 5 * 60 * 1000,
  remaining: 5 * 60 * 1000,
  deadline: null,
  draft: '',
  touched: false
}

let hydrated = false
let persisted = state.duration

/**
 * Adopts the remembered duration once, on first load. Guarded because config
 * updates are broadcast back to every window: re-applying on each one would
 * reset a running countdown, and persisting on each would loop.
 */
export function hydrateTimer(duration: number): void {
  if (hydrated) return
  hydrated = true
  const clamped = clampDuration(duration)
  persisted = clamped
  state = { ...state, duration: clamped, remaining: clamped }
  emit()
}

function clampDuration(ms: number): number {
  return Math.min(MAX_TIMER_MS, Math.max(MIN_TIMER_MS, Math.round(ms)))
}

function persist(duration: number): void {
  if (duration === persisted) return
  persisted = duration
  void window.api.config.update({ timerDuration: duration })
}

/** Cached so useSyncExternalStore sees a stable snapshot within a render. */
let displayed = state.remaining

const listeners = new Set<() => void>()
let ticker: number | null = null

/** Only the seconds are shown, so a quarter-second is ample resolution. */
const TICK_MS = 250

function measure(): void {
  if (state.status === 'running' && state.deadline !== null) {
    displayed = Math.max(0, state.deadline - Date.now())
  } else if (state.status === 'ringing') {
    displayed = 0
  } else if (state.draft) {
    displayed = draftToMs(state.draft)
  } else {
    displayed = state.remaining
  }
}

function emit(): void {
  measure()
  for (const listener of listeners) listener()
}

function startTicking(): void {
  if (ticker !== null) return
  ticker = window.setInterval(emit, TICK_MS)
}

function stopTicking(): void {
  if (ticker === null) return
  window.clearInterval(ticker)
  ticker = null
}

export function subscribeTimer(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) stopTicking()
  }
}

export function getTimerDisplayed(): number {
  return displayed
}

export function getTimerStatus(): TimerStatus {
  return state.status
}

export function getTimerDraft(): string {
  return state.draft
}

/** False only until a duration is picked, typed or started. */
export function isTimerSet(): boolean {
  return state.touched
}

/** "2500" means 25 minutes: digits fill from the right, as on a phone. */
export function draftToMs(draft: string): number {
  const padded = draft.padStart(6, '0')
  const hours = Number(padded.slice(0, 2))
  const minutes = Number(padded.slice(2, 4))
  const seconds = Number(padded.slice(4, 6))
  return Math.min(MAX_TIMER_MS, ((hours * 60 + minutes) * 60 + seconds) * 1000)
}

export function pushTimerDigit(digit: string): void {
  if (state.status !== 'idle' || !/^[0-9]$/.test(digit)) return
  const draft = (state.draft + digit).replace(/^0+(?=\d)/, '').slice(-6)
  state = { ...state, draft, touched: true }
  emit()
}

/** Clicking the display starts a fresh entry rather than editing the tail. */
export function clearTimerDraft(): void {
  if (state.status !== 'idle' || !state.draft) return
  state = { ...state, draft: '' }
  emit()
}

export function popTimerDigit(): void {
  if (state.status !== 'idle' || !state.draft) return
  state = { ...state, draft: state.draft.slice(0, -1) }
  emit()
}

export function setTimerDuration(duration: number): void {
  const clamped = clampDuration(duration)
  persist(clamped)
  state = {
    status: 'idle',
    duration: clamped,
    remaining: clamped,
    deadline: null,
    draft: '',
    touched: true
  }
  window.api.timer.disarm()
  stopChime()
  stopTicking()
  emit()
}

/** Commits whatever is being typed, so Start never silently discards it. */
function committedDuration(): number {
  if (!state.draft) return state.duration
  return Math.max(MIN_TIMER_MS, draftToMs(state.draft))
}

export function startTimer(): void {
  if (state.status === 'running') return

  // Unlock audio here: this is a click, and the moment it fires will not be.
  primeChime()

  const duration = state.status === 'paused' ? state.duration : committedDuration()
  const remaining = state.status === 'paused' ? state.remaining : duration
  if (remaining <= 0) return

  persist(duration)
  const deadline = Date.now() + remaining
  state = { status: 'running', duration, remaining, deadline, draft: '', touched: true }
  window.api.timer.arm(deadline)
  startTicking()
  emit()
}

export function pauseTimer(): void {
  if (state.status !== 'running' || state.deadline === null) return
  state = {
    ...state,
    status: 'paused',
    remaining: Math.max(0, state.deadline - Date.now()),
    deadline: null
  }
  window.api.timer.disarm()
  stopTicking()
  emit()
}

export function toggleTimer(): void {
  if (state.status === 'ringing') dismissTimer()
  else if (state.status === 'running') pauseTimer()
  else startTimer()
}

export function resetTimer(): void {
  state = { ...state, status: 'idle', remaining: state.duration, deadline: null, draft: '' }
  window.api.timer.disarm()
  stopChime()
  stopTicking()
  emit()
}

/** Called when the main process says the deadline has passed. */
export function ringTimer(): void {
  if (state.status === 'ringing') return
  state = { ...state, status: 'ringing', remaining: 0, deadline: null }
  stopTicking()
  startChime()
  emit()
}

export function dismissTimer(): void {
  stopChime()
  window.api.timer.disarm()
  state = { ...state, status: 'idle', remaining: state.duration, deadline: null, draft: '' }
  emit()
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** `MM:SS`, growing to `H:MM:SS` only when there is an hour to show. */
export function formatTimer(ms: number): string {
  // Round up: a countdown should read 00:01 until the second is actually
  // spent, not blink to 00:00 while there is still time left.
  const total = Math.ceil(Math.max(0, ms) / 1000)
  const seconds = total % 60
  const minutes = Math.floor(total / 60) % 60
  const hours = Math.floor(total / 3600)

  const tail = `${pad(minutes)}:${pad(seconds)}`
  return hours > 0 ? `${hours}:${tail}` : tail
}
