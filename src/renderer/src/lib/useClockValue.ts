import { useCallback, useSyncExternalStore } from 'react'
import { getTick, subscribeToTick } from './ticker'

/**
 * Subscribes to the shared second-tick and returns `format(now)`.
 *
 * useSyncExternalStore bails out when the snapshot is unchanged, so a
 * consumer only re-renders when its own formatted string changes -- the
 * date line recomputes every second and re-renders once a day.
 *
 * `format` must be stable (wrap it in useMemo/useCallback).
 */
export function useClockValue(format: (timestamp: number) => string): string {
  const getSnapshot = useCallback(() => format(getTick()), [format])
  return useSyncExternalStore(subscribeToTick, getSnapshot)
}
