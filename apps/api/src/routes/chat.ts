import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { orchestrateChatStream } from '../services/llm_orchestrator.js';

export const chatRouter = Router();

const ChatRequestSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty').max(1000),
  locationId: z.string().optional(),
  locationName: z.string().optional(),
  crop: z.string().optional()
});

chatRouter.post('/', async (req: Request, res: Response) => {
  const parseResult = ChatRequestSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid request payload',
      details: parseResult.error.issues
    });
  }

  const { query, locationId, locationName, crop } = parseResult.data;

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  });

  try {
    const stream = orchestrateChatStream({
      query,
      locationId,
      locationName,
      cropFilter: crop,
      supabaseClient: supabase
    });

    for await (const sseChunk of stream) {
      res.write(sseChunk);
    }
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err.message || 'Stream processing failed' })}\n\n`);
    res.write('data: [DONE]\n\n');
  } finally {
    res.end();
  }
});