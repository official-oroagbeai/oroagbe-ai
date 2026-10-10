import { describe, it, expect } from 'vitest';
import { computeAgronomicIndices, WeatherTelemetry } from '../lib/climate_index';

describe('Task 17: Agronomic Climate Index Engine', () => {
  it('should flag HAZARDOUS spray window and leaching hazard when rain probability >= 40% and forecast rain >= 15mm', () => {
    const stormTelemetry: WeatherTelemetry = {
      temperature: 25,
      relativeHumidity: 90,
      precipitation: 4,
      precipitationProbability: 75,
      windSpeed: 10,
      weatherCode: 63,
      forecastRainSum24h: 22
    };

    const report = computeAgronomicIndices(stormTelemetry);

    expect(report.sprayWindow.level).toBe('HAZARDOUS');
    expect(report.sprayWindow.badgeEn).toBe('Unsafe to Spray');
    expect(report.sprayWindow.badgeYo).toContain('Má Fún Oògùn');

    expect(report.nitrogenWindow.level).toBe('HAZARDOUS');
    expect(report.nitrogenWindow.badgeEn).toBe('Leaching Hazard');

    expect(report.dryingIndex.level).toBe('HAZARDOUS');
  });

  it('should flag HAZARDOUS spray window when wind speed exceeds 15 km/h even without rain', () => {
    const windyTelemetry: WeatherTelemetry = {
      temperature: 30,
      relativeHumidity: 50,
      precipitation: 0,
      precipitationProbability: 10,
      windSpeed: 18,
      weatherCode: 1,
      forecastRainSum24h: 0
    };

    const report = computeAgronomicIndices(windyTelemetry);

    expect(report.sprayWindow.level).toBe('HAZARDOUS');
    expect(report.sprayWindow.advisoryEn).toContain('wind speed (18 km/h)');
  });

  it('should mark all indices SAFE under calm, dry weather conditions', () => {
    const calmTelemetry: WeatherTelemetry = {
      temperature: 27,
      relativeHumidity: 55,
      precipitation: 0,
      precipitationProbability: 5,
      windSpeed: 6,
      weatherCode: 0,
      forecastRainSum24h: 0
    };

    const report = computeAgronomicIndices(calmTelemetry);

    expect(report.sprayWindow.level).toBe('SAFE');
    expect(report.sprayWindow.badgeYo).toContain('Àìléwu');

    expect(report.nitrogenWindow.level).toBe('SAFE');
    expect(report.dryingIndex.level).toBe('SAFE');
  });
});