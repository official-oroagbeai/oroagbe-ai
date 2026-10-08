import { supabase } from './supabase.js';

export async function getWeatherForLocation(locationId, lat, lon) {
  // 1. Check if we have a fresh cache (less than 1 hour old)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data: cachedWeather } = await supabase
    .from('weather_cache')
    .select('*')
    .eq('location_id', locationId)
    .gte('fetched_at', oneHourAgo)
    .single();

  if (cachedWeather) {
    console.log(`[Weather] Using cached data for ${locationId}`);
    return cachedWeather.payload;
  }

  // 2. Fetch live data from Open-Meteo if no fresh cache exists[cite: 1]
  console.log(`[Weather] Fetching fresh Open-Meteo data for ${locationId}`);
  const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Africa%2FLagos`;

  const response = await fetch(openMeteoUrl);
  if (!response.ok) {
    throw new Error('Failed to fetch from Open-Meteo');
  }
  
  const weatherPayload = await response.json();

  // 3. Save to Supabase weather_cache table
  await supabase
    .from('weather_cache')
    .upsert({
      location_id: locationId,
      fetched_at: new Date().toISOString(),
      payload: weatherPayload
    });

  return weatherPayload;
}