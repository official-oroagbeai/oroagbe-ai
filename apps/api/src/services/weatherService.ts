import { supabase } from './supabase.js';
import { WeatherPayload } from '@oroagbe/types';

export async function getWeatherForLocation(locationId: string, lat: number, lon: number): Promise<WeatherPayload> {
  try {
    // Ensure coordinates are strictly valid numbers before sending
    if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
      throw new Error("Invalid coordinates provided");
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation&timezone=auto`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[Weather] Open-Meteo rejected request: ${response.status} - ${errorText}`);
      throw new Error("Failed to fetch from Open-Meteo");
    }

    const data = await response.json();

    return {
      temperature: data.current.temperature_2m,
      humidity: data.current.relative_humidity_2m,
      precipitation_chance: data.current.precipitation,
      forecast_date: new Date().toISOString()
    };

  } catch (error: any) {
    console.error(`[Weather] Fetch failed for ${locationId}, using fallback. Reason: ${error.message}`);
    
    // Graceful fallback so the AI can still answer the farmer
    return {
      temperature: 28.5,
      humidity: 75,
      precipitation_chance: 20,
      forecast_date: new Date().toISOString()
    };
  }
}