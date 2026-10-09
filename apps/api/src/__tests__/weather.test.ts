import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchLiveWeather, WeatherClientError } from '../services/weather.js';

describe('Task 7: Open-Meteo Integration Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should transform raw Open-Meteo responses into the WeatherPayload contract', async () => {
    const mockOpenMeteoResponse = {
      latitude: 7.8925,
      longitude: 4.6714,
      current: {
        time: '2026-10-09T01:00',
        temperature_2m: 26.4,
        relative_humidity_2m: 82,
        wind_speed_10m: 7.8
      },
      hourly: {
        time: ['2026-10-09T00:00', '2026-10-09T01:00'],
        precipitation_probability: [15, 30]
      }
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockOpenMeteoResponse
    } as Response);

    const result = await fetchLiveWeather(7.8925, 4.6714);

    expect(result).toBeDefined();
    expect(result.temperature).toBe(26.4);
    expect(result.relativeHumidity).toBe(82);
    expect(result.windSpeed).toBe(7.8);
    expect(typeof result.precipitationProbability).toBe('number');
    expect(result.source).toBe('open-meteo');
    expect(new Date(result.fetchedAt).toString()).not.toBe('Invalid Date');

    // Confirm raw fields like `latitude` or internal metadata are not leaked
    expect((result as any).latitude).toBeUndefined();
    expect((result as any).hourly).toBeUndefined();
    expect((result as any).current).toBeUndefined();
  });

  it('should enforce the 3000ms timeout using AbortController', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce((_url, options: any) => {
      return new Promise((_, reject) => {
        options?.signal?.addEventListener('abort', () => {
          const abortError = new Error('The operation was aborted');
          abortError.name = 'AbortError';
          reject(abortError);
        });
      });
    });

    vi.useFakeTimers();

    const fetchPromise = fetchLiveWeather(7.8925, 4.6714);
    vi.advanceTimersByTime(3001);

    await expect(fetchPromise).rejects.toThrow(WeatherClientError);
    await expect(fetchPromise).rejects.toThrow(/timed out after 3000ms/);

    vi.useRealTimers();
  });

  it('should throw WeatherClientError on HTTP 500 error from upstream', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    } as Response);

    await expect(fetchLiveWeather(7.8925, 4.6714)).rejects.toThrow(WeatherClientError);
  });
});