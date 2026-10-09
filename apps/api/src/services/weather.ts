import { WeatherPayload, weatherPayloadSchema } from '../types/weather.js';

const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = 3000;

export class WeatherClientError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'WeatherClientError';
  }
}

/**
 * Fetches current hyperlocal weather from Open-Meteo and normalizes to WeatherPayload.
 * @param lat Latitude (-90 to 90)
 * @param lon Longitude (-180 to 180)
 * @returns Sanitized and normalized WeatherPayload
 */
export async function fetchLiveWeather(lat: number, lon: number): Promise<WeatherPayload> {
  const url = new URL(OPEN_METEO_BASE_URL);
  url.searchParams.set('latitude', lat.toString());
  url.searchParams.set('longitude', lon.toString());
  url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,wind_speed_10m');
  url.searchParams.set('hourly', 'precipitation_probability');
  url.searchParams.set('forecast_days', '1');
  url.searchParams.set('timezone', 'Africa/Lagos');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new WeatherClientError(
        `Open-Meteo upstream error: ${response.statusText}`,
        response.status
      );
    }

    const raw = await response.json();

    // Guardrail: Safely extract values without leaking raw API structure
    const current = raw.current || {};
    const hourly = raw.hourly || {};

    // Get the current hour's precipitation probability, falling back to 0
    let precipProb = 0;
    if (Array.isArray(hourly.precipitation_probability) && hourly.precipitation_probability.length > 0) {
      const now = new Date();
      const currentHour = now.getHours();
      precipProb = hourly.precipitation_probability[currentHour] ?? hourly.precipitation_probability[0] ?? 0;
    }

    const normalizedData = {
      temperature: Number(current.temperature_2m ?? 0),
      relativeHumidity: Number(current.relative_humidity_2m ?? 0),
      precipitationProbability: Number(precipProb),
      windSpeed: Number(current.wind_speed_10m ?? 0),
      fetchedAt: new Date().toISOString(),
      source: 'open-meteo' as const
    };

    // Validate against contract schema before returning
    return weatherPayloadSchema.parse(normalizedData);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new WeatherClientError(`Weather request timed out after ${TIMEOUT_MS}ms`, 504);
    }
    if (error instanceof WeatherClientError) {
      throw error;
    }
    throw new WeatherClientError(`Failed to fetch weather: ${error.message || 'Unknown error'}`);
  } finally {
    clearTimeout(timeoutId);
  }
}