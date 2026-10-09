import { WeatherPayload, weatherPayloadSchema } from '../types/weather.js';
import { WeatherClientError } from './weather.js';

const NASA_POWER_BASE_URL = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const TIMEOUT_MS = 4000;

/**
 * Secondary weather adapter targeting NASA POWER Agroclimatology API.
 */
export async function fetchNasaPowerWeather(lat: number, lon: number): Promise<WeatherPayload> {
  const url = new URL(NASA_POWER_BASE_URL);
  
  // Format target date as YYYYMMDD
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}${month}${day}`;

  url.searchParams.set('latitude', lat.toString());
  url.searchParams.set('longitude', lon.toString());
  url.searchParams.set('parameters', 'T2M,RH2M,PRECTOTCORR,WS10M');
  url.searchParams.set('community', 'AG');
  url.searchParams.set('start', todayStr);
  url.searchParams.set('end', todayStr);
  url.searchParams.set('format', 'JSON');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new WeatherClientError(
        `NASA POWER upstream error: ${response.statusText}`,
        response.status
      );
    }

    const raw = await response.json();
    const parameters = raw?.properties?.parameter;

    if (!parameters) {
      throw new WeatherClientError('Malformed NASA POWER payload: missing parameter object', 502);
    }

    // NASA maps values by date key (e.g. { "20261009": 27.5 })
    const extractLatest = (dict: Record<string, number> | undefined, fallback: number = 0): number => {
      if (!dict) return fallback;
      const keys = Object.keys(dict);
      if (keys.length === 0) return fallback;
      const latestKey = keys[keys.length - 1];
      const val = dict[latestKey];
      return typeof val === 'number' && val !== -999 ? val : fallback;
    };

    const temp = extractLatest(parameters.T2M, 26);
    const humidity = Math.min(100, Math.max(0, extractLatest(parameters.RH2M, 70)));
    const precipMm = Math.max(0, extractLatest(parameters.PRECTOTCORR, 0));
    // Convert NASA wind speed (m/s) to km/h (1 m/s = 3.6 km/h)
    const windSpeedMs = Math.max(0, extractLatest(parameters.WS10M, 2));
    const windSpeedKmH = Number((windSpeedMs * 3.6).toFixed(1));

    // Map precipitation depth (mm/day) to an estimated probability percentage (capped 0-100)
    const precipitationProbability = Math.min(100, Math.round(precipMm * 15));

    const normalizedData = {
      temperature: Number(temp.toFixed(1)),
      relativeHumidity: Number(humidity.toFixed(0)),
      precipitationProbability,
      windSpeed: windSpeedKmH,
      fetchedAt: new Date().toISOString(),
      source: 'nasa-power' as const
    };

    return weatherPayloadSchema.parse(normalizedData);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new WeatherClientError(`NASA POWER request timed out after ${TIMEOUT_MS}ms`, 504);
    }
    if (error instanceof WeatherClientError) {
      throw error;
    }
    throw new WeatherClientError(`Failed to fetch from NASA POWER: ${error.message || 'Unknown error'}`);
  } finally {
    clearTimeout(timeoutId);
  }
}