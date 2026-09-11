import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { CustomPalette, PaletteChoice, ResolvedTheme } from '@shared/types'
import { cn } from '../lib/cn'
import { previewAccents, type ShaderPalette } from '../lib/shader-palette'

/** Colour inputs fire continuously while dragging; disk writes should not. */
const COMMIT_DELAY_MS = 140

interface SwatchProps {
  label: string
  value: string
  onChange: (value: string) => void
}

/**
 * A round colour well. Keeps the picked value locally while the native
 * picker is being dragged and pushes it outward on a short delay, so one
 * drag is a handful of config writes rather than one per frame.
 */
function Swatch({ label, value, onChange }: SwatchProps): ReactNode {
  const [local, setLocal] = useState(value)
  const latest = useRef(onChange)
  latest.current = onChange

  // Adopt outside changes (a preset switch, another window) unless the user
  // is mid-drag, in which case the local value is the newer truth.
  useEffect(() => setLocal(value), [value])

  useEffect(() => {
    if (local === value) return
    const handle = window.setTimeout(() => latest.current(local), COMMIT_DELAY_MS)
    return () => window.clearTimeout(handle)
  }, [local, value])

  return (
    <label className="transition-soft flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-hover">
      <input
        type="color"
        value={local}
        onChange={(event) => setLocal(event.target.value)}
        aria-label={label}
        className="size-6 shrink-0 cursor-pointer"
      />
      <span className="text-meta font-medium text-fg-muted">{label}</span>
    </label>
  )
}

interface PalettePickerProps {
  value: PaletteChoice
  custom: CustomPalette
  /** The live palette, so the Weather tile shows today's actual colours. */
  palette: ShaderPalette
  theme: ResolvedTheme
  onChange: (value: PaletteChoice) => void
  onCustomChange: (custom: CustomPalette) => void
}

const OPTIONS: ReadonlyArray<{ value: PaletteChoice; label: string }> = [
  { value: 'weather', label: 'Weather' },
  { value: 'ember', label: 'Ember' },
  { value: 'tide', label: 'Tide' },
  { value: 'custom', label: 'Custom' }
]

export function PalettePicker({
  value,
  custom,
  palette,
  theme,
  onChange,
  onCustomChange
}: PalettePickerProps): ReactNode {
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Palette" className="grid grid-cols-4 gap-2">
        {OPTIONS.map((option) => {
          const active = option.value === value
          const [a, b] = previewAccents(option.value, custom, palette, theme)
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={cn(
                'transition-soft flex flex-col items-center gap-2 rounded-xl px-2 py-2.5',
                active ? 'bg-accent' : 'hover:bg-hover'
              )}
            >
              <span
                className="block h-5 w-full rounded-md"
                style={{ background: `linear-gradient(110deg, ${a}, ${b})` }}
              />
              <span
                className={cn(
                  'text-meta font-medium',
                  active ? 'text-accent-fg' : 'text-fg-faint'
                )}
              >
                {option.label}
              </span>
            </button>
          )
        })}
      </div>

      {value === 'custom' ? (
        <div className="flex items-center gap-2">
          <Swatch
            label="Accent"
            value={custom.accent}
            onChange={(accent) => onCustomChange({ ...custom, accent })}
          />
          <Swatch
            label="Second"
            value={custom.accentAlt}
            onChange={(accentAlt) => onCustomChange({ ...custom, accentAlt })}
          />
        </div>
      ) : null}
    </div>
  )
}
