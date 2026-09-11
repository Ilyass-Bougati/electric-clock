import type { ReactNode } from 'react'
import type { FontChoice } from '@shared/types'
import { cn } from '../lib/cn'

interface FaceOption {
  value: FontChoice
  label: string
  /** The CSS stack and axis settings, mirroring styles.css. */
  family: string
  axes: string
  track: string
}

const FACES: readonly FaceOption[] = [
  {
    value: 'inter',
    label: 'Inter',
    family: "'Inter Variable', ui-sans-serif, system-ui, sans-serif",
    axes: 'normal',
    track: '-0.045em'
  },
  {
    value: 'grotesk',
    label: 'Grotesk',
    family: "'Space Grotesk Variable', ui-sans-serif, system-ui, sans-serif",
    axes: 'normal',
    track: '-0.035em'
  },
  {
    value: 'fraunces',
    label: 'Fraunces',
    family: "'Fraunces Variable', ui-serif, Georgia, serif",
    // The preview is ~10x smaller than the clock, so it needs the text
    // optical size; the display cut goes hairline at this scale.
    axes: "'opsz' 36, 'SOFT' 40, 'WONK' 1",
    track: '-0.025em'
  },
  {
    value: 'mono',
    label: 'Mono',
    family: "'JetBrains Mono Variable', ui-monospace, monospace",
    axes: 'normal',
    track: '-0.055em'
  }
]

interface FontPickerProps {
  value: FontChoice
  onChange: (value: FontChoice) => void
}

/**
 * Each tile previews the clock itself rather than naming a font the user has
 * to imagine -- the digits are the only glyphs that matter here.
 */
export function FontPicker({ value, onChange }: FontPickerProps): ReactNode {
  return (
    <div role="group" aria-label="Typeface" className="grid grid-cols-4 gap-2">
      {FACES.map((face) => {
        const active = face.value === value
        return (
          <button
            key={face.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(face.value)}
            className={cn(
              'transition-soft flex flex-col items-center gap-1.5 rounded-xl px-2 py-3',
              active ? 'bg-accent text-accent-fg' : 'text-fg-muted hover:bg-hover'
            )}
          >
            <span
              className="text-[1.375rem] font-medium leading-none"
              style={{
                fontFamily: face.family,
                fontVariationSettings: face.axes,
                letterSpacing: face.track
              }}
            >
              10:24
            </span>
            <span
              className={cn(
                'text-meta font-medium',
                active ? 'text-accent-fg opacity-70' : 'text-fg-faint'
              )}
            >
              {face.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
