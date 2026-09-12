import type { ReactNode } from 'react'
import { ImagePlus, X } from 'lucide-react'
import {
  MAX_WALLPAPER_DIM,
  MIN_WALLPAPER_DIM,
  type BackgroundChoice,
  type Wallpaper
} from '@shared/types'
import { cn } from '../lib/cn'
import type { ShaderPalette } from '../lib/shader-palette'
import { ShaderField, wallpaperUrl } from './Background'

/** The generated backgrounds. The wallpaper gets its own row below. */
const OPTIONS: ReadonlyArray<{ value: Exclude<BackgroundChoice, 'wallpaper'>; label: string }> = [
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
  wallpaper: Wallpaper | null
  dim: number
  onChange: (value: BackgroundChoice) => void
  onDimChange: (dim: number) => void
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
  wallpaper,
  dim,
  onChange,
  onDimChange
}: BackgroundPickerProps): ReactNode {
  const wallpaperActive = value === 'wallpaper' && wallpaper !== null

  return (
    <div className="flex flex-col gap-2">
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

      {/*
        Separate from the grid because it behaves differently: it opens a
        native file picker rather than simply selecting a look.
      */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-pressed={wallpaperActive}
          onClick={() => {
            if (wallpaper) onChange('wallpaper')
            else void window.api.wallpaper.choose()
          }}
          className={cn(
            'transition-soft flex flex-1 items-center gap-3 rounded-xl p-2 text-left',
            wallpaperActive ? 'bg-accent' : 'hover:bg-hover'
          )}
        >
          <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-hover">
            {wallpaper ? (
              <img
                src={wallpaperUrl(wallpaper)}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <ImagePlus className="size-4 text-fg-faint" strokeWidth={1.75} aria-hidden />
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span
              className={cn(
                'text-meta font-medium',
                wallpaperActive ? 'text-accent-fg' : 'text-fg'
              )}
            >
              Wallpaper
            </span>
            <span
              className={cn(
                'truncate text-meta',
                wallpaperActive ? 'text-accent-fg opacity-70' : 'text-fg-faint'
              )}
            >
              {wallpaper ? 'Your own image' : 'Choose an image…'}
            </span>
          </span>
        </button>

        {wallpaper ? (
          <>
            <button
              type="button"
              onClick={() => void window.api.wallpaper.choose()}
              className="transition-soft shrink-0 rounded-xl px-3 py-2.5 text-meta font-medium text-fg-muted hover:bg-hover hover:text-fg"
            >
              Change
            </button>
            <button
              type="button"
              aria-label="Remove wallpaper"
              title="Remove wallpaper"
              onClick={() => void window.api.wallpaper.clear()}
              className="transition-soft grid size-9 shrink-0 place-items-center rounded-xl text-fg-faint hover:bg-hover hover:text-fg"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </>
        ) : null}
      </div>

      {/*
        Only worth showing once there is an image to dim, and only while it is
        the background being used.
      */}
      {wallpaperActive ? (
        <label className="flex items-center gap-3 px-2 pb-1">
          <span className="text-meta font-medium text-fg-muted">Dim</span>
          <input
            type="range"
            min={MIN_WALLPAPER_DIM}
            max={MAX_WALLPAPER_DIM}
            step={0.01}
            value={dim}
            onChange={(event) => onDimChange(Number(event.target.value))}
            aria-label="Wallpaper dim"
            className="h-1 flex-1 cursor-pointer"
          />
          <span className="w-9 text-right text-meta tabular-nums text-fg-faint">
            {Math.round((dim / MAX_WALLPAPER_DIM) * 100)}%
          </span>
        </label>
      ) : null}
    </div>
  )
}
