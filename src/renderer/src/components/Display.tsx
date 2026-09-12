import type { ReactNode } from 'react'
import { LiquidGlass } from './LiquidGlass'

/**
 * The three modes share one skeleton, so switching between clock, stopwatch
 * and timer changes what is shown and nothing about where or how big it is.
 */

/** The big readout. Mode-specific colour is added on top of this. */
export const DIGITS = 'display-face block font-medium leading-[0.84] tracking-[var(--display-track)]'

/**
 * The line under the digits. Rendered even when a mode has nothing to say
 * there -- otherwise that mode's digits would sit lower than the others'.
 */
export function DisplayCaption({ children }: { children?: ReactNode }): ReactNode {
  return (
    <p className="display-face mt-[0.35em] text-body font-normal text-fg-faint">
      {children ?? ' '}
    </p>
  )
}

/**
 * The bar beneath the display. A fixed height in em of the body scale, so
 * the weather readings and the stopwatch's two buttons produce exactly the
 * same shape despite holding very different content.
 */
export function ControlBar({ children }: { children: ReactNode }): ReactNode {
  return (
    <LiquidGlass className="display-face flex h-[2.9em] items-center gap-[0.35em] rounded-full px-[0.5em] text-body">
      {children}
    </LiquidGlass>
  )
}
