import { useCallback, useSyncExternalStore, type ReactNode } from 'react'
import { BellOff, Pause, Play, RotateCcw } from 'lucide-react'
import { cn } from '../lib/cn'
import { ControlBar, DIGITS, DisplayCaption } from './Display'
import {
  clearTimerDraft,
  dismissTimer,
  formatTimer,
  getTimerDisplayed,
  getTimerStatus,
  isTimerSet,
  pauseTimer,
  resetTimer,
  setTimerDuration,
  startTimer,
  subscribeTimer as subscribe,
  type TimerStatus
} from '../lib/timer'

const PRESETS: ReadonlyArray<{ label: string; minutes: number }> = [
  { label: '1m', minutes: 1 },
  { label: '5m', minutes: 5 },
  { label: '10m', minutes: 10 },
  { label: '25m', minutes: 25 }
]

function useRemaining(): string {
  const read = useCallback(() => formatTimer(getTimerDisplayed()), [])
  return useSyncExternalStore(subscribe, read)
}

function useStatus(): TimerStatus {
  return useSyncExternalStore(subscribe, getTimerStatus)
}

function useIsSet(): boolean {
  return useSyncExternalStore(subscribe, isTimerSet)
}

/** Mirrors Clock and Chrono: same sizes, so switching modes moves nothing. */
export function Timer(): ReactNode {
  const remaining = useRemaining()
  const status = useStatus()
  const isSet = useIsSet()
  const editable = status === 'idle'

  return (
    <div className="flex flex-col items-center">
      <div
        role={editable ? 'textbox' : undefined}
        tabIndex={editable ? 0 : undefined}
        aria-label={editable ? 'Timer duration' : undefined}
        onClick={editable ? clearTimerDraft : undefined}
        className={cn('text-time', editable && 'cursor-text')}
      >
        <span
          className={cn(
            DIGITS,
            'transition-soft',
            // A remembered duration is a suggestion until it has been chosen,
            // so it sits at the same weight as the app's other secondary text
            // and only comes up to full contrast once it means something.
            isSet ? 'text-fg' : 'text-fg-faint',
            // Ringing pulses the digits rather than flashing: something has to
            // carry the alarm when the sound is muted, without being lurid.
            status === 'ringing' && 'animate-ring'
          )}
        >
          {remaining}
        </span>
      </div>
      <DisplayCaption />
    </div>
  )
}

interface ControlProps {
  label: string
  onClick: () => void
  primary?: boolean
  children?: ReactNode
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

export function TimerControls(): ReactNode {
  const status = useStatus()

  return (
    <ControlBar>
      {status === 'ringing' ? (
        <Control label="Stop" onClick={dismissTimer} primary>
          <BellOff className="size-[1.15em]" strokeWidth={2} aria-hidden />
        </Control>
      ) : (
        <>
          {status === 'idle' ? (
            <div className="flex items-center gap-[0.15em] pr-[0.3em]">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setTimerDuration(preset.minutes * 60 * 1000)}
                  className="transition-soft rounded-full px-[0.7em] py-[0.4em] font-medium text-fg-muted hover:bg-hover hover:text-fg"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          ) : null}

          {status === 'running' ? (
            <Control label="Pause" onClick={pauseTimer} primary>
              <Pause className="size-[1.15em]" strokeWidth={2} aria-hidden />
            </Control>
          ) : (
            <Control label={status === 'paused' ? 'Resume' : 'Start'} onClick={startTimer} primary>
              <Play className="size-[1.15em]" strokeWidth={2} aria-hidden />
            </Control>
          )}

          {status === 'idle' ? null : (
            <Control label="Reset" onClick={resetTimer}>
              <RotateCcw className="size-[1.15em]" strokeWidth={2} aria-hidden />
            </Control>
          )}
        </>
      )}
    </ControlBar>
  )
}
