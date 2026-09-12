/**
 * The stopwatch, as a module singleton.
 *
 * Elapsed time is measured with `performance.now()`, never `Date.now()`: a
 * wall clock can be nudged by NTP or a timezone change mid-run, which would
 * make a stopwatch jump or even run backwards. It also keeps running while
 * the clock face is showing, so switching modes never loses a timing.
 */

interface ChronoState {
  running: boolean
  /** Milliseconds banked from previous runs. */
  banked: number
  /** `performance.now()` at the current run's start, or null when stopped. */
  startedAt: number | null
}

let state: ChronoState = { running: false, banked: 0, startedAt: null }

/**
 * The value reads are served from. useSyncExternalStore requires a snapshot
 * that does not change between two calls in the same render, so this is
 * recomputed on a frame boundary rather than live from the clock.
 */
let displayed = 0

const listeners = new Set<() => void>()
let frame: number | null = null

function measure(): void {
  displayed =
    state.running && state.startedAt !== null
      ? state.banked + (performance.now() - state.startedAt)
      : state.banked
}

function emit(): void {
  measure()
  for (const listener of listeners) listener()
}

/** Runs only while the stopwatch does; a stopped chrono costs nothing. */
function pump(): void {
  frame = window.requestAnimationFrame(() => {
    frame = null
    emit()
    if (state.running) pump()
  })
}

function stopPump(): void {
  if (frame !== null) {
    window.cancelAnimationFrame(frame)
    frame = null
  }
}

export function subscribeChrono(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) stopPump()
  }
}

export function getChronoElapsed(): number {
  return displayed
}

export function isChronoRunning(): boolean {
  return state.running
}

export function startChrono(): void {
  if (state.running) return
  state = { running: true, banked: state.banked, startedAt: performance.now() }
  emit()
  pump()
}

export function pauseChrono(): void {
  if (!state.running) return
  const banked =
    state.startedAt === null ? state.banked : state.banked + (performance.now() - state.startedAt)
  state = { running: false, banked, startedAt: null }
  stopPump()
  emit()
}

export function toggleChrono(): void {
  if (state.running) pauseChrono()
  else startChrono()
}

export function resetChrono(): void {
  state = { running: false, banked: 0, startedAt: null }
  stopPump()
  emit()
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * `MM:SS.cs` -- deliberately eight characters, the same width as the clock
 * face, so switching modes does not resize the display. Past an hour it
 * grows rather than silently wrapping around.
 */
export function formatChrono(ms: number): string {
  const total = Math.max(0, Math.floor(ms))
  const centis = Math.floor((total % 1000) / 10)
  const seconds = Math.floor(total / 1000) % 60
  const minutes = Math.floor(total / 60_000) % 60
  const hours = Math.floor(total / 3_600_000)

  const tail = `${pad(minutes)}:${pad(seconds)}.${pad(centis)}`
  return hours > 0 ? `${hours}:${tail}` : tail
}
