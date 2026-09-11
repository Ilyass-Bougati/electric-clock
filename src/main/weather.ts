import type { AppLocation, GeoResult, WeatherSnapshot, WeatherState } from '@shared/types'

const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast'
const GEOCODING_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search'

const POLL_INTERVAL_MS = 15 * 60 * 1000
const REQUEST_TIMEOUT_MS = 12_000

type Listener = (state: WeatherState) => void

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Malformed response: missing ${field}`)
  }
  return value
}

/** Turns transport failures into something short enough for the UI. */
function describeError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'TimeoutError') return 'Request timed out'
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') return 'Request timed out'
    if (error.name === 'TypeError') return 'Network unavailable'
    return error.message
  }
  return 'Unknown error'
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { accept: 'application/json' }
  })
  if (!response.ok) throw new Error(`Request failed (${response.status})`)
  return (await response.json()) as unknown
}

async function fetchForecast(location: AppLocation): Promise<WeatherSnapshot> {
  // Exactly the five readings the strip shows, and nothing else: the daily
  // high/low and wind were dropped from the UI, so they are no longer asked
  // for either.
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current:
      'temperature_2m,apparent_temperature,weather_code,relative_humidity_2m,uv_index',
    timezone: 'auto'
  })

  const body = await getJson(`${FORECAST_ENDPOINT}?${params.toString()}`)
  if (!isRecord(body)) throw new Error('Malformed response')

  const current = body.current
  if (!isRecord(current)) throw new Error('Malformed response')

  return {
    temperatureC: requireNumber(current.temperature_2m, 'temperature'),
    apparentTemperatureC: requireNumber(current.apparent_temperature, 'apparent temperature'),
    weatherCode: requireNumber(current.weather_code, 'weather code'),
    humidity: requireNumber(current.relative_humidity_2m, 'humidity'),
    uvIndex: requireNumber(current.uv_index, 'UV index'),
    fetchedAt: Date.now(),
    location
  }
}

export async function searchCities(query: string): Promise<GeoResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const params = new URLSearchParams({ name: trimmed, count: '5' })
  const body = await getJson(`${GEOCODING_ENDPOINT}?${params.toString()}`)
  if (!isRecord(body) || !Array.isArray(body.results)) return []

  return body.results.flatMap((entry: unknown): GeoResult[] => {
    if (!isRecord(entry)) return []
    const { id, name, latitude, longitude } = entry
    if (typeof name !== 'string') return []
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return []

    return [
      {
        id: typeof id === 'number' ? id : latitude * 1000 + longitude,
        name,
        admin1: typeof entry.admin1 === 'string' ? entry.admin1 : null,
        country: typeof entry.country === 'string' ? entry.country : '',
        countryCode: typeof entry.country_code === 'string' ? entry.country_code : '',
        latitude,
        longitude,
        timezone: typeof entry.timezone === 'string' ? entry.timezone : 'UTC'
      }
    ]
  })
}

function sameCoordinates(a: AppLocation, b: AppLocation): boolean {
  return a.latitude === b.latitude && a.longitude === b.longitude
}

/**
 * Owns the polling loop and the last-known-good snapshot. Failures never
 * clear a snapshot for the same place: the renderer keeps rendering the
 * cached reading and marks it stale instead of blanking out.
 */
export class WeatherService {
  private state: WeatherState = { status: 'idle', snapshot: null, error: null }
  private location: AppLocation
  private timer: NodeJS.Timeout | null = null
  private listeners = new Set<Listener>()
  /** Guards against a slow reply for a city the user has already left. */
  private requestId = 0

  constructor(location: AppLocation) {
    this.location = location
  }

  getState(): WeatherState {
    return this.state
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  start(): void {
    void this.run()
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.listeners.clear()
  }

  setLocation(next: AppLocation): void {
    const changed = !sameCoordinates(this.location, next)
    this.location = next
    if (!changed) return

    // A snapshot for the previous city would be a wrong answer under a new
    // heading, so it is dropped rather than shown as stale.
    this.setState({ status: 'loading', snapshot: null, error: null })
    void this.run()
  }

  async refresh(): Promise<WeatherState> {
    await this.run()
    return this.state
  }

  private setState(next: WeatherState): void {
    this.state = next
    for (const listener of this.listeners) listener(next)
  }

  private async run(): Promise<void> {
    const id = ++this.requestId
    const target = this.location

    if (!this.state.snapshot) {
      this.setState({ status: 'loading', snapshot: null, error: null })
    }

    try {
      const snapshot = await fetchForecast(target)
      if (id !== this.requestId) return
      this.setState({ status: 'ok', snapshot, error: null })
    } catch (error) {
      if (id !== this.requestId) return
      const cached = this.state.snapshot
      this.setState({
        status: cached ? 'stale' : 'error',
        snapshot: cached,
        error: describeError(error)
      })
    } finally {
      if (id === this.requestId) this.schedule()
    }
  }

  /** Re-armed after every attempt so a manual refresh rebases the cycle. */
  private schedule(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      void this.run()
    }, POLL_INTERVAL_MS)
  }
}
