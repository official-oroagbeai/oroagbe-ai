export class EmbeddingClientError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'EmbeddingClientError';
  }
}

// Default explicitly to IPv4 to prevent Windows Node IPv6 ::1 lookup failures
const EMBED_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL || 'http://127.0.0.1:8000';
const TIMEOUT_MS = 15000; // Allow 15s for local CPU cold inference
const EXPECTED_DIMENSIONS = 384;

export async function fetchEmbedding(text: string, isQuery: boolean = false): Promise<number[]> {
  const normalizedText = text.trim().normalize('NFC');
  if (!normalizedText) {
    throw new EmbeddingClientError('Input text cannot be empty');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${EMBED_SERVICE_URL}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: normalizedText,
        is_query: isQuery
      }),
      signal: controller.signal
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

export async function fetchBatchEmbeddings(texts: string[], isQuery: boolean = false): Promise<number[][]> {
  const normalizedTexts = texts.map((t) => t.trim().normalize('NFC')).filter(Boolean);
  if (normalizedTexts.length === 0) {
    return [];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS * 2);

  try {
    const response = await fetch(`${EMBED_SERVICE_URL}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: normalizedTexts,
        is_query: isQuery
      }),
      signal: controller.signal
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