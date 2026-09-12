import { useEffect, type ReactNode } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
  type AppConfig,
  type HourCyclePreference,
  type ResolvedTheme,
  type TemperatureUnit,
  type ThemePreference
} from '@shared/types'
import { cn } from '../lib/cn'
import type { ShaderPalette } from '../lib/shader-palette'
import { BackgroundPicker } from './BackgroundPicker'
import { PalettePicker } from './PalettePicker'
import { FontPicker } from './FontPicker'
import { localeUsesHour12 } from '../lib/time'
import { LocationSection } from './LocationSection'
import { Segmented } from './Segmented'
import { TimeZoneSection } from './TimeZoneSection'

interface SectionProps {
  title: string
  children: ReactNode
}

function Section({ title, children }: SectionProps): ReactNode {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="label-meta">{title}</h3>
      {children}
    </section>
  )
}

interface RowProps {
  label: string
  hint?: string
  children: ReactNode
}

function Row({ label, hint, children }: RowProps): ReactNode {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-meta font-medium text-fg">{label}</span>
        {hint ? <span className="truncate text-meta text-fg-faint">{hint}</span> : null}
      </div>
      {children}
    </div>
  )
}

interface ZoomStepperProps {
  value: number
  onChange: (value: number) => void
}

/**
 * A stepper, not a slider. Zoom resizes the very panel this control sits in,
 * so a slider would slide out from under the pointer as it was dragged and
 * the value would jump around. Discrete steps leave the button where the
 * hand found it.
 */
function ZoomStepper({ value, onChange }: ZoomStepperProps): ReactNode {
  // Steps land on multiples of the step size even if the stored value did
  // not -- a hand-edited config should not knock the whole ladder askew.
  const step = (direction: -1 | 1): void => {
    const next = (Math.round(value / ZOOM_STEP) + direction) * ZOOM_STEP
    onChange(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(next.toFixed(2)))))
  }

  const button = (direction: -1 | 1, label: string, icon: ReactNode): ReactNode => {
    const limit = direction === -1 ? MIN_ZOOM : MAX_ZOOM
    const spent = direction === -1 ? value <= limit : value >= limit
    return (
      <button
        type="button"
        aria-label={label}
        title={label}
        disabled={spent}
        onClick={() => step(direction)}
        className={cn(
          'transition-soft grid size-7 place-items-center rounded-full',
          spent ? 'text-fg-faint opacity-40' : 'text-fg-muted hover:bg-raised hover:text-fg'
        )}
      >
        {icon}
      </button>
    )
  }

  return (
    <div role="group" aria-label="Zoom" className="inline-flex items-center rounded-full bg-hover p-[3px]">
      {button(-1, 'Zoom out', <Minus className="size-3.5" strokeWidth={2} />)}
      <span className="w-12 text-center text-meta font-medium tabular-nums text-fg">
        {Math.round(value * 100)}%
      </span>
      {button(1, 'Zoom in', <Plus className="size-3.5" strokeWidth={2} />)}
    </div>
  )
}

const THEMES = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
] as const satisfies ReadonlyArray<{ value: ThemePreference; label: string }>

const HOUR_CYCLES = [
  { value: 'system', label: 'System' },
  { value: '12', label: '12h' },
  { value: '24', label: '24h' }
] as const satisfies ReadonlyArray<{ value: HourCyclePreference; label: string }>

const UNITS = [
  { value: 'celsius', label: '°C' },
  { value: 'fahrenheit', label: '°F' }
] as const satisfies ReadonlyArray<{ value: TemperatureUnit; label: string }>

interface SettingsProps {
  config: AppConfig
  systemTimeZone: string
  /** The live palette, so each preview shows today's actual colours. */
  palette: ShaderPalette
  theme: ResolvedTheme
  onUpdate: (patch: Partial<AppConfig>) => void
  onClose: () => void
}

export function Settings({
  config,
  systemTimeZone,
  palette,
  theme,
  onUpdate,
  onClose
}: SettingsProps): ReactNode {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    // `no-drag` matters: this overlay sits on top of the title bar's drag
    // region, and without it the scrim would drag the window instead of
    // dismissing the panel.
    <div
      className="no-drag animate-overlay fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-[14px]"
      style={{ backgroundColor: 'var(--scrim)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(event) => event.stopPropagation()}
        className="animate-panel glass-panel transition-soft flex max-h-full w-full max-w-[34rem] flex-col rounded-[1.75rem]"
      >
        <div className="flex shrink-0 items-center justify-between px-8 pb-2 pt-7">
          <h2 className="text-body font-medium text-fg">Settings</h2>
          <button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            className="transition-soft grid size-8 place-items-center rounded-[0.625rem] text-fg-faint hover:bg-hover hover:text-fg"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* The panel itself never outgrows the window; this is the only
            scroll region, and it sits inside the rounded edge. */}
        <div className="scroll-thin flex min-h-0 flex-col gap-9 overflow-y-auto px-8 pb-8 pt-6">
          <Section title="Location">
            <LocationSection
              location={config.location}
              onSelect={(location) => onUpdate({ location })}
            />
          </Section>

          <Section title="Time zone">
            <TimeZoneSection
              override={config.timezoneOverride}
              systemTimeZone={systemTimeZone}
              cityName={config.location.name}
              cityTimeZone={config.location.timezone}
              onChange={(timezoneOverride) => onUpdate({ timezoneOverride })}
            />
          </Section>

          <Section title="Background">
            <BackgroundPicker
              value={config.background}
              palette={palette}
              wallpaper={config.wallpaper}
              dim={config.wallpaperDim}
              onChange={(background) => onUpdate({ background })}
              onDimChange={(wallpaperDim) => onUpdate({ wallpaperDim })}
            />
            <PalettePicker
              value={config.palette}
              custom={config.customPalette}
              palette={palette}
              theme={theme}
              onChange={(next) => onUpdate({ palette: next })}
              onCustomChange={(customPalette) => onUpdate({ customPalette })}
            />
          </Section>

          <Section title="Typeface">
            <FontPicker
              value={config.fontFamily}
              onChange={(fontFamily) => onUpdate({ fontFamily })}
            />
          </Section>

          <Section title="Display">
            <Row
              label="Clock format"
              hint={
                config.hourCycle === 'system'
                  ? `Locale default · ${localeUsesHour12() ? '12-hour' : '24-hour'}`
                  : undefined
              }
            >
              <Segmented
                label="Clock format"
                value={config.hourCycle}
                options={HOUR_CYCLES}
                onChange={(hourCycle) => onUpdate({ hourCycle })}
              />
            </Row>

            <Row label="Temperature">
              <Segmented
                label="Temperature unit"
                value={config.temperatureUnit}
                options={UNITS}
                onChange={(temperatureUnit) => onUpdate({ temperatureUnit })}
              />
            </Row>

            <Row label="Theme">
              <Segmented
                label="Theme"
                value={config.theme}
                options={THEMES}
                onChange={(theme) => onUpdate({ theme })}
              />
            </Row>

            <Row label="Zoom" hint="Scales the whole window">
              <ZoomStepper
                value={config.zoomFactor}
                onChange={(zoomFactor) => onUpdate({ zoomFactor })}
              />
            </Row>
          </Section>

          <p className="pt-1 text-meta text-fg-faint">
            Electric Clock {window.api.app.version}
          </p>
        </div>
      </div>
    </div>
  )
}
