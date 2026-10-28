/** The small fetch helpers shared by everything in main that talks to the network. */

export const REQUEST_TIMEOUT_MS = 12_000

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Carries the status, so a caller can tell an expired token from a dead server. */
export class HttpError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Request failed (${status})`)
    this.name = 'HttpError'
    this.status = status
  }
}

/** Turns transport failures into something short enough for the UI. */
export function describeError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'TimeoutError') return 'Request timed out'
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') return 'Request timed out'
    if (error.name === 'TypeError') return 'Network unavailable'
    return error.message
  }
  return 'Unknown error'
}

export async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { accept: 'application/json', ...headers }
  })
  if (!response.ok) throw new HttpError(response.status)
  return (await response.json()) as unknown
}
