import type { ReactNode } from 'react'
import { Copy, Maximize, MapPin, Minimize, Minus, Settings, Square, X } from 'lucide-react'
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

interface TitleBarProps {
  place: string
  maximized: boolean
  fullScreen: boolean
  /** Fades the whole strip away while a full-screen clock sits idle. */
  dimmed: boolean
  onOpenSettings: () => void
}

export function TitleBar({
  place,
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
      <div className="flex min-w-0 items-center gap-2 text-fg-faint">
        <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
        <span className="display-face truncate text-meta font-medium">{place}</span>
      </div>

      <div className="flex items-center gap-1">
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
