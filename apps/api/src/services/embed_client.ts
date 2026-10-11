import { logger } from '../utils/logger.js';

export class EmbeddingClientError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'EmbeddingClientError';
  }
}

// 1. Service URLs & Configuration
const EMBED_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL || 'http://127.0.0.1:8000';
const HF_TOKEN = process.env.HF_TOKEN;
const HF_MODEL_ID = process.env.HF_EMBEDDING_MODEL_ID || 'intfloat/multilingual-e5-small';
const HF_INFERENCE_URL =
  process.env.HF_EMBEDDING_URL ||
  `https://router.huggingface.co/hf-inference/models/${HF_MODEL_ID}`;

const TIMEOUT_MS = 15000;
const EXPECTED_DIMENSIONS = 384;

/**
 * Ensures L2 normalization (unit length 1.0) for cosine similarity in pgvector
 */
function normalizeL2(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return vec;
  return vec.map((val) => val / norm);
}

/**
 * Fetches 384-dimensional vector embedding for a single text string
 */
export async function fetchEmbedding(text: string, isQuery: boolean = false): Promise<number[]> {
  const normalizedText = text.trim().normalize('NFC');
  if (!normalizedText) {
    throw new EmbeddingClientError('Input text cannot be empty');
  }

  // Fast path: Directly query Hugging Face if explicitly configured
  if (process.env.EMBEDDING_PROVIDER === 'huggingface' && HF_TOKEN) {
    return fetchEmbeddingFromHF(normalizedText, isQuery);
  }

  // 1. Primary path: Attempt local / configured FastAPI microservice
  try {
    return await fetchEmbeddingFromLocal(normalizedText, isQuery);
  } catch (err: any) {
    // If the error was malformed vector dimensions from the service, re-throw immediately
    if (err instanceof EmbeddingClientError && err.statusCode !== 504 && !err.message.includes('Failed to reach')) {
      throw err;
    }

    // 2. Fallback path: If local service is unreachable (e.g. Render 512MB OOM) and HF_TOKEN is present
    if (HF_TOKEN) {
      logger.warn(
        { err: err.message },
        'Local embedding microservice unreachable. Failing over to Hugging Face Serverless API...'
      );
      return fetchEmbeddingFromHF(normalizedText, isQuery);
    }

    throw err;
  }
}

/**
 * Fetches batch embeddings for multiple texts
 */
export async function fetchBatchEmbeddings(texts: string[], isQuery: boolean = false): Promise<number[][]> {
  const normalizedTexts = texts.map((t) => t.trim().normalize('NFC')).filter(Boolean);
  if (normalizedTexts.length === 0) {
    return [];
  }

  // Fast path: Directly query Hugging Face if explicitly configured
  if (process.env.EMBEDDING_PROVIDER === 'huggingface' && HF_TOKEN) {
    return fetchBatchEmbeddingsFromHF(normalizedTexts, isQuery);
  }

  // 1. Primary path: Attempt local / configured FastAPI microservice
  try {
    return await fetchBatchEmbeddingsFromLocal(normalizedTexts, isQuery);
  } catch (err: any) {
    if (err instanceof EmbeddingClientError && err.statusCode !== 504 && !err.message.includes('Failed to process')) {
      throw err;
    }

    // 2. Fallback path: Failover to Hugging Face Serverless API
    if (HF_TOKEN) {
      logger.warn(
        { err: err.message },
        'Local batch embedding microservice unreachable. Failing over to Hugging Face Serverless API...'
      );
      return fetchBatchEmbeddingsFromHF(normalizedTexts, isQuery);
    }

    throw err;
  }
}

// ---------------------------------------------------------------------------
// Internal Client Implementations
// ---------------------------------------------------------------------------

async function fetchEmbeddingFromLocal(normalizedText: string, isQuery: boolean): Promise<number[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${EMBED_SERVICE_URL}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: normalizedText,
        is_query: isQuery,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new EmbeddingClientError(
        `Embedding microservice HTTP error: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    const vector = data?.embedding;

    if (!Array.isArray(vector) || vector.length !== EXPECTED_DIMENSIONS) {
      throw new EmbeddingClientError(
        `Invalid vector dimensions: expected ${EXPECTED_DIMENSIONS}, received ${vector?.length ?? 0}`
      );
    }

    return vector;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new EmbeddingClientError(`Embedding service timed out after ${TIMEOUT_MS}ms`, 504);
    }
    if (err instanceof EmbeddingClientError) {
      throw err;
    }
    throw new EmbeddingClientError(`Failed to reach embedding microservice: ${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchEmbeddingFromHF(normalizedText: string, isQuery: boolean): Promise<number[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  // E5-family models require query: or passage: prefixes
  const prefixedText = `${isQuery ? 'query: ' : 'passage: '}${normalizedText}`;

  try {
    const response = await fetch(HF_INFERENCE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prefixedText,
        options: { wait_for_model: true },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new EmbeddingClientError(
        `Hugging Face embedding API error: ${response.status} - ${errorText}`,
        response.status
      );
    }

    const data = await response.json();
    // Hugging Face can return [number, ...] or [[number, ...]]
    const rawVector: number[] = Array.isArray(data[0]) ? data[0] : data;

    if (!Array.isArray(rawVector) || rawVector.length !== EXPECTED_DIMENSIONS) {
      throw new EmbeddingClientError(
        `Invalid vector dimensions from Hugging Face: expected ${EXPECTED_DIMENSIONS}, received ${rawVector?.length ?? 0}`
      );
    }

    return normalizeL2(rawVector);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new EmbeddingClientError(`Hugging Face embedding API timed out after ${TIMEOUT_MS}ms`, 504);
    }
    if (err instanceof EmbeddingClientError) {
      throw err;
    }
    throw new EmbeddingClientError(`Failed to reach Hugging Face embedding API: ${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchBatchEmbeddingsFromLocal(normalizedTexts: string[], isQuery: boolean): Promise<number[][]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS * 2);

  try {
    const response = await fetch(`${EMBED_SERVICE_URL}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: normalizedTexts,
        is_query: isQuery,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new EmbeddingClientError(
        `Batch embedding HTTP error: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    const vectors = data?.embeddings;

    if (!Array.isArray(vectors) || vectors.length !== normalizedTexts.length) {
      throw new EmbeddingClientError(
        `Batch size mismatch: sent ${normalizedTexts.length}, received ${vectors?.length ?? 0}`
      );
    }

    return vectors;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new EmbeddingClientError('Batch embedding service timed out', 504);
    }
    if (err instanceof EmbeddingClientError) {
      throw err;
    }
    throw new EmbeddingClientError(`Failed to process batch embeddings: ${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchBatchEmbeddingsFromHF(normalizedTexts: string[], isQuery: boolean): Promise<number[][]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS * 2);

  const prefix = isQuery ? 'query: ' : 'passage: ';
  const prefixedTexts = normalizedTexts.map((t) => `${prefix}${t}`);

  try {
    const response = await fetch(HF_INFERENCE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prefixedTexts,
        options: { wait_for_model: true },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new EmbeddingClientError(
        `Hugging Face batch embedding API error: ${response.status} - ${errorText}`,
        response.status
      );
    }

    const data = await response.json();
    let vectors: number[][] = data;

    // Handle single-item array responses returning a flat vector
    if (normalizedTexts.length === 1 && !Array.isArray(data[0]) && data.length === EXPECTED_DIMENSIONS) {
      vectors = [data];
    }

    if (!Array.isArray(vectors) || vectors.length !== normalizedTexts.length) {
      throw new EmbeddingClientError(
        `Batch size mismatch from Hugging Face: sent ${normalizedTexts.length}, received ${vectors?.length ?? 0}`
      );
    }

    for (let i = 0; i < vectors.length; i++) {
      if (!Array.isArray(vectors[i]) || vectors[i].length !== EXPECTED_DIMENSIONS) {
        throw new EmbeddingClientError(
          `Invalid vector dimension at index ${i}: expected ${EXPECTED_DIMENSIONS}, received ${vectors[i]?.length ?? 0}`
        );
      }
      vectors[i] = normalizeL2(vectors[i]);
    }

    return vectors;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new EmbeddingClientError('Batch embedding service timed out', 504);
    }
    if (err instanceof EmbeddingClientError) {
      throw err;
    }
    throw new EmbeddingClientError(`Failed to process batch embeddings via Hugging Face: ${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }
}