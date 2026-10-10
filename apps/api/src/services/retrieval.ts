import { SupabaseClient } from '@supabase/supabase-js';
import { fetchEmbedding } from './embed_client.js';

export interface KnowledgeMatch {
  id: string;
  crop: string;
  topic: string;
  title: string | null;
  category: string | null;
  content: string;
  content_en: string | null;
  content_yo: string | null;
  metadata: Record<string, any>;
  similarity: number;
}

export interface SearchKnowledgeOptions {
  query: string;
  supabaseClient: SupabaseClient;
  matchCount?: number;
  threshold?: number;
  cropFilter?: string;
}

export async function searchAgronomyKnowledge(
  options: SearchKnowledgeOptions
): Promise<KnowledgeMatch[]> {
  const { query, supabaseClient, matchCount = 3, threshold = 0.75, cropFilter } = options;

  const normalizedQuery = query.trim().normalize('NFC');
  if (!normalizedQuery) {
    return [];
  }

  // 1. Generate 384-dimensional query vector using FastAPI microservice
  const queryEmbedding = await fetchEmbedding(normalizedQuery, true);

  // 2. Query Supabase pgvector RPC
  const { data, error } = await supabaseClient.rpc('match_knowledge_entries', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: cropFilter ? matchCount * 2 : matchCount
  });

  if (error) {
    throw new Error(`Knowledge vector search failed: ${error.message}`);
  }

  const matches: KnowledgeMatch[] = (data || []).map((row: any) => ({
    id: row.id,
    crop: row.crop,
    topic: row.topic,
    title: row.title,
    category: row.category,
    content: row.content,
    content_en: row.content_en,
    content_yo: row.content_yo,
    metadata: row.metadata || {},
    similarity: Number(row.similarity.toFixed(4))
  }));

  // 3. Apply optional crop filter if specified
  if (cropFilter) {
    const targetCrop = cropFilter.trim().toLowerCase();
    return matches.filter((m) => m.crop?.toLowerCase() === targetCrop).slice(0, matchCount);
  }

  return matches;
}