import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('Task 5: Location Gazetteer & Unicode Normalization', () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing Supabase credentials in apps/api/.env');
    }

    supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    });
  });

  it('should verify the database contains at least 50 seeded Osun State locations', async () => {
    const { count, error } = await supabase
      .from('locations')
      .select('*', { count: 'exact', head: true })
      .eq('state', 'Osun');

    expect(error).toBeNull();
    expect(count).toBeGreaterThanOrEqual(50);
  });

  it('should query for "Obaagun" and return exact coordinates and LGA', async () => {
    const searchTarget = 'Obaagun'.normalize('NFC');

    // Query either by anglicized name, Yoruba diacritic name, or aliases
    const { data, error } = await supabase
      .from('locations')
      .select('name_en, name_yo, aliases, lga, lat, lon, latitude, longitude')
      .or(`name_en.ilike.%${searchTarget}%,name_yo.eq.${searchTarget},aliases.cs.{${searchTarget}}`)
      .limit(1)
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();

    // Verify correct coordinates for Obaagun
    expect(Number(data.lat)).toBeCloseTo(7.8925, 3);
    expect(Number(data.lon)).toBeCloseTo(4.6714, 3);
    expect(Number(data.latitude)).toBeCloseTo(7.8925, 3);
    expect(Number(data.longitude)).toBeCloseTo(4.6714, 3);
    expect(data.lga).toBe('Ifelodun');
  });

  it('should enforce strict Unicode NFC normalization on retrieved Yoruba diacritics', async () => {
    const { data: record, error } = await supabase
      .from('locations')
      .select('name_yo')
      .eq('name_en', 'Obaagun')
      .single();

    expect(error).toBeNull();
    expect(record?.name_yo).toBeDefined();

    const expectedNFC = record!.name_yo.normalize('NFC');
    const decomposedNFD = record!.name_yo.normalize('NFD');

    // Assert that the stored string is strictly precomposed NFC, not decomposed NFD
    expect(record!.name_yo).toBe(expectedNFC);
    if (expectedNFC !== decomposedNFD) {
      expect(record!.name_yo).not.toBe(decomposedNFD);
    }
  });
});