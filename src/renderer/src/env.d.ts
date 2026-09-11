/// <reference types="vite/client" />

import type { WeatherApi } from '@shared/types'

declare global {
  interface Window {
    /** Installed by the preload bridge; the renderer's only door to Node. */
    api: WeatherApi
  }
}

export {}
