import { describe, it, expect } from 'vitest';
import { verifyAgronomicResponse } from '../services/verifier.js';
import { WeatherPayload } from '../services/weather.js';

describe('Task 14: Post-Generation Numeric & Agronomic Safety Verifier Guardrail', () => {
  const dummySafeWeather: WeatherPayload = {
    locationId: 'osogbo',
    current: {
      temperature: 28,
      relativeHumidity: 65,
      precipitation: 0,
      windSpeed: 8,
      weatherCode: 1
    },
    daily: {
      temperatureMax: [31],
      temperatureMin: [22],
      precipitationSum: [0],
      precipitationProbabilityMax: [10]
    },
    hourly: {
      precipitationProbability: [10]
    },
    fetchedAt: new Date().toISOString(),
    source: 'primary'
  };

  it('should flag critical violation when Urea dosage exceeds 150 kg/ha', () => {
    const toxicResponse = 'For your maize crop, apply 500 kg/ha of Urea directly to boost vegetative growth.';
    const result = verifyAgronomicResponse({
      text: toxicResponse,
      weather: dummySafeWeather
    });

    expect(result.isValid).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].code).toBe('FERTILIZER_OVERDOSE');
    expect(result.violations[0].severity).toBe('CRITICAL');
    expect(result.sanitizedText).toContain('⚠️ **AGRONOMIC SAFETY ADVISORY:**');
    expect(result.sanitizedText).toContain('Dangerous Urea rate detected: 500 kg/ha');
  });

  it('should flag critical violation for excessive NPK in Yoruba with localized advisory', () => {
    const yorubaResponse = 'Fún àgbàdo rẹ, lo ajílẹ̀ NPK ní ìwọ̀n 450 kg fún hẹ́kíútà kan lẹ́yìn ọ̀sẹ̀ méjì.';
    const result = verifyAgronomicResponse({
      text: yorubaResponse,
      weather: dummySafeWeather
    });

    expect(result.isValid).toBe(false);
    expect(result.violations[0].code).toBe('FERTILIZER_OVERDOSE');
    expect(result.sanitizedText).toContain('⚠️ **ÌKILỌ̀ ÀÀBÒ ÀGBẸ̀ (AGRONOMIC SAFETY NOTICE):**');
    expect(result.sanitizedText).toContain('Ìwọ̀n ajílẹ̀ NPK tó ga jù: 450 kg/ha');
  });

  it('should flag weather spray hazard when rain probability is 50%', () => {
    const rainyWeather: WeatherPayload = {
      ...dummySafeWeather,
      hourly: {
        precipitationProbability: [70]
      }
    };

    const sprayAdvice = 'Apply pesticide spray to control Fall Armyworm larvae on the young maize leaves.';
    const result = verifyAgronomicResponse({
      text: sprayAdvice,
      weather: rainyWeather
    });

    expect(result.isValid).toBe(false);
    const rainViolation = result.violations.find((v) => v.entity.includes('Precipitation'));
    expect(rainViolation).toBeDefined();
    expect(rainViolation?.code).toBe('WEATHER_SPRAY_HAZARD');
    expect(result.sanitizedText).toContain('Rain imminent (70% probability)');
  });

  it('should flag wind drift hazard when wind speed exceeds 15 km/h', () => {
    const windyWeather: WeatherPayload = {
      ...dummySafeWeather,
      current: {
        ...dummySafeWeather.current,
        windSpeed: 22
      }
    };

    const sprayAdvice = 'Spray copper fungicide across the cocoa farm immediately.';
    const result = verifyAgronomicResponse({
      text: sprayAdvice,
      weather: windyWeather
    });

    expect(result.isValid).toBe(false);
    const windViolation = result.violations.find((v) => v.entity.includes('Wind Drift'));
    expect(windViolation).toBeDefined();
    expect(windViolation?.severity).toBe('WARNING');
    expect(result.sanitizedText).toContain('High wind speed detected (22 km/h)');
  });

  it('should pass verified, within-bounds agronomic recommendations without modifications', () => {
    const safeResponse = 'Apply NPK 15:15:15 at 200 kg/ha two weeks after emergence, followed by 100 kg/ha Urea top-dressing.';
    const result = verifyAgronomicResponse({
      text: safeResponse,
      weather: dummySafeWeather
    });

    expect(result.isValid).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.sanitizedText).toBe(safeResponse);
  });
});