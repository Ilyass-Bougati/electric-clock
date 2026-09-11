import type { ReactNode } from 'react'
import type { BackgroundChoice } from '@shared/types'
import { cn } from '../lib/cn'
import type { ShaderPalette } from '../lib/shader-palette'
import { ShaderField } from './Background'

const OPTIONS: ReadonlyArray<{ value: BackgroundChoice; label: string }> = [
  { value: 'ambient', label: 'Ambient' },
  { value: 'mesh', label: 'Mesh' },
  { value: 'warp', label: 'Warp' },
  { value: 'grain', label: 'Grain' },
  { value: 'swirl', label: 'Swirl' },
  { value: 'dither', label: 'Dither' }
]

interface BackgroundPickerProps {
  value: BackgroundChoice
  palette: ShaderPalette
  onChange: (value: BackgroundChoice) => void
}

/**
 * Each tile is the real shader running the real palette, so what you pick is
 * what you get. They are rendered at a fraction of the pixel count and held
 * still -- six animating WebGL contexts inside a settings panel would be a
 * lot of GPU for a preview.
 */
export function BackgroundPicker({
  value,
  palette,
  onChange
}: BackgroundPickerProps): ReactNode {
  return (
    <div role="group" aria-label="Background" className="grid grid-cols-3 gap-2">
      {OPTIONS.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'transition-soft flex flex-col gap-2 rounded-xl p-2',
              active ? 'bg-accent' : 'hover:bg-hover'
            )}
          >
            <span className="relative block h-16 w-full overflow-hidden rounded-lg">
              {option.value === 'ambient' ? (
                <span className="ambient-wash absolute inset-0 block bg-bg" />
              ) : (
                <ShaderField
                  choice={option.value}
                  palette={palette}
                  speed={0}
                  maxPixelCount={30_000}
                  className="absolute inset-0 h-full w-full"
                />
              )}
            </span>
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
  )
}
