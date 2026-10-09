import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Resolve __dirname in an ES module environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

// Enforce Unicode NFC precomposition
const toNFC = (input: string): string => input.normalize('NFC');

interface LocationEntry {
  name_en: string;
  name_yo: string;
  aliases: string[];
  state: string;
  lga: string;
  lat: number;
  lon: number;
}

export async function seedLocations() {
  const jsonPath = path.resolve(__dirname, '../data/osun_locations.json');
  const rawData: LocationEntry[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  console.log(`Ingesting ${rawData.length} locations with Unicode NFC normalization...`);

  const normalizedPayload = rawData.map((item) => ({
    name: toNFC(item.name_en),
    name_en: toNFC(item.name_en),
    name_yo: toNFC(item.name_yo),
    aliases: item.aliases.map(toNFC),
    state: toNFC(item.state),
    lga: toNFC(item.lga),
    lat: item.lat,
    lon: item.lon,
    latitude: item.lat,
    longitude: item.lon
  }));

  const { data, error } = await supabase
    .from('locations')
    .insert(normalizedPayload)
    .select('id, name_en, name_yo');

  if (error) {
    console.error('Seeding failed:', error.message);
    throw error;
  }

  console.log(`Successfully seeded ${data.length} Osun State agrarian locations.`);
  return data;
}

seedLocations()
  .then(() => {
    console.log('Done!');
  })
  .catch((err) => {
    console.error('Error during seeding:', err);
    process.exit(1);
  });