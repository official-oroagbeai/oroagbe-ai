import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { WeatherPayload, weatherPayloadSchema } from '../types/weather.js';
import { fetchResilientWeather } from './weather_resilient.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;

const defaultSupabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const CACHE_DURATION_MINUTES = 60;

export interface GetWeatherOptions {
  locationId: string;
  lat?: number;
  lon?: number;
  supabaseClient?: SupabaseClient;
}

/**
 * Read-through cache utility for hyperlocal weather:
 * 1. Checks weather_cache for an unexpired entry (expires_at > UTC now).
 * 2. Returns cached JSONB payload on hit.
 * 3. On miss or expiration, fetches live data from Open-Meteo, upserts into Postgres, and returns.
 */
export async function getOrFetchWeather({
  locationId,
  lat,
  lon,
  supabaseClient = defaultSupabase
}: GetWeatherOptions): Promise<{ data: WeatherPayload; fromCache: boolean }> {
  const nowUtc = new Date().toISOString();

  // 1. Check for fresh cache entry
  const { data: cached, error: cacheErr } = await supabaseClient
    .from('weather_cache')
    .select('payload, expires_at')
    .eq('location_id', locationId)
    .gt('expires_at', nowUtc)
    .maybeSingle();

  if (cacheErr) {
    console.error(`[WeatherCache Read Error]: ${cacheErr.message}`);
  }

  if (cached?.payload) {
    const parsed = weatherPayloadSchema.safeParse(cached.payload);
    if (parsed.success) {
      return { data: parsed.data, fromCache: true };
    }
  }

  // 2. Resolve coordinates if not provided directly
  let resolvedLat = lat;
  let resolvedLon = lon;

  if (resolvedLat === undefined || resolvedLon === undefined) {
    const { data: loc, error: locErr } = await supabaseClient
      .from('locations')
      .select('lat, lon, latitude, longitude')
      .eq('id', locationId)
      .single();

    if (locErr || !loc) {
      throw new Error(`Location not found for id: ${locationId}`);
    }

    resolvedLat = Number(loc.lat ?? loc.latitude);
    resolvedLon = Number(loc.lon ?? loc.longitude);
  }

  // 3. Fetch fresh data from Open-Meteo
  const liveWeather = await fetchResilientWeather(resolvedLat, resolvedLon);
  // 4. Calculate UTC expiration (Strictly ISO UTC to prevent timezone skew)
  const expiresAt = new Date(Date.now() + CACHE_DURATION_MINUTES * 60 * 1000).toISOString();

  // 5. Atomic Upsert into weather_cache
  const { error: upsertErr } = await supabaseClient
    .from('weather_cache')
    .upsert(
      {
        location_id: locationId,
        payload: liveWeather,
        expires_at: expiresAt
      },
      { onConflict: 'location_id' }
    );

  if (upsertErr) {
    console.error(`[WeatherCache Write Error]: ${upsertErr.message}`);
  }

  return { data: liveWeather, fromCache: false };
}