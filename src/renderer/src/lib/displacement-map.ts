/**
 * Builds the normal map that bends the backdrop behind a piece of glass.
 *
 * Apple's Liquid Glass is a *lens*, not a frosted pane: the material is
 * thickest at its rim, so what shows through there is bent and compressed,
 * and the interior is left nearly clear. Reproducing that needs the actual
 * displacement per pixel, which is what this encodes -- R carries the
 * horizontal offset and G the vertical, both biased around 128 so that grey
 * means "no displacement".
 *
 * It is generated per element size rather than authored once, because the
 * bend has to follow the shape: a pill and a panel refract differently, and
 * the pill's width changes with its contents.
 */

export interface GlassGeometry {
  width: number
  height: number
  radius: number
  /** How far in from the rim the bend reaches, in pixels. */
  thickness: number
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

/** Signed distance to a rounded rectangle centred on the origin. */
function roundedRect(px: number, py: number, halfW: number, halfH: number, radius: number): number {
  const qx = Math.abs(px) - (halfW - radius)
  const qy = Math.abs(py) - (halfH - radius)
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  return outside + Math.min(Math.max(qx, qy), 0) - radius
}

export function buildDisplacementMap(geometry: GlassGeometry): string {
  const { width, height, radius, thickness } = geometry

  const canvasWidth = width
  const canvasHeight = height

  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const context = canvas.getContext('2d')
  if (!context) return ''

  const image = context.createImageData(canvasWidth, canvasHeight)
  const pixels = image.data
  const halfW = width / 2
  const halfH = height / 2
  const limit = Math.min(radius, halfW, halfH)

  for (let y = 0; y < canvasHeight; y += 1) {
    for (let x = 0; x < canvasWidth; x += 1) {
      const px = x + 0.5 - halfW
      const py = y + 0.5 - halfH
      const distance = roundedRect(px, py, halfW, halfH, limit)

      let nx = 0
      let ny = 0
      let amount = 0

      if (distance < 0) {
        // Outward normal, analytically: in the corners it points along the
        // vector out of the corner arc, along the edges it is axis-aligned.
        const qx = Math.abs(px) - (halfW - limit)
        const qy = Math.abs(py) - (halfH - limit)
        const signX = px < 0 ? -1 : 1
        const signY = py < 0 ? -1 : 1

        if (qx > 0 || qy > 0) {
          const mx = Math.max(qx, 0)
          const my = Math.max(qy, 0)
          const length = Math.hypot(mx, my) || 1
          nx = (signX * mx) / length
          ny = (signY * my) / length
        } else if (qx > qy) {
          nx = signX
        } else {
          ny = signY
        }

        // Nothing through the middle, rising into the rim: a lens edge
        // rather than a uniform warp across the whole surface.
        const depth = clamp01(1 + distance / thickness)
        amount = depth * depth * depth
      }

      /*
       * Inward.
       *
       * backdrop-filter only ever hands you the backdrop *within* the
       * element. Bending outward makes the rim ask for pixels beyond that,
       * Chromium returns nothing, and the result is the hard dark line that
       * used to ring the shape -- it was never refraction. Pulling from
       * further inside keeps every sample on real content.
       */
      const offset = (y * canvasWidth + x) * 4
      pixels[offset] = Math.round(128 - nx * amount * 127)
      pixels[offset + 1] = Math.round(128 - ny * amount * 127)
      pixels[offset + 2] = 128
      pixels[offset + 3] = 255
    }
  }

  context.putImageData(image, 0, 0)
  return canvas.toDataURL()
}
