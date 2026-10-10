import OpenAI from 'openai';
import { buildSystemPrompt } from './prompts';
import { searchAgronomyKnowledge } from './retrieval';
import { getOrFetchWeather } from './weather_cache';
import { verifyAgronomicResponse } from './verifier';
import { SupabaseClient } from '@supabase/supabase-js';

export interface ChatStreamOptions {
  query: string;
  locationId?: string;
  locationName?: string;
  cropFilter?: string;
  supabaseClient: SupabaseClient;
  customOpenAIClient?: OpenAI;
}

export async function* orchestrateChatStream(options: ChatStreamOptions): AsyncGenerator<string, void, unknown> {
  const { query, locationId, locationName, cropFilter, supabaseClient, customOpenAIClient } = options;

  // 1. Fetch Hyperlocal Weather if location provided
  let weather = undefined;
  if (locationId) {
    try {
      weather = await getOrFetchWeather(locationId, supabaseClient);
    } catch {
      // Degrade gracefully if weather service is temporarily unavailable
    }
  }

  // 2. Fetch Semantic Knowledge Matches
  let knowledgeMatches = [];
  try {
    knowledgeMatches = await searchAgronomyKnowledge({
      query,
      supabaseClient,
      cropFilter,
      threshold: 0.75,
      matchCount: 3
    });
  } catch {
    // Degrade gracefully if semantic service is unreachable
  }

  // 3. Assemble Grounded System Prompt
  const systemPrompt = buildSystemPrompt({
    query,
    locationName: locationName || locationId,
    weather,
    knowledgeMatches
  });

  const openai = customOpenAIClient || new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy-key'
  });

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  // 4. Stream LLM Response
  const stream = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query.normalize('NFC') }
    ]
  });

  let fullResponseText = '';

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      fullResponseText += content;
      yield `data: ${JSON.stringify({ text: content })}\n\n`;
    }
  }

  // 5. Apply Post-Generation Safety Guardrail (Task 14)
  const verification = verifyAgronomicResponse({
    text: fullResponseText,
    crop: cropFilter,
    weather
  });

  // If violations exist, stream the appended advisory notice before concluding
  if (!verification.isValid && verification.sanitizedText.length > fullResponseText.length) {
    const appendedNotice = verification.sanitizedText.slice(fullResponseText.length);
    yield `data: ${JSON.stringify({ text: appendedNotice, safetyNotice: true })}\n\n`;
  }

  // Signal completion
  yield 'data: [DONE]\n\n';
}