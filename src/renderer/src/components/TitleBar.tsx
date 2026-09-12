import type { ReactNode } from 'react'
import {
  Clock,
  Copy,
  Hourglass,
  Maximize,
  MapPin,
  Minimize,
  Minus,
  Settings,
  Square,
  Timer,
  X
} from 'lucide-react'
import type { ClockMode } from '@shared/types'
import { cn } from '../lib/cn'

interface StripButtonProps {
  label: string
  onClick: () => void
  children: ReactNode
}

/**
 * Low contrast at rest, a background only on hover. `no-drag` is mandatory:
 * without it the click is eaten by the surrounding drag region.
 */
function StripButton({ label, onClick, children }: StripButtonProps): ReactNode {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="no-drag transition-soft grid size-8 place-items-center rounded-[0.625rem] text-fg-faint hover:bg-hover hover:text-fg"
    >
      {children}
    </button>
  )
}

const MODES: ReadonlyArray<{ value: ClockMode; label: string }> = [
  { value: 'clock', label: 'Clock' },
  { value: 'chrono', label: 'Stopwatch' },
  { value: 'timer', label: 'Timer' }
]

function ModeIcon({ mode }: { mode: ClockMode }): ReactNode {
  const className = 'size-4'
  if (mode === 'chrono') return <Timer className={className} strokeWidth={1.75} />
  if (mode === 'timer') return <Hourglass className={className} strokeWidth={1.75} />
  return <Clock className={className} strokeWidth={1.75} />
}

interface TitleBarProps {
  place: string
  mode: ClockMode
  onSelectMode: (mode: ClockMode) => void
  maximized: boolean
  fullScreen: boolean
  /** Fades the whole strip away while a full-screen clock sits idle. */
  dimmed: boolean
  onOpenSettings: () => void
}

export function TitleBar({
  place,
  mode,
  onSelectMode,
  maximized,
  fullScreen,
  dimmed,
  onOpenSettings
}: TitleBarProps): ReactNode {
  return (
    // No border, no background of its own: the strip is part of the page.
    <header
      className={cn(
        'drag absolute inset-x-0 top-0 z-20 flex h-14 items-center justify-between px-4 pl-6',
        'transition-opacity duration-[400ms] ease-[var(--ease)]',
        dimmed ? 'pointer-events-none opacity-0' : 'opacity-100'
      )}
    >
      {/* Keyed on the mode so it fades when the mode changes, and stays put
          when only the city name does. */}
      <div key={mode} className="mode-entering flex min-w-0 items-center gap-2 text-fg-faint">
        {mode === 'clock' ? (
          <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
        ) : (
          <span className="shrink-0 [&_svg]:size-3.5">
            <ModeIcon mode={mode} />
          </span>
        )}
        <span className="display-face truncate text-meta font-medium">{place}</span>
      </div>

      <div className="flex items-center gap-1">
        {/*
          Three modes is one too many to cycle through a single button
          without the icon becoming a riddle, so they are all shown. The
          active one is marked by contrast alone, keeping the strip quiet.
        */}
        <div role="group" aria-label="Mode" className="mr-1 flex items-center gap-1">
          {MODES.map((entry) => (
            <button
              key={entry.value}
              type="button"
              aria-label={entry.label}
              aria-pressed={entry.value === mode}
              title={entry.label}
              onClick={() => onSelectMode(entry.value)}
              className={cn(
                'no-drag transition-soft grid size-8 place-items-center rounded-[0.625rem]',
                entry.value === mode
                  ? 'bg-hover text-fg'
                  : 'text-fg-faint hover:bg-hover hover:text-fg'
              )}
            >
              <ModeIcon mode={entry.value} />
            </button>
          ))}
        </div>

        <StripButton
          label={fullScreen ? 'Leave full screen' : 'Full screen'}
          onClick={() => window.api.window.toggleFullScreen()}
        >
          {fullScreen ? (
            <Minimize className="size-4" strokeWidth={1.75} />
          ) : (
            <Maximize className="size-4" strokeWidth={1.75} />
          )}
        </StripButton>

        <StripButton label="Settings" onClick={onOpenSettings}>
          <Settings className="size-4" strokeWidth={1.75} />
        </StripButton>

        <div className="ml-2 flex items-center gap-1">
          <StripButton label="Minimise" onClick={() => window.api.window.minimize()}>
            <Minus className="size-4" strokeWidth={1.75} />
          </StripButton>
          <StripButton
            label={maximized ? 'Restore' : 'Maximise'}
            onClick={() => window.api.window.toggleMaximize()}
          >
            {maximized ? (
              <Copy className="size-3.5" strokeWidth={1.75} />
            ) : (
              <Square className="size-3.5" strokeWidth={1.75} />
            )}
          </StripButton>
          <StripButton label="Close" onClick={() => window.api.window.close()}>
            <X className="size-4" strokeWidth={1.75} />
          </StripButton>
        </div>
      </div>
    </header>
  )
}
