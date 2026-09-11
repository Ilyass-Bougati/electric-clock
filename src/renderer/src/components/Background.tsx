import type { ReactNode } from 'react'
import {
  Dithering,
  GrainGradient,
  MeshGradient,
  Swirl,
  Warp
} from '@paper-design/shaders-react'
import type { BackgroundChoice } from '@shared/types'
import { shaderColors, type ShaderPalette } from '../lib/shader-palette'

/*
 * Fine monochrome grain, layered over whatever the background is. It does two
 * jobs: it keeps a very large flat field from looking like dead vinyl, and it
 * gives the weather strip's backdrop-filter something to actually blur -- a
 * smooth gradient blurs into an identical smooth gradient, and the glass
 * would read as nothing.
 */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)'/%3E%3C/svg%3E\")"

/**
 * Rendering at full resolution buys nothing -- every one of these is a soft,
 * low-frequency field -- and this runs all day, so the pixel count is capped.
 */
const MAX_PIXELS = 1_100_000

const FILL = 'absolute inset-0 h-full w-full'

export interface ShaderFieldProps {
  choice: Exclude<BackgroundChoice, 'ambient'>
  palette: ShaderPalette
  /** Tiles in settings render still; only the real background moves. */
  speed?: number
  maxPixelCount?: number
  className?: string
}

/**
 * The shader itself, without the grain. Exported so the settings picker can
 * preview each option with the live palette rather than a screenshot.
 */
export function ShaderField({
  choice,
  palette,
  speed = 1,
  maxPixelCount = MAX_PIXELS,
  className = FILL
}: ShaderFieldProps): ReactNode {
  const colors = shaderColors(palette)
  const common = { className, maxPixelCount }

  switch (choice) {
    case 'mesh':
      return (
        <MeshGradient
          {...common}
          colors={colors}
          distortion={0.9}
          swirl={0.2}
          grainMixer={0.3}
          grainOverlay={0}
          speed={0.22 * speed}
        />
      )
    case 'warp':
      return (
        <Warp
          {...common}
          colors={colors}
          shape="stripes"
          shapeScale={0.12}
          proportion={0.45}
          softness={1}
          distortion={0.2}
          swirl={0.75}
          swirlIterations={8}
          speed={0.2 * speed}
        />
      )
    case 'grain':
      return (
        <GrainGradient
          {...common}
          colorBack={palette.base}
          colors={[palette.accent, palette.accentAlt, palette.baseAlt]}
          shape="blob"
          softness={0.75}
          intensity={0.35}
          noise={0.3}
          speed={0.28 * speed}
        />
      )
    case 'swirl':
      return (
        <Swirl
          {...common}
          colorBack={palette.base}
          colors={[palette.accent, palette.accentAlt, palette.baseAlt]}
          bandCount={3}
          twist={0.22}
          softness={1}
          noise={0.22}
          noiseFrequency={0.4}
          speed={0.16 * speed}
        />
      )
    case 'dither':
      return (
        <Dithering
          {...common}
          colorBack={palette.base}
          colorFront={palette.accent}
          shape="warp"
          type="8x8"
          size={2}
          speed={0.22 * speed}
        />
      )
  }
}

interface BackgroundProps {
  choice: BackgroundChoice
  palette: ShaderPalette
}

export function Background({ choice, palette }: BackgroundProps): ReactNode {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {choice === 'ambient' ? (
        // Two CSS washes driven by data-tone. No GPU, no animation.
        <div className="ambient-wash absolute inset-0" />
      ) : (
        <ShaderField choice={choice} palette={palette} />
      )}

      <div
        className="absolute inset-0"
        style={{ backgroundImage: GRAIN, opacity: 'var(--grain)' }}
      />
    </div>
  )
}
