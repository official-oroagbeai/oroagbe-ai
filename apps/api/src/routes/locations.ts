import { Router, Request, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const locationsRouter = Router();

// Guardrail: 60 requests per minute per IP
export const locationRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many location requests, please try again later.' }
});

const locationQuerySchema = z.object({
  q: z
    .string({ required_error: 'Query parameter "q" is required' })
    .trim()
    .min(2, 'Search query must be at least 2 characters')
    .max(100, 'Search query cannot exceed 100 characters')
});

locationsRouter.get('/', locationRateLimiter, async (req: Request, res: Response): Promise<void> => {
  const parseResult = locationQuerySchema.safeParse(req.query);

  if (!parseResult.success) {
    // Read from .issues and compute the payload safely before setting response status
    const details = parseResult.error.issues?.map((issue) => issue.message) ?? [parseResult.error.message];
    res.status(400).json({
      error: 'Invalid query parameters',
      details
    });
    return;
  }

  // Enforce UTF-8 Unicode NFC normalization on user input
  const normalizedQuery = parseResult.data.q.normalize('NFC');

  try {
    const { data, error } = await supabase.rpc('match_locations_fuzzy', {
      search_term: normalizedQuery,
      match_limit: 5
    });

    if (error) {
      console.error('[Locations RPC Error]:', error.message);
      res.status(500).json({ error: 'Database search failed' });
      return;
    }

    const responsePayload = (data || []).map((loc: any) => ({
      id: loc.id,
      name_en: loc.name_en,
      name_yo: loc.name_yo,
      lga: loc.lga,
      state: loc.state,
      lat: Number(loc.lat),
      lon: Number(loc.lon),
      confidence: Number(Number(loc.confidence).toFixed(2))
    }));

    res.json(responsePayload);
  } catch (err: any) {
    console.error('[Locations Route Error]:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});