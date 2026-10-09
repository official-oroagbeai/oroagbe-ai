import { WeatherPayload } from '../types/weather.js';
import { fetchLiveWeather, WeatherClientError } from './weather.js';
import { fetchNasaPowerWeather } from './nasa_power.js';
import { logger } from '../utils/logger.js';

/**
 * Resilient weather fetching pipeline:
 * 1. Attempts Open-Meteo.
 * 2. On HTTP 5xx or timeout (AbortError / 504), logs warning to Pino and fails over to NASA POWER.
 * 3. Returns WeatherPayload tagged with active source.
 */
export async function fetchResilientWeather(lat: number, lon: number): Promise<WeatherPayload> {
  try {
    return await fetchLiveWeather(lat, lon);
  } catch (primaryError: any) {
    const is5xx = primaryError instanceof WeatherClientError && primaryError.statusCode && primaryError.statusCode >= 500;
    const isTimeout =
      primaryError.name === 'AbortError' ||
      primaryError.statusCode === 504 ||
      primaryError.message?.includes('timed out');

    // Only fail over on upstream outages or network timeouts
    if (is5xx || isTimeout) {
      logger.warn(
        {
          reason: 'open-meteo-failure',
          statusCode: primaryError.statusCode,
          error: primaryError.message,
          coordinates: { lat, lon }
        },
        'Open-Meteo failure detected. Failing over to NASA POWER adapter'
      );

      return await fetchNasaPowerWeather(lat, lon);
    }

    // Re-throw 4xx or unexpected client-side input errors
    throw primaryError;
  }
}