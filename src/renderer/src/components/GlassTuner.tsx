import { useSyncExternalStore, type ReactNode } from 'react'
import {
  GLASS_DEFAULTS,
  GLASS_RANGES,
  getGlassTuning,
  setGlassTuning,
  subscribeGlassTuning,
  type GlassTuning
} from '../lib/glass-tuning'

const FIELDS: ReadonlyArray<{ key: keyof GlassTuning; label: string; digits: number }> = [
  { key: 'strength', label: 'Bend', digits: 0 },
  { key: 'thickness', label: 'Rim depth', digits: 0 },
  { key: 'spread', label: 'Diffraction', digits: 3 },
  { key: 'blur', label: 'Blur', digits: 1 }
]

/**
 * Development-only. Drives every pane of glass at once so values can be
 * compared against the same background rather than rebuilt one at a time.
 *
 * Lives inside DevMenu, which is itself rendered only under
 * `import.meta.env.DEV`; the production bundle contains neither.
 */
export function GlassTuner(): ReactNode {
  const override = useSyncExternalStore(subscribeGlassTuning, getGlassTuning)
  const tuning = override ?? GLASS_DEFAULTS

  const update = (key: keyof GlassTuning, value: number): void => {
    setGlassTuning({ ...tuning, [key]: value })
  }

  return (
    <div className="flex flex-col gap-2.5">
      {FIELDS.map((field) => {
        const range = GLASS_RANGES[field.key]
        return (
          <label key={field.key} className="flex flex-col gap-1">
            <span className="flex items-baseline justify-between text-meta">
              <span className="font-medium text-fg">{field.label}</span>
              <span className="tabular-nums text-fg-faint">
                {tuning[field.key].toFixed(field.digits)}
              </span>
            </span>
            <input
              type="range"
              min={range.min}
              max={range.max}
              step={range.step}
              value={tuning[field.key]}
              onChange={(event) => update(field.key, Number(event.target.value))}
              aria-label={field.label}
              className="h-1 w-full cursor-pointer"
            />
          </label>
        )
      })}
    </div>
  )
}
