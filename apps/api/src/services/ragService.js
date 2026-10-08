import { supabase } from './supabase.js';

/**
 * Temporary mock function to simulate generating a 1024-dimension embedding.
 * In Milestone 3, we will replace this with a fetch() call to our Python FastAPI model service[cite: 1].
 */
async function generateEmbedding(text) {
  console.log(`[RAG] Generating embedding for: "${text}"`);
  // Returns an array of 1024 zeros to satisfy the pgvector dimension requirement[cite: 1]
  return new Array(1024).fill(0); 
}

/**
 * Retrieves relevant farming advice from the Indigenous Knowledge Graph[cite: 1].
 * @param {string} userQuestion - The question asked by the farmer.
 * @returns {Array} List of relevant knowledge entries.
 */
export async function retrieveKnowledge(userQuestion) {
  try {
    // 1. Convert the user's question into a vector embedding
    const queryEmbedding = await generateEmbedding(userQuestion);

    // 2. Call the Supabase matching function we just created
    const { data: documents, error } = await supabase.rpc('match_knowledge_entries', {
      query_embedding: queryEmbedding,
      match_threshold: 0.75, // Minimum similarity confidence
      match_count: 3         // Bring back the top 3 best answers
    });

    if (error) {
      console.error("[RAG] Supabase RPC Error:", error.message);
      throw error;
    }

    if (!documents || documents.length === 0) {
      console.warn("[RAG] Retrieval confidence below threshold. Suggesting escalation[cite: 1].");
      return [];
    }

    return documents;
  } catch (error) {
    console.error("[RAG] Failed to retrieve knowledge:", error);
    return [];
  }
}