// api/src/services/supabase.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; // <-- Declared as supabaseKey

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY. Check your .env file.");
  process.exit(1);
}

// FIX: Changed supabaseAnonKey to supabaseKey
export const supabase = createClient(supabaseUrl, supabaseKey); 
