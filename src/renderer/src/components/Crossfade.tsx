import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '../lib/cn'

interface CrossfadeProps<T extends string> {
  /** Changing this triggers the transition. */
  value: T
  /** Must match the CSS animation, or the outgoing copy lingers. */
  duration?: number
  className?: string
  /** Positioning for the outgoing copy, which is taken out of flow. */
  leavingClassName?: string
  children: (value: T) => ReactNode
}

/**
 * Fades one value's content out while the next fades in.
 *
 * The outgoing copy is absolutely positioned so the container sizes to the
 * *incoming* content only -- otherwise switching from the wide weather
 * readings to two stopwatch buttons would hold the old width for the length
 * of the fade and then snap.
 *
 * Keyed on the value rather than the rendered output, so a clock ticking
 * inside it re-renders every second without ever restarting the animation.
 */
export function Crossfade<T extends string>({
  value,
  duration = 260,
  className,
  leavingClassName,
  children
}: CrossfadeProps<T>): ReactNode {
  const [current, setCurrent] = useState(value)
  const [leaving, setLeaving] = useState<T | null>(null)

  useEffect(() => {
    if (value === current) return
    setLeaving(current)
    setCurrent(value)
  }, [value, current])

  useEffect(() => {
    if (leaving === null) return
    const timer = window.setTimeout(() => setLeaving(null), duration)
    return () => window.clearTimeout(timer)
  }, [leaving, duration])

  return (
    <div className={cn('relative', className)}>
      {leaving === null ? null : (
        <div
          key={`leaving-${leaving}`}
          aria-hidden
          className={cn('mode-leaving pointer-events-none absolute', leavingClassName)}
        >
          {children(leaving)}
        </div>
      )}
      <div key={`current-${current}`} className="mode-entering">
        {children(current)}
      </div>
    </div>
  )
}
