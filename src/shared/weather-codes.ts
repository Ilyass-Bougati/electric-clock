/**
 * WMO 4677 present-weather codes.
 *
 * Open-Meteo only emits a documented subset, and for codes 1-3 it assigns
 * its own meanings (mainly clear / partly cloudy / overcast) that differ
 * from the raw WMO table -- those readings win here, since Open-Meteo is
 * the data source. Every other code in 0-99 is filled in from WMO 4677 so
 * an unexpected value still renders something truthful instead of a blank.
 */

export type WeatherIconKey =
  | 'sun'
  | 'cloud-sun'
  | 'cloud'
  | 'cloudy'
  | 'fog'
  | 'haze'
  | 'dust'
  | 'squall'
  | 'tornado'
  | 'drizzle'
  | 'rain'
  | 'heavy-rain'
  | 'freezing-rain'
  | 'sleet'
  | 'snow'
  | 'heavy-snow'
  | 'hail'
  | 'thunder'
  | 'thunder-hail'
  | 'unknown'

export interface WeatherCondition {
  label: string
  icon: WeatherIconKey
}

const CONDITIONS: Record<number, WeatherCondition> = {
  // 0-19 -- no precipitation at the station at observation time
  0: { label: 'Clear', icon: 'sun' },
  1: { label: 'Mainly clear', icon: 'cloud-sun' },
  2: { label: 'Partly cloudy', icon: 'cloud' },
  3: { label: 'Overcast', icon: 'cloudy' },
  4: { label: 'Smoke', icon: 'haze' },
  5: { label: 'Haze', icon: 'haze' },
  6: { label: 'Dust haze', icon: 'dust' },
  7: { label: 'Blowing dust', icon: 'dust' },
  8: { label: 'Dust whirls', icon: 'dust' },
  9: { label: 'Duststorm nearby', icon: 'dust' },
  10: { label: 'Mist', icon: 'fog' },
  11: { label: 'Shallow fog', icon: 'fog' },
  12: { label: 'Shallow fog', icon: 'fog' },
  13: { label: 'Distant lightning', icon: 'thunder' },
  14: { label: 'Virga', icon: 'drizzle' },
  15: { label: 'Distant precipitation', icon: 'rain' },
  16: { label: 'Precipitation nearby', icon: 'rain' },
  17: { label: 'Dry thunderstorm', icon: 'thunder' },
  18: { label: 'Squalls', icon: 'squall' },
  19: { label: 'Funnel cloud', icon: 'tornado' },

  // 20-29 -- precipitation in the preceding hour, not right now
  20: { label: 'Recent drizzle', icon: 'drizzle' },
  21: { label: 'Recent rain', icon: 'rain' },
  22: { label: 'Recent snow', icon: 'snow' },
  23: { label: 'Recent sleet', icon: 'sleet' },
  24: { label: 'Recent freezing rain', icon: 'freezing-rain' },
  25: { label: 'Recent showers', icon: 'rain' },
  26: { label: 'Recent snow showers', icon: 'snow' },
  27: { label: 'Recent hail', icon: 'hail' },
  28: { label: 'Recent fog', icon: 'fog' },
  29: { label: 'Recent thunderstorm', icon: 'thunder' },

  // 30-39 -- duststorm, sandstorm, drifting or blowing snow
  30: { label: 'Duststorm easing', icon: 'dust' },
  31: { label: 'Duststorm', icon: 'dust' },
  32: { label: 'Duststorm intensifying', icon: 'dust' },
  33: { label: 'Severe duststorm easing', icon: 'dust' },
  34: { label: 'Severe duststorm', icon: 'dust' },
  35: { label: 'Severe duststorm intensifying', icon: 'dust' },
  36: { label: 'Drifting snow', icon: 'snow' },
  37: { label: 'Heavy drifting snow', icon: 'heavy-snow' },
  38: { label: 'Blowing snow', icon: 'snow' },
  39: { label: 'Heavy blowing snow', icon: 'heavy-snow' },

  // 40-49 -- fog and ice fog
  40: { label: 'Fog nearby', icon: 'fog' },
  41: { label: 'Patchy fog', icon: 'fog' },
  42: { label: 'Fog, thinning', icon: 'fog' },
  43: { label: 'Fog, thinning', icon: 'fog' },
  44: { label: 'Fog', icon: 'fog' },
  45: { label: 'Fog', icon: 'fog' },
  46: { label: 'Fog, thickening', icon: 'fog' },
  47: { label: 'Fog, thickening', icon: 'fog' },
  48: { label: 'Rime fog', icon: 'fog' },
  49: { label: 'Rime fog', icon: 'fog' },

  // 50-59 -- drizzle
  50: { label: 'Light drizzle', icon: 'drizzle' },
  51: { label: 'Light drizzle', icon: 'drizzle' },
  52: { label: 'Drizzle', icon: 'drizzle' },
  53: { label: 'Drizzle', icon: 'drizzle' },
  54: { label: 'Dense drizzle', icon: 'drizzle' },
  55: { label: 'Dense drizzle', icon: 'drizzle' },
  56: { label: 'Light freezing drizzle', icon: 'freezing-rain' },
  57: { label: 'Freezing drizzle', icon: 'freezing-rain' },
  58: { label: 'Light drizzle and rain', icon: 'drizzle' },
  59: { label: 'Drizzle and rain', icon: 'rain' },

  // 60-69 -- rain
  60: { label: 'Light rain', icon: 'rain' },
  61: { label: 'Light rain', icon: 'rain' },
  62: { label: 'Rain', icon: 'rain' },
  63: { label: 'Rain', icon: 'rain' },
  64: { label: 'Heavy rain', icon: 'heavy-rain' },
  65: { label: 'Heavy rain', icon: 'heavy-rain' },
  66: { label: 'Light freezing rain', icon: 'freezing-rain' },
  67: { label: 'Freezing rain', icon: 'freezing-rain' },
  68: { label: 'Light sleet', icon: 'sleet' },
  69: { label: 'Sleet', icon: 'sleet' },

  // 70-79 -- solid precipitation, not showers
  70: { label: 'Light snow', icon: 'snow' },
  71: { label: 'Light snow', icon: 'snow' },
  72: { label: 'Snow', icon: 'snow' },
  73: { label: 'Snow', icon: 'snow' },
  74: { label: 'Heavy snow', icon: 'heavy-snow' },
  75: { label: 'Heavy snow', icon: 'heavy-snow' },
  76: { label: 'Diamond dust', icon: 'snow' },
  77: { label: 'Snow grains', icon: 'snow' },
  78: { label: 'Snow crystals', icon: 'snow' },
  79: { label: 'Ice pellets', icon: 'hail' },

  // 80-90 -- showers
  80: { label: 'Light showers', icon: 'rain' },
  81: { label: 'Rain showers', icon: 'rain' },
  82: { label: 'Violent showers', icon: 'heavy-rain' },
  83: { label: 'Light sleet showers', icon: 'sleet' },
  84: { label: 'Sleet showers', icon: 'sleet' },
  85: { label: 'Light snow showers', icon: 'snow' },
  86: { label: 'Snow showers', icon: 'heavy-snow' },
  87: { label: 'Light snow pellets', icon: 'hail' },
  88: { label: 'Snow pellets', icon: 'hail' },
  89: { label: 'Light hail', icon: 'hail' },
  90: { label: 'Hail', icon: 'hail' },

  // 91-99 -- thunderstorms
  91: { label: 'Thunderstorm, light rain', icon: 'thunder' },
  92: { label: 'Thunderstorm, heavy rain', icon: 'thunder' },
  93: { label: 'Thunderstorm with hail', icon: 'thunder-hail' },
  94: { label: 'Thunderstorm with heavy hail', icon: 'thunder-hail' },
  95: { label: 'Thunderstorm', icon: 'thunder' },
  96: { label: 'Thunderstorm with hail', icon: 'thunder-hail' },
  97: { label: 'Heavy thunderstorm', icon: 'thunder' },
  98: { label: 'Thunderstorm with dust', icon: 'thunder' },
  99: { label: 'Severe hailstorm', icon: 'thunder-hail' }
}

const UNKNOWN: WeatherCondition = { label: 'Unknown', icon: 'unknown' }

export function describeWeatherCode(code: number): WeatherCondition {
  return CONDITIONS[code] ?? UNKNOWN
}

/**
 * The ambient mood a condition puts the whole window in. Drives the two
 * background washes, which are what the weather strip blurs -- without
 * something to blur, glass reads as nothing at all.
 */
export type WeatherTone = 'clear' | 'cloud' | 'rain' | 'snow' | 'storm' | 'fog' | 'dust'

const TONES: Record<WeatherIconKey, WeatherTone> = {
  sun: 'clear',
  'cloud-sun': 'clear',
  cloud: 'cloud',
  cloudy: 'cloud',
  fog: 'fog',
  haze: 'fog',
  dust: 'dust',
  squall: 'dust',
  tornado: 'dust',
  drizzle: 'rain',
  rain: 'rain',
  'heavy-rain': 'rain',
  'freezing-rain': 'rain',
  sleet: 'snow',
  snow: 'snow',
  'heavy-snow': 'snow',
  hail: 'snow',
  thunder: 'storm',
  'thunder-hail': 'storm',
  unknown: 'cloud'
}

export function toneForIcon(icon: WeatherIconKey): WeatherTone {
  return TONES[icon]
}
