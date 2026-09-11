import { useEffect, useState, type ReactNode } from 'react'
import { Search } from 'lucide-react'
import type { AppLocation, GeoResult } from '@shared/types'
import { describeLocation } from '../lib/units'

const DEBOUNCE_MS = 300
const MIN_QUERY = 2

type SearchStatus = 'idle' | 'searching' | 'empty'

interface LocationSectionProps {
  location: AppLocation
  onSelect: (location: AppLocation) => void
}

export function LocationSection({ location, onSelect }: LocationSectionProps): ReactNode {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeoResult[]>([])
  const [status, setStatus] = useState<SearchStatus>('idle')

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY) {
      setResults([])
      setStatus('idle')
      return
    }

    let active = true
    setStatus('searching')

    // Debounced so a fast typist makes one request, not eight.
    const handle = window.setTimeout(() => {
      void window.api.geocoding.search(trimmed).then((found) => {
        if (!active) return
        setResults(found)
        setStatus(found.length > 0 ? 'idle' : 'empty')
      })
    }, DEBOUNCE_MS)

    return () => {
      active = false
      window.clearTimeout(handle)
    }
  }, [query])

  const choose = (result: GeoResult): void => {
    onSelect({
      name: result.name,
      admin1: result.admin1,
      country: result.country,
      latitude: result.latitude,
      longitude: result.longitude,
      timezone: result.timezone
    })
    setQuery('')
    setResults([])
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-meta text-fg-muted">{describeLocation(location)}</p>

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
          placeholder="Search for a city"
          aria-label="Search for a city"
          spellCheck={false}
          className="transition-soft w-full rounded-xl bg-hover py-2.5 pl-10 pr-3.5 text-meta font-medium text-fg placeholder:font-normal placeholder:text-fg-faint"
        />
      </div>

      {status === 'searching' && results.length === 0 ? (
        <p className="px-3.5 text-meta text-fg-faint">Searching…</p>
      ) : null}

      {status === 'empty' ? (
        <p className="px-3.5 text-meta text-fg-faint">No matching city</p>
      ) : null}

      {results.length > 0 ? (
        <ul className="flex flex-col">
          {results.map((result) => (
            <li key={result.id}>
              <button
                type="button"
                onClick={() => choose(result)}
                className="transition-soft flex w-full flex-col gap-0.5 rounded-xl px-3.5 py-2.5 text-left hover:bg-hover"
              >
                <span className="text-meta font-medium text-fg">{result.name}</span>
                {/* admin1 + country, so two cities of the same name are distinguishable. */}
                <span className="text-meta text-fg-faint">
                  {[result.admin1, result.country].filter(Boolean).join(', ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
