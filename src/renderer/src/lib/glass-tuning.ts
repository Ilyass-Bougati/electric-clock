/**
 * The glass material's tunable numbers, in one place, with a development-time
 * override so they can be compared live instead of rebuilt one at a time.
 *
 * Nothing writes the override in a production build -- the panel that does is
 * rendered behind `import.meta.env.DEV` and disappears when Vite folds that
 * constant to false -- so every pane falls back to these defaults there.
 */
export interface GlassTuning {
  /** How hard the rim bends what is behind it, in pixels of displacement. */
  strength: number
  /** How far in from the rim the bend reaches, in pixels. */
  thickness: number
  /** Interior softening. Glass is mostly clear, so this stays near zero --
   *  blur is applied after the bend and will smear it away. */
  blur: number
  /** Spacing of the three colour passes: the diffraction. */
  spread: number
}

export const GLASS_DEFAULTS: GlassTuning = {
  strength: 56,
  thickness: 22,
  blur: 2,
  spread: 0.06
}

export const GLASS_RANGES: Record<keyof GlassTuning, { min: number; max: number; step: number }> = {
  strength: { min: 0, max: 160, step: 1 },
  thickness: { min: 2, max: 48, step: 1 },
  blur: { min: 0, max: 12, step: 0.5 },
  spread: { min: 0, max: 0.3, step: 0.005 }
}

let override: GlassTuning | null = null
const listeners = new Set<() => void>()

export function getGlassTuning(): GlassTuning | null {
  return override
}

export function setGlassTuning(next: GlassTuning | null): void {
  override = next
  for (const listener of listeners) listener()
}

export function subscribeGlassTuning(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
