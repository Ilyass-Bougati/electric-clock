import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode
} from 'react'
import { cn } from '../lib/cn'
import {
  GLASS_DEFAULTS,
  getGlassTuning,
  subscribeGlassTuning,
  type GlassTuning
} from '../lib/glass-tuning'
import { buildDisplacementMap } from '../lib/displacement-map'

/**
 * A pane of liquid glass.
 *
 * The refraction is real: an SVG filter displaces the backdrop by a normal
 * map built for this element's exact size and radius, so the rim bends what
 * is behind it the way a thick lens edge would. Three displacement passes at
 * slightly different strengths, recombined per channel, give the faint
 * prismatic fringe that a single pass cannot.
 *
 * It works over anything -- the shader background, a wallpaper, plain CSS --
 * because it filters the backdrop rather than needing to know what drew it.
 */

interface LiquidGlassProps {
  /** Layout, padding and border-radius for the pane itself. */
  className?: string
  /** How far the bend reaches in from the rim, in pixels. */
  thickness?: number
  /** Displacement strength. Higher bends harder. */
  strength?: number
  /** Interior softening. Glass is mostly clear, so this stays low. */
  blur?: number
  /** Set false on large panes, where three passes is a lot of pixels. */
  dispersion?: boolean
  /**
   * How far apart the three colour passes are bent. This is the diffraction:
   * a thick edge splits what passes through it, so the rim carries a faint
   * spectrum instead of a drawn line.
   */
  spread?: number
  children?: ReactNode
}

interface Measurement {
  width: number
  height: number
  map: string
}

export function LiquidGlass({
  className,
  thickness = GLASS_DEFAULTS.thickness,
  strength = GLASS_DEFAULTS.strength,
  blur = GLASS_DEFAULTS.blur,
  dispersion = true,
  spread = GLASS_DEFAULTS.spread,
  children
}: LiquidGlassProps): ReactNode {
  // Always null outside development, so these are the props in a shipped build.
  const override = useSyncExternalStore(subscribeGlassTuning, getGlassTuning)
  const tuning: GlassTuning = override ?? { strength, thickness, blur, spread }

  const host = useRef<HTMLDivElement>(null)
  const rawId = useId()
  const filterId = `glass${rawId.replace(/[^a-zA-Z0-9]/g, '')}`
  const [measured, setMeasured] = useState<Measurement | null>(null)

  useLayoutEffect(() => {
    const element = host.current
    if (!element) return

    let frame = 0
    let last = ''

    const measure = (): void => {
      const rect = element.getBoundingClientRect()
      const width = Math.round(rect.width)
      const height = Math.round(rect.height)
      if (width < 4 || height < 4) return

      const styles = getComputedStyle(element)
      // rounded-full resolves to a huge value; a rounded rect cannot have a
      // radius larger than half its shortest side.
      const radius = Math.min(
        Number.parseFloat(styles.borderTopLeftRadius) || 0,
        width / 2,
        height / 2
      )

      const key = `${width}x${height}r${radius}t${tuning.thickness}`
      if (key === last) return
      last = key

      setMeasured({
        width,
        height,
        map: buildDisplacementMap({ width, height, radius, thickness: tuning.thickness })
      })
    }

    // ResizeObserver fires repeatedly through a window drag; rebuilding the
    // map is a per-pixel loop, so it is coalesced to one per frame.
    const schedule = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }

    measure()
    const observer = new ResizeObserver(schedule)
    observer.observe(element)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [tuning.thickness])

  // Until the map exists there is nothing to refract, so the pane falls back
  // to a plain blur rather than flashing as a clear rectangle.
  // Blur runs *after* the displacement, so anything beyond a pixel or two
  // smears the bend away and the glass goes back to looking like frost.
  const filter = measured
    ? `url(#${filterId}) blur(${tuning.blur}px) saturate(1.7) brightness(var(--glass-lift))`
    : `blur(${tuning.blur + 6}px) saturate(1.7) brightness(var(--glass-lift))`

  return (
    <div ref={host} className={cn('glass', className)}>
      {measured ? (
        <svg aria-hidden className="pointer-events-none absolute size-0">
          <defs>
            {/*
              The region stays the element's own box. Growing it stops
              Chromium applying the filter to a backdrop at all -- the bend
              silently does nothing. The map is padded instead, and the
              displacement points inward, so no sample ever needs to reach
              outside this box.
            */}
            <filter
              id={filterId}
              filterUnits="userSpaceOnUse"
              colorInterpolationFilters="sRGB"
              x="0"
              y="0"
              width={measured.width}
              height={measured.height}
            >
              <feImage
                href={measured.map}
                x="0"
                y="0"
                width={measured.width}
                height={measured.height}
                preserveAspectRatio="none"
                result="map"
              />

              {dispersion ? (
                <>
                  <feDisplacementMap
                    in="SourceGraphic"
                    in2="map"
                    scale={tuning.strength * (1 - tuning.spread)}
                    xChannelSelector="R"
                    yChannelSelector="G"
                    result="low"
                  />
                  <feDisplacementMap
                    in="SourceGraphic"
                    in2="map"
                    scale={tuning.strength}
                    xChannelSelector="R"
                    yChannelSelector="G"
                    result="mid"
                  />
                  <feDisplacementMap
                    in="SourceGraphic"
                    in2="map"
                    scale={tuning.strength * (1 + tuning.spread)}
                    xChannelSelector="R"
                    yChannelSelector="G"
                    result="high"
                  />
                  {/* Take one channel from each pass: the rim splits into a
                      faint prism the way a real bevel does. */}
                  <feColorMatrix
                    in="low"
                    type="matrix"
                    values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
                    result="red"
                  />
                  <feColorMatrix
                    in="mid"
                    type="matrix"
                    values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
                    result="green"
                  />
                  <feColorMatrix
                    in="high"
                    type="matrix"
                    values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
                    result="blue"
                  />
                  <feComposite in="red" in2="green" operator="arithmetic" k2="1" k3="1" result="rg" />
                  <feComposite in="rg" in2="blue" operator="arithmetic" k2="1" k3="1" />
                </>
              ) : (
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="map"
                  scale={tuning.strength}
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              )}
            </filter>
          </defs>
        </svg>
      ) : null}

      <span aria-hidden className="glass-core" style={{ backdropFilter: filter }} />
      <span aria-hidden className="glass-sheen" />
      {children}
    </div>
  )
}
