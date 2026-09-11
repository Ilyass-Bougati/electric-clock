import { useMemo, useState, type ReactNode } from 'react'
import { Check, Search } from 'lucide-react'
import { cn } from '../lib/cn'
import { listTimeZones, timeZoneOffsetLabel } from '../lib/time'

/** Long enough to scroll through, short enough to stay responsive. */
const MAX_VISIBLE = 60

interface ZoneRowProps {
  title: string
  subtitle: string
  selected: boolean
  onClick: () => void
}

function ZoneRow({ title, subtitle, selected, onClick }: ZoneRowProps): ReactNode {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'transition-soft flex w-full items-center gap-3 rounded-xl px-3.5 py-2 text-left',
        selected ? 'bg-hover' : 'hover:bg-hover'
      )}
    >
      <span className="min-w-0 flex-1 truncate text-meta font-medium text-fg">{title}</span>
      {subtitle ? <span className="shrink-0 text-meta text-fg-faint">{subtitle}</span> : null}
      <Check
        className={cn('size-3.5 shrink-0 text-fg-muted', selected ? 'opacity-100' : 'opacity-0')}
        strokeWidth={2}
        aria-hidden
      />
    </button>
  )
}

interface TimeZoneSectionProps {
  override: string | null
  systemTimeZone: string
  cityName: string
  cityTimeZone: string
  onChange: (timeZone: string | null) => void
}

export function TimeZoneSection({
  override,
  systemTimeZone,
  cityName,
  cityTimeZone,
  onChange
}: TimeZoneSectionProps): ReactNode {
  const [query, setQuery] = useState('')

  const zones = useMemo(() => listTimeZones(systemTimeZone), [systemTimeZone])

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/\s+/g, '_')
    const pool = needle ? zones.filter((zone) => zone.toLowerCase().includes(needle)) : zones
    return pool.slice(0, MAX_VISIBLE)
  }, [zones, query])

  // The city's own zone is stored with the location; offer it directly rather
  // than making the user find it in a list of several hundred.
  const offerCityZone = cityTimeZone !== systemTimeZone

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col">
        <ZoneRow
          title="Follow system"
          subtitle={systemTimeZone.replace(/_/g, ' ')}
          selected={override === null}
          onClick={() => onChange(null)}
        />
        {offerCityZone ? (
          <ZoneRow
            title={`Use ${cityName} time`}
            subtitle={cityTimeZone.replace(/_/g, ' ')}
            selected={override === cityTimeZone}
            onClick={() => onChange(cityTimeZone)}
          />
        ) : null}
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-faint"
          strokeWidth={1.75}
          aria-hidden
        />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search time zones"
          aria-label="Search time zones"
          spellCheck={false}
          className="transition-soft w-full rounded-xl bg-hover py-2.5 pl-10 pr-3.5 text-meta font-medium text-fg placeholder:font-normal placeholder:text-fg-faint"
        />
      </div>

      <div className="scroll-thin flex max-h-48 flex-col overflow-y-auto">
        {matches.length === 0 ? (
          <p className="px-3.5 py-2 text-meta text-fg-faint">No matching time zone</p>
        ) : (
          matches.map((zone) => (
            <ZoneRow
              key={zone}
              title={zone.replace(/_/g, ' ')}
              subtitle={timeZoneOffsetLabel(zone)}
              selected={override === zone}
              onClick={() => onChange(zone)}
            />
          ))
        )}
      </div>
    </div>
  )
}
