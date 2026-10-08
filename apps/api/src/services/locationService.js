import { supabase } from './supabase.js';

/**
 * Searches for a location by English or Yoruba name, or its aliases.
 * @param {string} query - The search term (e.g., "oshogbo")
 */
export async function findLocation(query) {
  // Convert query to lowercase because array searches are case-sensitive in Postgres
  const lowerQuery = query.toLowerCase();

  const { data, error } = await supabase
    .from('locations')
    .select('*')
    // We add aliases.cs.{lowerQuery} which means "array contains string"
    .or(`name_en.ilike.%${query}%,name_yo.ilike.%${query}%,aliases.cs.{${lowerQuery}}`)
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
        return null; // No location found
    }
    throw new Error(`Database error: ${error.message}`);
  }

  return data;
}