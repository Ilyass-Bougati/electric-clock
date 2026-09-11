import { useCallback, useMemo, type ReactNode } from 'react'
import { useClockValue } from '../lib/useClockValue'
import { createDateFormatter, createTimeFormatter, splitClock } from '../lib/time'

interface ClockProps {
  timeZone: string
  hour12: boolean
}

/**
 * The only thing in the app that changes every second. It subscribes to the
 * tick itself, so nothing above it in the tree re-renders on the way.
 */
function TimeDisplay({ timeZone, hour12 }: ClockProps): ReactNode {
  const formatter = useMemo(() => createTimeFormatter(timeZone, hour12), [timeZone, hour12])

  const readDigits = useCallback((at: number) => splitClock(formatter, at).digits, [formatter])
  const readMeridiem = useCallback((at: number) => splitClock(formatter, at).meridiem, [formatter])

  const digits = useClockValue(readDigits)
  const meridiem = useClockValue(readMeridiem)

  return (
    <div className="flex items-start justify-center gap-[0.4em]">
      <span className="display-face text-time font-medium leading-[0.84] tracking-[var(--display-track)] text-fg">
        {digits}
      </span>
      {meridiem ? (
        <span className="display-face mt-[0.55em] text-body font-medium uppercase tracking-[0.08em] text-fg-faint">
          {meridiem}
        </span>
      ) : null}
    </div>
  )
}

/**
 * Reformatted on every tick but the string only changes at midnight, so
 * useSyncExternalStore bails out and this renders once a day.
 */
function DateLine({ timeZone }: { timeZone: string }): ReactNode {
  const formatter = useMemo(() => createDateFormatter(timeZone), [timeZone])
  const read = useCallback((at: number) => formatter.format(at), [formatter])
  const today = useClockValue(read)

  return (
    <p className="display-face mt-[0.35em] text-body font-normal text-fg-faint">{today}</p>
  )
}

export function Clock({ timeZone, hour12 }: ClockProps): ReactNode {
  return (
    <div className="flex flex-col items-center">
      <TimeDisplay timeZone={timeZone} hour12={hour12} />
      <DateLine timeZone={timeZone} />
    </div>
  )
}
