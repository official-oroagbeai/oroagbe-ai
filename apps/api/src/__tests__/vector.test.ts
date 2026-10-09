import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('Task 4: Vector Extension & Semantic Search (RPC)', () => {
  let supabase: SupabaseClient;
  const createdEntryIds: string[] = [];

  // Helper to construct normalized 384-dimension test vectors
  const makeVector = (leadingWeights: number[]): number[] => {
    const vec = new Array(384).fill(0);
    leadingWeights.forEach((w, i) => {
      vec[i] = w;
    });
    return vec;
  };

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

  afterAll(async () => {
    if (createdEntryIds.length > 0) {
      await supabase.from('knowledge_entries').delete().in('id', createdEntryIds);
    }
  });

  it('should store 384-dim vectors and rank highest similarity matches via RPC', async () => {
    // Exact match vector: unit vector pointing entirely along dimension 0
    const perfectVector = makeVector([1.0]);
    // Close vector (~0.8 cosine similarity)
    const closeVector = makeVector([0.8, 0.6]);
    // Orthogonal vector (0.0 similarity, will be filtered out by >= 0.75 threshold)
    const orthogonalVector = makeVector([0, 0, 1.0]);

    // Seed mock agronomy knowledge records
    const { data: inserted, error: insertError } = await supabase
      .from('knowledge_entries')
      .insert([
        {
          title: 'Yam Tuber Storage Guide',
          content: 'Store yams in well-ventilated barns off the ground.',
          category: 'Harvest',
          embedding: perfectVector
        },
        {
          title: 'Cassava Root Preservation',
          content: 'Process harvested cassava tubers within 48 hours.',
          category: 'Harvest',
          embedding: closeVector
        },
        {
          title: 'Irrelevant Poultry Feed Guide',
          content: 'Broiler chicken feeding schedule and nutrients.',
          category: 'Livestock',
          embedding: orthogonalVector
        }
      ])
      .select('id');

    expect(insertError).toBeNull();
    expect(inserted).toHaveLength(3);
    inserted?.forEach(row => createdEntryIds.push(row.id));

    // Execute semantic search query targeting the perfect vector
    const { data: results, error: rpcError } = await supabase.rpc('match_knowledge_entries', {
      query_embedding: perfectVector,
      match_threshold: 0.75,
      match_count: 5
    });

    expect(rpcError).toBeNull();
    expect(results).toBeDefined();

    // Verification 1: Orthogonal entry (similarity ~0.0) is rejected by >= 0.75 guardrail
    const poultryEntry = results.find((r: { title: string }) => r.title === 'Irrelevant Poultry Feed Guide');
    expect(poultryEntry).toBeUndefined();

    // Verification 2: Closest match is returned first with highest similarity (~1.0)
    expect(results[0].title).toBe('Yam Tuber Storage Guide');
    expect(results[0].similarity).toBeGreaterThan(0.99);

    // Verification 3: Second closest match is included (~0.8 similarity)
    expect(results[1].title).toBe('Cassava Root Preservation');
    expect(results[1].similarity).toBeGreaterThanOrEqual(0.75);
    expect(results[1].similarity).toBeLessThan(results[0].similarity);
  });
});