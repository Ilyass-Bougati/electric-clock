import type { CustomPalette, PaletteChoice, ResolvedTheme } from '@shared/types'

export interface ShaderPalette {
  base: string
  baseAlt: string
  accent: string
  accentAlt: string
}

/**
 * Shaders need solid colours, but the app's palette is defined once in CSS as
 * a neutral ground plus two translucent condition washes. Rather than keeping
 * a second, hand-tuned set of colours in sync, this composites the real
 * tokens down to solid values -- so the shader is literally the same palette
 * the rest of the app uses, just flattened.
 *
 * A shader fills the whole window, where the CSS washes were soft radial
 * falloffs, so the tone is laid on below full strength: enough to read as
 * "warm today" or "grey today", not enough to become a colour scheme of its
 * own.
 */
const ACCENT_STRENGTH = 0.72
const GROUND_STRENGTH = 0.16

let probe: CanvasRenderingContext2D | null = null

function context(): CanvasRenderingContext2D | null {
  if (probe) return probe
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  probe = canvas.getContext('2d', { willReadFrequently: true })
  return probe
}

/**
 * Paints `tone` over `base` at `strength` and reads the result back. Letting
 * the canvas do it means any colour syntax the browser accepts works here,
 * with the browser's own blending -- no CSS colour parser of our own.
 */
function flatten(base: string, tone: string, strength: number): string {
  const ctx = context()
  if (!ctx) return base

  ctx.clearRect(0, 0, 1, 1)
  ctx.globalAlpha = 1
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 1, 1)

  if (tone && strength > 0) {
    ctx.globalAlpha = strength
    ctx.fillStyle = tone
    ctx.fillRect(0, 0, 1, 1)
    ctx.globalAlpha = 1
  }

  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

/** Reads the live tokens, so it follows the theme and the conditions. */
export function readShaderPalette(): ShaderPalette {
  const styles = getComputedStyle(document.documentElement)
  const base = styles.getPropertyValue('--bg').trim() || '#101214'
  const toneA = styles.getPropertyValue('--tone-a').trim()
  const toneB = styles.getPropertyValue('--tone-b').trim()

  return {
    base: flatten(base, '', 0),
    baseAlt: flatten(base, toneA, GROUND_STRENGTH),
    accent: flatten(base, toneA, ACCENT_STRENGTH),
    accentAlt: flatten(base, toneB, ACCENT_STRENGTH)
  }
}

/** Ground, accent, ground, accent -- the alternation keeps the field calm. */
export function shaderColors(palette: ShaderPalette): string[] {
  return [palette.base, palette.accent, palette.baseAlt, palette.accentAlt]
}

/**
 * The fixed palettes. Only accents -- the ground colour is always the
 * theme's, which is what keeps a huge clock readable whatever is picked.
 */
export const PALETTE_PRESETS: Record<'ember' | 'tide', [string, string]> = {
  ember: ['#f08a3c', '#c04a2e'],
  tide: ['#3d92d4', '#2fb3a2']
}

/**
 * A picked colour arrives opaque, where the weather washes are translucent by
 * design. These alphas land an opaque pick in the same register the weather
 * tones occupy, so switching palettes changes the hue and not the intensity.
 */
const TONE_ALPHA: Record<ResolvedTheme, number> = { light: 0.46, dark: 0.3 }

function toRgba(hex: string, alpha: number): string | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const value = Number.parseInt(match[1] as string, 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * The two tone colours a non-weather palette should install, or null to let
 * the condition-driven stylesheet rules stand.
 *
 * These are written straight onto `--tone-a` / `--tone-b`, which is the whole
 * trick: the CSS washes, the shaders and the preview tiles all read those two
 * variables already, so a palette change reaches every one of them without
 * any of them knowing palettes exist.
 */
export function resolveToneOverrides(
  choice: PaletteChoice,
  custom: CustomPalette,
  theme: ResolvedTheme
): [string, string] | null {
  if (choice === 'weather') return null

  const alpha = TONE_ALPHA[theme]
  const [accent, accentAlt] =
    choice === 'custom' ? [custom.accent, custom.accentAlt] : PALETTE_PRESETS[choice]

  const a = toRgba(accent, alpha)
  const b = toRgba(accentAlt, alpha)
  return a && b ? [a, b] : null
}

/**
 * The two colours a palette will actually produce, for the picker tiles.
 *
 * A raw preset hex looks nothing like what it renders as -- it goes onto the
 * ground below full strength -- so showing the hex would make the fixed
 * palettes look vivid next to a washed-out Weather tile and the four would
 * not be comparable. These are the composited results instead.
 */
export function previewAccents(
  choice: PaletteChoice,
  custom: CustomPalette,
  live: ShaderPalette,
  theme: ResolvedTheme
): [string, string] {
  if (choice === 'weather') return [live.accent, live.accentAlt]

  const [accent, accentAlt] =
    choice === 'custom' ? [custom.accent, custom.accentAlt] : PALETTE_PRESETS[choice]
  const strength = TONE_ALPHA[theme] * ACCENT_STRENGTH

  return [flatten(live.base, accent, strength), flatten(live.base, accentAlt, strength)]
}
