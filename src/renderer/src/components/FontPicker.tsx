import type { ReactNode } from 'react'
import type { FontChoice } from '@shared/types'
import { cn } from '../lib/cn'

interface FaceOption {
  value: FontChoice
  label: string
  /** The CSS stack, mirroring styles.css. */
  family: string
  track: string
  /** Matches --display-scale, so the tile previews the real proportions. */
  scale?: number
}

const FACES: readonly FaceOption[] = [
  {
    value: 'jetbrains',
    label: 'JetBrains',
    family: "'JetBrains Mono Variable', ui-monospace, monospace",
    track: '-0.055em'
  },
  {
    value: 'geist',
    label: 'Geist',
    family: "'Geist Mono Variable', ui-monospace, monospace",
    track: '-0.05em'
  },
  {
    value: 'martian',
    label: 'Martian',
    family: "'Martian Mono Variable', ui-monospace, monospace",
    // Martian is much wider than the rest; the preview has to shrink to fit
    // the same tile as the others.
    track: '-0.08em',
    scale: 0.78
  },
  {
    value: 'redhat',
    label: 'Red Hat',
    family: "'Red Hat Mono Variable', ui-monospace, monospace",
    track: '-0.045em'
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
              className="font-medium leading-none"
              style={{
                fontFamily: face.family,
                letterSpacing: face.track,
                fontSize: `${1.375 * (face.scale ?? 1)}rem`
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
