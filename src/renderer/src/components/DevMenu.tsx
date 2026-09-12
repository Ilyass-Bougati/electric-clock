import { useState, type ReactNode } from 'react'
import { FlaskConical } from 'lucide-react'
import { GlassTuner } from './GlassTuner'
import { setGlassTuning } from '../lib/glass-tuning'
import { cn } from '../lib/cn'

/**
 * Development-only. Keeps the tuning controls out of the way until asked
 * for -- they are scaffolding, and a panel permanently parked over the
 * corner of the clock makes every screenshot a lie about how the app looks.
 *
 * Nothing here reaches a build: App renders this behind
 * `import.meta.env.DEV`, which Vite folds to false, taking the component and
 * everything it imports with it.
 */
export function DevMenu(): ReactNode {
  const [open, setOpen] = useState(false)

  return (
    // `no-drag` on the wrapper: this sits over the page, not the title bar,
    // but the panel is draggable-adjacent enough to be worth pinning down.
    <div className="no-drag fixed bottom-4 left-4 z-40 flex flex-col items-start gap-2">
      {open ? (
        <div className="animate-panel glass-panel flex w-[17rem] flex-col gap-3.5 rounded-2xl px-4 py-3.5">
          <div className="flex items-baseline justify-between">
            <h2 className="label-meta">Glass</h2>
            <button
              type="button"
              onClick={() => setGlassTuning(null)}
              className="transition-soft rounded px-1.5 py-0.5 text-meta text-fg-faint hover:bg-hover hover:text-fg"
            >
              reset
            </button>
          </div>

          <GlassTuner />
        </div>
      ) : null}

      {/*
        Deliberately faint: it should be findable, not part of the design.
      */}
      <button
        type="button"
        aria-label="Developer options"
        aria-pressed={open}
        title="Developer options"
        onClick={() => setOpen((previous) => !previous)}
        className={cn(
          'transition-soft grid size-7 place-items-center rounded-lg',
          open ? 'bg-hover text-fg' : 'text-fg-faint opacity-40 hover:bg-hover hover:opacity-100'
        )}
      >
        <FlaskConical className="size-3.5" strokeWidth={1.75} />
      </button>
    </div>
  )
}
