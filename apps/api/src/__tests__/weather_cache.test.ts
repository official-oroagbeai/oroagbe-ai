import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { getOrFetchWeather } from '../services/weather_cache.js';
import * as weatherService from '../services/weather.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

describe('Task 8: Weather Caching Layer (weather_cache)', () => {
  let supabase: SupabaseClient;
  let testProfileId: string;
  let testLocationId: string;

  beforeAll(async () => {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    });

    // Seed temporary profile & location for FK constraints
    const { data: profile } = await supabase
      .from('profiles')
      .insert({ email: `cache_test_${Date.now()}@oroagbe.local`, full_name: 'Cache Tester' })
      .select('id')
      .single();

    testProfileId = profile!.id;

    const { data: location } = await supabase
      .from('locations')
      .insert({
        profile_id: testProfileId,
        name: 'Cache Test Farm',
        name_en: 'Cache Test Farm',
        lat: 7.8925,
        lon: 4.6714,
        latitude: 7.8925,
        longitude: 4.6714
      })
      .select('id')
      .single();

    testLocationId = location!.id;
  });

  afterAll(async () => {
    // Cascading delete will remove location and weather_cache entries
    if (testProfileId) {
      await supabase.from('profiles').delete().eq('id', testProfileId);
    }
  });

  it('should fetch from external client on first call and hit Postgres cache on subsequent call', async () => {
    const mockLiveWeather = {
      temperature: 28.5,
      relativeHumidity: 70,
      precipitationProbability: 10,
      windSpeed: 8.2,
      fetchedAt: new Date().toISOString(),
      source: 'open-meteo' as const
    };

    // Spy on fetchLiveWeather
    const liveFetchSpy = vi.spyOn(weatherService, 'fetchLiveWeather').mockResolvedValue(mockLiveWeather);

    // Call 1: Cache Miss -> Must fetch from Open-Meteo
    const result1 = await getOrFetchWeather({
      locationId: testLocationId,
      lat: 7.8925,
      lon: 4.6714,
      supabaseClient: supabase
    });

    expect(liveFetchSpy).toHaveBeenCalledTimes(1);
    expect(result1.fromCache).toBe(false);
    expect(result1.data.temperature).toBe(28.5);

    // Call 2: Cache Hit -> Must read directly from Postgres
    const result2 = await getOrFetchWeather({
      locationId: testLocationId,
      lat: 7.8925,
      lon: 4.6714,
      supabaseClient: supabase
    });

    // Assert fetchLiveWeather was NOT called again
    expect(liveFetchSpy).toHaveBeenCalledTimes(1);
    expect(result2.fromCache).toBe(true);
    expect(result2.data.temperature).toBe(28.5);

    liveFetchSpy.mockRestore();
  });

  it('should re-fetch when cached data is expired', async () => {
    // Artificially write an expired record into weather_cache
    const expiredTimestamp = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 minutes ago

    await supabase.from('weather_cache').upsert(
      {
        location_id: testLocationId,
        payload: {
          temperature: 15.0,
          relativeHumidity: 90,
          precipitationProbability: 80,
          windSpeed: 2.0,
          fetchedAt: expiredTimestamp,
          source: 'open-meteo'
        },
        expires_at: expiredTimestamp
      },
      { onConflict: 'location_id' }
    );

    const freshWeather = {
      temperature: 31.0,
      relativeHumidity: 65,
      precipitationProbability: 5,
      windSpeed: 9.0,
      fetchedAt: new Date().toISOString(),
      source: 'open-meteo' as const
    };

    const liveFetchSpy = vi.spyOn(weatherService, 'fetchLiveWeather').mockResolvedValueOnce(freshWeather);

    const result = await getOrFetchWeather({
      locationId: testLocationId,
      lat: 7.8925,
      lon: 4.6714,
      supabaseClient: supabase
    });

    expect(liveFetchSpy).toHaveBeenCalledTimes(1);
    expect(result.fromCache).toBe(false);
    expect(result.data.temperature).toBe(31.0);

    liveFetchSpy.mockRestore();
  });
});