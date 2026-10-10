import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchEmbedding, fetchBatchEmbeddings, EmbeddingClientError } from '../services/embed_client.js';
import { searchAgronomyKnowledge } from '../services/retrieval.js';

describe('Task 13: Knowledge Base Vectorization & Semantic Retrieval', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch 384-dimensional vector embedding from microservice', async () => {
    const mockVector = new Array(384).fill(0.05);

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        embedding: mockVector,
        dimensions: 384
      })
    } as Response);

    const vector = await fetchEmbedding('Àrùn Mósèkì Gbágùdá', true);

    expect(vector).toHaveLength(384);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/embed'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          text: 'Àrùn Mósèkì Gbágùdá'.normalize('NFC'),
          is_query: true
        })
      })
    );
  });

  it('should throw an EmbeddingClientError when microservice returns unexpected dimensions', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        embedding: [0.1, 0.2], // Malformed dimension count
        dimensions: 2
      })
    } as Response);

    await expect(fetchEmbedding('Test query')).rejects.toThrow(EmbeddingClientError);
  });

  it('should execute Supabase match_knowledge_entries RPC and return ranked matches', async () => {
    const mockVector = new Array(384).fill(0.02);

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        embedding: mockVector,
        dimensions: 384
      })
    } as Response);

    const mockRpcMatches = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        crop: 'cassava',
        topic: 'disease_management',
        title: 'CASSAVA - disease_management',
        category: 'disease_management',
        content: 'Cassava Mosaic Disease management',
        content_en: 'Cassava Mosaic Disease management',
        content_yo: 'Àrùn Mósèkì Gbágùdá',
        metadata: { source: 'verified' },
        similarity: 0.8821
      }
    ];

    const mockSupabase = {
      rpc: vi.fn().mockResolvedValueOnce({
        data: mockRpcMatches,
        error: null
      })
    } as any;

    const results = await searchAgronomyKnowledge({
      query: 'Bawo ni a se n toju arun moseki?',
      supabaseClient: mockSupabase,
      threshold: 0.75,
      matchCount: 3
    });

    expect(results).toHaveLength(1);
    expect(results[0].crop).toBe('cassava');
    expect(results[0].similarity).toBe(0.8821);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('match_knowledge_entries', {
      query_embedding: mockVector,
      match_threshold: 0.75,
      match_count: 3
    });
  });

  it('should filter results by crop when cropFilter is provided', async () => {
    const mockVector = new Array(384).fill(0.01);

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        embedding: mockVector,
        dimensions: 384
      })
    } as Response);

    const mockRpcMatches = [
      {
        id: '1',
        crop: 'maize',
        topic: 'pest_control',
        similarity: 0.85
      },
      {
        id: '2',
        crop: 'cassava',
        topic: 'planting',
        similarity: 0.82
      }
    ];

    const mockSupabase = {
      rpc: vi.fn().mockResolvedValueOnce({
        data: mockRpcMatches,
        error: null
      })
    } as any;

    const results = await searchAgronomyKnowledge({
      query: 'armyworm control',
      supabaseClient: mockSupabase,
      cropFilter: 'maize'
    });

    expect(results).toHaveLength(1);
    expect(results[0].crop).toBe('maize');
  });
});