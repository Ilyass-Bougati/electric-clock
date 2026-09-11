import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: ReadonlyArray<SegmentedOption<T>>
  onChange: (value: T) => void
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange
}: SegmentedProps<T>): ReactNode {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full bg-hover p-[3px]">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'transition-soft rounded-full px-3.5 py-1.5 text-meta font-medium',
              active ? 'bg-accent text-accent-fg' : 'text-fg-muted hover:text-fg'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
