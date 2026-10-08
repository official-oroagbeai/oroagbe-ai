import { Router, Request, Response, NextFunction } from 'express';
import { findLocation } from '../services/locationService.js';
import { getWeatherForLocation } from '../services/weatherService.js';
import { supabase } from '../services/supabase.js';
import { retrieveKnowledge } from '../services/ragService.js';
import { generateDraftResponse } from '../services/llmService.js';
import { verifyNumericFidelity, getTemplatedFallback } from '../services/verificationService.js';
import multer from 'multer';

// 1. IMPORT OUR NEW SHARED TYPES
import { ChatMessage, VerificationResult } from '@oroagbe/types';

// Set up memory storage for the audio upload
const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

// 2. DEFINE THE REQUEST BODY INTERFACE
interface ChatRequestBody {
  message: string;
  locationId: string;
  conversationId: string;
}

// Health check for Docker/Render deployment
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'oroagbe-api', timestamp: new Date().toISOString() });
});

// Proxy check to verify connectivity to Python FastAPI model service
router.get('/check-model-service', async (req, res) => {
  const MODEL_SERVICE_URL = process.env.MODEL_SERVICE_URL || 'http://127.0.0.1:8000';
  try {
    const response = await fetch(`${MODEL_SERVICE_URL}/health`);
    const data = await response.json();
    res.json({ status: 'connected', modelService: data });
  } catch (error: any) {
    res.status(502).json({ status: 'unreachable', error: error.message });
  }
});

// 3. UPDATE THE CHAT ROUTE TO USE TYPESCRIPT
router.post('/chat', async (req: Request<{}, {}, ChatRequestBody>, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { message, locationId, conversationId } = req.body;

    if (!message || !locationId) {
      res.status(400).json({ error: "Missing message or locationId" });
      return;
    }

    // 1. Get Location Coordinates
    const { data: location, error } = await supabase
      .from('locations')
      .select('name_yo, lat, lon')
      .eq('id', locationId)
      .single();

    if (error || !location) {
      res.status(404).json({ error: "Location not found" });
      return;
    }

    // 2. Fetch Live Weather
    const weatherData = await getWeatherForLocation(locationId, location.lat, location.lon);

    // 3. Retrieve Farming Advice (RAG)
    const knowledgeEntries = await retrieveKnowledge(message);

    // 4. Generate Draft Answer via LLM
    const draftAnswer = await generateDraftResponse(message, weatherData, knowledgeEntries);

    // 5. Critical Guardrail: Numeric Verification
    const isSafe = verifyNumericFidelity(draftAnswer, weatherData);
    
    let finalAnswer: string;
    if (isSafe) {
      finalAnswer = draftAnswer;
    } else {
      // If hallucination detected, fallback to deterministic template
      finalAnswer = getTemplatedFallback(weatherData, location.name_yo);
    }

    // 6. STRONGLY TYPED VERIFICATION RESULT
    const verification: VerificationResult = {
      passed: isSafe,
      hallucinations_detected: isSafe ? [] : ["Numeric mismatch in temperature"],
      safe_response: isSafe ? undefined : "Template fallback used."
    };

    // 7. STRONGLY TYPED MESSAGE PAYLOAD
    const chatMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      text: finalAnswer,
      locationId: locationId,
      timestamp: new Date().toISOString(),
      verification: verification
    };

    // 8. Setup Server-Sent Events (SSE) for Streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const words = chatMessage.text.split(' ');
    for (let i = 0; i < words.length; i++) {
      res.write(`data: ${JSON.stringify({ text: words[i] + ' ' })}\n\n`);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    res.write('data: [DONE]\n\n');
    res.end();

    // 9. Fire-and-forget: Save the message asynchronously to Supabase
    supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      text: finalAnswer,
      verification: { passed: isSafe }
    }).then(() => console.log('[DB] Message saved'))
      .catch(err => console.error('[DB] Save failed', err.message));

  } catch (error) {
    next(error);
  }
});

// 4. ADD TYPES TO THE WEATHER ROUTE
router.get('/weather/:locationId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { locationId } = req.params;

    const { data: location, error } = await supabase
      .from('locations')
      .select('lat, lon')
      .eq('id', locationId)
      .single();

    if (error || !location) {
      res.status(404).json({ error: "Location not found in database" });
      return;
    }

    const weatherData = await getWeatherForLocation(locationId, location.lat, location.lon);
    
    res.json({
      location_id: locationId,
      weather: weatherData
    });

  } catch (error) {
    next(error);
  }
});

// 5. ADD TYPES TO THE LOCATIONS ROUTE
router.get('/locations', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const searchQuery = req.query.q as string;
    
    if (!searchQuery) {
      res.status(400).json({ error: "Missing search parameter 'q'" });
      return;
    }

    const location = await findLocation(searchQuery);

    if (!location) {
      res.status(404).json({ error: "Location not found" });
      return;
    }

    res.json(location);
  } catch (error) {
    next(error);
  }
});

// 6. ADD TYPES TO THE ASR ROUTE
router.post('/asr', upload.single('audio'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No audio file provided" });
      return;
    }

    console.log(`[Express] Voice note received: ${req.file.originalname} (${req.file.size} bytes)`);
    console.log(`[Express] Simulating AI transcription for MVP...`);

    await new Promise(resolve => setTimeout(resolve, 1500));

    res.json({ transcript: "Bawo ni oju ojo se ri loni?" });
  } catch (error: any) {
    console.error("[Express] Critical ASR Route Error:", error.message);
    next(error);
  }
});

export default router;