import { useCallback, useSyncExternalStore, type ReactNode } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { cn } from '../lib/cn'
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
      <span className="display-face text-time font-medium leading-[0.84] tracking-[var(--display-track)] text-fg">
        {elapsed}
      </span>
      <p className="display-face mt-[0.35em] text-body font-normal text-fg-faint">
        {running ? 'Running' : idle ? 'Stopwatch' : 'Paused'}
      </p>
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
        'transition-soft flex items-center gap-[0.5em] rounded-full px-[1.1em] py-[0.45em] text-meta font-medium',
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
    <div className="glass display-face flex items-center gap-[0.4em] rounded-full text-body p-[0.35em]">
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
    </div>
  )
}
