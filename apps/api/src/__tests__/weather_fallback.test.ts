import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchResilientWeather } from '../services/weather_resilient.js';
import * as openMeteoService from '../services/weather.js';
import * as nasaPowerService from '../services/nasa_power.js';
import { logger } from '../utils/logger.js';

describe('Task 9: NASA POWER Secondary Weather Fallback Adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should return Open-Meteo payload when primary provider is healthy', async () => {
    const mockPrimary = {
      temperature: 27.2,
      relativeHumidity: 78,
      precipitationProbability: 20,
      windSpeed: 6.5,
      fetchedAt: new Date().toISOString(),
      source: 'open-meteo' as const
    };

    const openMeteoSpy = vi.spyOn(openMeteoService, 'fetchLiveWeather').mockResolvedValue(mockPrimary);
    const nasaSpy = vi.spyOn(nasaPowerService, 'fetchNasaPowerWeather');

    const result = await fetchResilientWeather(7.8925, 4.6714);

    expect(result.source).toBe('open-meteo');
    expect(result.temperature).toBe(27.2);
    expect(openMeteoSpy).toHaveBeenCalledTimes(1);
    expect(nasaSpy).not.toHaveBeenCalled();
  });

  it('should failover to NASA POWER and log structured warning to Pino on Open-Meteo HTTP 500', async () => {
    const mockFallback = {
      temperature: 28.0,
      relativeHumidity: 72,
      precipitationProbability: 15,
      windSpeed: 7.2,
      fetchedAt: new Date().toISOString(),
      source: 'nasa-power' as const
    };

    // 1. Mock Open-Meteo HTTP 500 error
    vi.spyOn(openMeteoService, 'fetchLiveWeather').mockRejectedValueOnce(
      new openMeteoService.WeatherClientError('Open-Meteo server down', 500)
    );

    // 2. Mock NASA POWER successful return
    const nasaSpy = vi.spyOn(nasaPowerService, 'fetchNasaPowerWeather').mockResolvedValueOnce(mockFallback);

    // 3. Spy on Pino logger.warn
    const loggerSpy = vi.spyOn(logger, 'warn');

    const result = await fetchResilientWeather(7.8925, 4.6714);

    // Assert fallback payload characteristics
    expect(result.source).toBe('nasa-power');
    expect(result.temperature).toBe(28.0);
    expect(nasaSpy).toHaveBeenCalledTimes(1);

    // Assert Pino logged structured metadata
    expect(loggerSpy).toHaveBeenCalledTimes(1);
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'open-meteo-failure',
        statusCode: 500
      }),
      expect.stringContaining('Open-Meteo failure detected')
    );
  });

  it('should failover to NASA POWER when Open-Meteo times out (504 / AbortError)', async () => {
    const mockFallback = {
      temperature: 26.5,
      relativeHumidity: 80,
      precipitationProbability: 10,
      windSpeed: 5.4,
      fetchedAt: new Date().toISOString(),
      source: 'nasa-power' as const
    };

    vi.spyOn(openMeteoService, 'fetchLiveWeather').mockRejectedValueOnce(
      new openMeteoService.WeatherClientError('Weather request timed out after 3000ms', 504)
    );

    const nasaSpy = vi.spyOn(nasaPowerService, 'fetchNasaPowerWeather').mockResolvedValueOnce(mockFallback);
    const loggerSpy = vi.spyOn(logger, 'warn');

    const result = await fetchResilientWeather(7.8925, 4.6714);

    expect(result.source).toBe('nasa-power');
    expect(nasaSpy).toHaveBeenCalledTimes(1);
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'open-meteo-failure',
        statusCode: 504
      }),
      expect.any(String)
    );
  });
});