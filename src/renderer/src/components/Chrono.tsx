import { useCallback, useSyncExternalStore, type ReactNode } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { cn } from '../lib/cn'
import { ControlBar, DIGITS, DisplayCaption } from './Display'
import {
  formatChrono,
  getChronoElapsed,
  isChronoRunning,
  pauseChrono,
  resetChrono,
  startChrono,
  subscribeChrono
} from '../lib/chrono'

function useElapsed(): string {
  const read = useCallback(() => formatChrono(getChronoElapsed()), [])
  return useSyncExternalStore(subscribeChrono, read)
}

/** Changes twice a timing, so this bails out on almost every frame. */
function useRunning(): boolean {
  return useSyncExternalStore(subscribeChrono, isChronoRunning)
}

/** Mirrors Clock: the same sizes, so switching modes moves nothing. */
export function Chrono(): ReactNode {
  const elapsed = useElapsed()
  const running = useRunning()
  const idle = !running && getChronoElapsed() === 0

  return (
    <div className="flex flex-col items-center">
      <span className={`${DIGITS} text-time text-fg`}>
        {elapsed}
      </span>
      <DisplayCaption>{running ? 'Running' : idle ? 'Stopwatch' : 'Paused'}</DisplayCaption>
    </div>
  )
}

interface ControlProps {
  label: string
  onClick: () => void
  primary?: boolean
  children: ReactNode
}

function Control({ label, onClick, primary = false, children }: ControlProps): ReactNode {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'transition-soft flex items-center gap-[0.45em] rounded-full px-[0.95em] py-[0.4em] font-medium',
        primary ? 'bg-accent text-accent-fg' : 'text-fg-muted hover:bg-hover hover:text-fg'
      )}
    >
      {children}
      <span>{label}</span>
    </button>
  )
}

/** Sits where the weather strip does in clock mode, in the same glass pill. */
export function ChronoControls(): ReactNode {
  const running = useRunning()
  const elapsed = useSyncExternalStore(subscribeChrono, getChronoElapsed)

  return (
    <ControlBar>
      {running ? (
        <Control label="Pause" onClick={pauseChrono} primary>
          <Pause className="size-[1.15em]" strokeWidth={2} aria-hidden />
        </Control>
      ) : (
        <Control label="Start" onClick={startChrono} primary>
          <Play className="size-[1.15em]" strokeWidth={2} aria-hidden />
        </Control>
      )}

      <Control label="Reset" onClick={resetChrono}>
        <RotateCcw
          className={cn('size-[1.15em]', elapsed === 0 && !running && 'opacity-50')}
          strokeWidth={2}
          aria-hidden
        />
      </Control>
    </ControlBar>
  )
}
