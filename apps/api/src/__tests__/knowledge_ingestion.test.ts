import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { seedKnowledgeBase } from '../scripts/seed_knowledge.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

describe('Task 11: Agronomy Knowledge Base Ingestion Script', () => {
  let supabase: SupabaseClient;

  beforeAll(async () => {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    });

    // Check specifically for approved pilot crop entries with Yoruba text
    const { count } = await supabase
      .from('knowledge_entries')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved')
      .not('content_yo', 'is', null);

    if (!count || count === 0) {
      console.log('No approved bilingual knowledge entries found. Seeding now...');
      await seedKnowledgeBase();
    }
  });

  it('should verify approved knowledge entries exist for pilot crops', async () => {
    const { data, count, error } = await supabase
      .from('knowledge_entries')
      .select('crop, status', { count: 'exact' })
      .eq('status', 'approved')
      .in('crop', ['cassava', 'maize', 'yam']);

    expect(error).toBeNull();
    expect(count).toBeGreaterThan(0);
    expect(data?.every((d) => d.status === 'approved')).toBe(true);
  });

  it('should preserve Yoruba Unicode NFC diacritics without decomposition', async () => {
    const { data, error } = await supabase
      .from('knowledge_entries')
      .select('content_yo')
      .eq('status', 'approved')
      .not('content_yo', 'is', null)
      .limit(10);

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.length).toBeGreaterThan(0);

    for (const row of data!) {
      const text = row.content_yo;
      if (!text) continue;

      const expectedNFC = text.normalize('NFC');
      const decomposedNFD = text.normalize('NFD');

      // Assert precomposed NFC consistency
      expect(text).toBe(expectedNFC);

      // If text contains Yoruba tonal marks/subdots, assert it is not decomposed NFD
      if (/[ẹọṣáàéèóòíìúù]/.test(expectedNFC)) {
        expect(text).not.toBe(decomposedNFD);
      }
    }
  });

  it('should verify all ingested rows have valid metadata tags', async () => {
    const { data, error } = await supabase
      .from('knowledge_entries')
      .select('metadata, crop, topic')
      .eq('status', 'approved')
      .limit(5);

    expect(error).toBeNull();
    expect(data).toBeDefined();

    for (const row of data!) {
      expect(row.crop).toBeTruthy();
      expect(row.topic).toBeTruthy();
      expect(row.metadata).toHaveProperty('source');
      expect(row.metadata).toHaveProperty('ingested_at');
    }
  });
});