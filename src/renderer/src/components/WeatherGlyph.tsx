import type { ReactNode } from 'react'
import type { WeatherIconKey } from '@shared/weather-codes'

/*
 * A hand-built glyph set rather than a generic line-icon pack. Everything is
 * composed from four primitives -- a filled cloud, a sun disc, a streak and a
 * pellet -- so the whole family stays consistent, and each element is
 * coloured from its own CSS variable: warm sun, blue rain, pale snow. That
 * two-tone treatment is what a monochrome outline set was missing.
 */

const BODY = 'var(--glyph-body)'
const SUN = 'var(--glyph-sun)'
const RAIN = 'var(--glyph-rain)'
const SNOW = 'var(--glyph-snow)'
const BOLT = 'var(--glyph-bolt)'

function Frame({ className, children }: { className?: string; children: ReactNode }): ReactNode {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden focusable="false">
      {children}
    </svg>
  )
}

/**
 * Two overlapping discs plus a rounded bar. The bar is what gives the cloud a
 * flat base -- the discs alone sag between their centres.
 */
function Cloud({ dy = 0, opacity = 1 }: { dy?: number; opacity?: number }): ReactNode {
  return (
    <g fill={BODY} opacity={opacity} transform={`translate(0 ${dy})`}>
      <circle cx="8.6" cy="13.5" r="4" />
      <circle cx="14.6" cy="12.5" r="5" />
      <rect x="8.6" y="12.5" width="8" height="5" rx="2.5" />
    </g>
  )
}

interface SunProps {
  cx?: number
  cy?: number
  r?: number
  rays?: boolean
  color?: string
}

function Sun({ cx = 12, cy = 12, r = 4.4, rays = true, color = SUN }: SunProps): ReactNode {
  const inner = r + 1.9
  const outer = r + 3.9

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={color} />
      {rays
        ? [0, 45, 90, 135, 180, 225, 270, 315].map((degrees) => {
            const radians = (degrees * Math.PI) / 180
            return (
              <line
                key={degrees}
                x1={cx + Math.cos(radians) * inner}
                y1={cy + Math.sin(radians) * inner}
                x2={cx + Math.cos(radians) * outer}
                y2={cy + Math.sin(radians) * outer}
                stroke={color}
                strokeWidth="1.9"
                strokeLinecap="round"
              />
            )
          })
        : null}
    </g>
  )
}

/** A falling streak of rain or drizzle. */
function Streak({
  x,
  y = 17.2,
  length = 3.6,
  color = RAIN
}: {
  x: number
  y?: number
  length?: number
  color?: string
}): ReactNode {
  return (
    <line
      x1={x}
      y1={y}
      x2={x - length * 0.3}
      y2={y + length}
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
  )
}

/** A grain of snow, a hailstone, an ice pellet. */
function Pellet({
  x,
  y,
  r = 1.15,
  color = SNOW
}: {
  x: number
  y: number
  r?: number
  color?: string
}): ReactNode {
  return <circle cx={x} cy={y} r={r} fill={color} />
}

function Bolt(): ReactNode {
  return (
    <path
      d="M13.6 15.4 L9.2 20.8 h2.6 l-1.2 3.0 4.4-5.6 h-2.6 z"
      fill={BOLT}
      strokeLinejoin="round"
    />
  )
}

function Bar({ x1, x2, y, color = BODY }: { x1: number; x2: number; y: number; color?: string }): ReactNode {
  return (
    <line
      x1={x1}
      y1={y}
      x2={x2}
      y2={y}
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
  )
}

const GLYPHS: Record<WeatherIconKey, ReactNode> = {
  sun: <Sun cx={12} cy={12} r={4.6} />,

  'cloud-sun': (
    <>
      <Sun cx={15.8} cy={8.2} r={3.1} />
      <Cloud dy={1.2} />
    </>
  ),

  cloud: <Cloud />,

  cloudy: (
    <>
      <g transform="translate(2.5 -3.5) scale(0.72)">
        <Cloud opacity={0.45} />
      </g>
      <Cloud dy={1.4} />
    </>
  ),

  fog: (
    <>
      <Cloud dy={-2.6} />
      <Bar x1={5.5} x2={16} y={18.4} />
      <Bar x1={8.5} x2={19} y={21.6} />
    </>
  ),

  haze: (
    <>
      <Sun cx={12} cy={9.6} r={3.6} />
      <Bar x1={5} x2={15.5} y={18.6} />
      <Bar x1={8.5} x2={19} y={21.8} />
    </>
  ),

  dust: (
    <>
      <Bar x1={4} x2={15} y={8.5} />
      <Bar x1={4} x2={19.5} y={12.5} />
      <Bar x1={4} x2={12.5} y={16.5} />
      <Bar x1={4} x2={17} y={20.5} />
    </>
  ),

  squall: (
    <>
      <Cloud dy={-2.6} />
      <Bar x1={6} x2={17} y={19} />
      <Bar x1={6} x2={13} y={22.2} />
    </>
  ),

  tornado: (
    <>
      <Bar x1={4} x2={20} y={6.5} />
      <Bar x1={5.5} x2={18.5} y={10} />
      <Bar x1={7.5} x2={16.5} y={13.5} />
      <Bar x1={9.5} x2={14.5} y={17} />
      <Bar x1={11} x2={13} y={20.5} />
    </>
  ),

  drizzle: (
    <>
      <Cloud dy={-2} />
      <Streak x={9} length={2.4} />
      <Streak x={12.5} y={18.4} length={2.4} />
      <Streak x={16} length={2.4} />
    </>
  ),

  rain: (
    <>
      <Cloud dy={-2} />
      <Streak x={9} />
      <Streak x={12.5} y={18.2} />
      <Streak x={16} />
    </>
  ),

  'heavy-rain': (
    <>
      <Cloud dy={-2.4} />
      <Streak x={7.8} y={16.8} length={4.6} />
      <Streak x={11.4} y={18} length={4.6} />
      <Streak x={15} y={16.8} length={4.6} />
      <Streak x={18.2} y={18} length={4.6} />
    </>
  ),

  'freezing-rain': (
    <>
      <Cloud dy={-2} />
      <Streak x={9.2} />
      <Streak x={16} />
      <Pellet x={12.8} y={20} r={1.3} />
    </>
  ),

  sleet: (
    <>
      <Cloud dy={-2} />
      <Streak x={9.2} />
      <Pellet x={13} y={19} />
      <Pellet x={16.6} y={21.6} />
    </>
  ),

  snow: (
    <>
      <Cloud dy={-2} />
      <Pellet x={9} y={19.4} />
      <Pellet x={12.6} y={21.8} />
      <Pellet x={16.2} y={19.4} />
    </>
  ),

  'heavy-snow': (
    <>
      <Cloud dy={-2.6} />
      <Pellet x={8.4} y={18.6} />
      <Pellet x={12.2} y={18.6} />
      <Pellet x={16} y={18.6} />
      <Pellet x={10.3} y={21.8} />
      <Pellet x={14.1} y={21.8} />
    </>
  ),

  hail: (
    <>
      <Cloud dy={-2.2} />
      <Pellet x={9.2} y={19.6} r={1.55} color={SNOW} />
      <Pellet x={15.4} y={19.6} r={1.55} color={SNOW} />
      <Streak x={12.6} y={18.2} length={3.4} />
    </>
  ),

  thunder: (
    <>
      <Cloud dy={-3} />
      <Bolt />
    </>
  ),

  'thunder-hail': (
    <>
      <Cloud dy={-3} />
      <Bolt />
      <Pellet x={17.2} y={19.8} r={1.4} />
    </>
  ),

  unknown: (
    <>
      <circle cx="12" cy="12" r="7.4" stroke={BODY} strokeWidth="2" />
      <circle cx="12" cy="15.6" r="1.3" fill={BODY} />
      <path
        d="M9.6 9.6a2.5 2.5 0 1 1 3.1 2.6"
        stroke={BODY}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  )
}

export function WeatherGlyph({
  icon,
  className
}: {
  icon: WeatherIconKey
  className?: string
}): ReactNode {
  return <Frame className={className}>{GLYPHS[icon]}</Frame>
}

/**
 * The UV reading's mark: a sun over a horizon, rays upward. Deliberately not
 * the sky's full disc -- at the same size and weight as the condition icon,
 * two identical suns in one row read as a mistake on a clear day.
 */
export function UvGlyph({ className }: { className?: string }): ReactNode {
  const cx = 12
  const cy = 17.4
  const radius = 4.2

  return (
    <Frame className={className}>
      <path
        d={`M${cx - radius} ${cy} A${radius} ${radius} 0 0 1 ${cx + radius} ${cy} Z`}
        fill={SUN}
      />
      {[198, 234, 270, 306, 342].map((degrees) => {
        const radians = (degrees * Math.PI) / 180
        return (
          <line
            key={degrees}
            x1={cx + Math.cos(radians) * (radius + 1.8)}
            y1={cy + Math.sin(radians) * (radius + 1.8)}
            x2={cx + Math.cos(radians) * (radius + 4.2)}
            y2={cy + Math.sin(radians) * (radius + 4.2)}
            stroke={SUN}
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        )
      })}
      <line
        x1="5.4"
        y1={cy + 2.2}
        x2="18.6"
        y2={cy + 2.2}
        stroke={SUN}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </Frame>
  )
}

/** The humidity reading's mark. */
export function HumidityGlyph({ className }: { className?: string }): ReactNode {
  return (
    <Frame className={className}>
      <path
        d="M12 3.4 Q18.6 10.9 18.6 14.4 A6.6 6.6 0 0 1 5.4 14.4 Q5.4 10.9 12 3.4 Z"
        fill={RAIN}
      />
    </Frame>
  )
}
