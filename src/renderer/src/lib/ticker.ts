/**
 * One timer for the whole app. Components subscribe individually, so a tick
 * only re-renders what actually reads it.
 */
const listeners = new Set<() => void>()

let tick = Date.now()
let timer: number | null = null

function schedule(): void {
  // Re-align to the wall clock on every tick: a fixed 1000ms interval drifts
  // and eventually skips or repeats a displayed second.
  const delay = 1000 - (Date.now() % 1000)
  timer = window.setTimeout(() => {
    tick = Date.now()
    for (const listener of listeners) listener()
    schedule()
  }, delay)
}

export function subscribeToTick(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1) {
    tick = Date.now()
    schedule()
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }
}

export function getTick(): number {
  return tick
}
