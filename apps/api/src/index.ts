import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { locationsRouter } from './routes/locations.js';
import { chatRouter } from './routes/chat.js'; // <-- ADDED: Import the chat router
import { whatsappClient } from './services/whatsapp.js';
import { parseWhatsAppWebhook, ParsedWhatsAppMessage } from './services/whatsappParser.js';

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// 1. Core global middleware
app.use(cors({ origin: '*' })); // <-- UPDATED: Explicitly allow all origins for Render
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Optional: Global request logger for debugging
app.use((req, res, next) => {
  if (req.path.startsWith('/api/webhooks')) {
    console.log(`[HTTP ${req.method}] ${req.url}`);
  }
  next();
});

// 2. Healthcheck for Render Deployment
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// 3. WhatsApp Webhook Endpoints (MUST precede general /api route guards)
// ---------------------------------------------------------------------------

// GET: Meta Webhook Challenge Verification
app.get('/api/webhooks/whatsapp', (req, res) => {
  console.log('\n--- [WhatsApp Webhook GET Verification] ---');

  const mode = (req.query['hub.mode'] as string) || (req.query.hub as any)?.mode;
  const token = (req.query['hub.verify_token'] as string) || (req.query.hub as any)?.verify_token;
  const challenge = (req.query['hub.challenge'] as string) || (req.query.hub as any)?.challenge;

  // Sanitize expected token (handles whitespace and potential quotes from .env)
  const rawExpected = process.env.WHATSAPP_VERIFY_TOKEN || '88349';
  const expectedToken = rawExpected.replace(/['"]/g, '').trim();
  const receivedToken = token ? String(token).trim() : '';

  console.log(`Checking: mode="${mode}" | received="${receivedToken}" | expected="${expectedToken}"`);

  if (mode === 'subscribe' && receivedToken === expectedToken) {
    console.log('[Webhook] Verification PASSED! Returning challenge:', challenge);
    return res.status(200).send(challenge);
  }

  console.warn('[Webhook] Verification FAILED: Token or mode mismatch.');
  return res.status(403).send('Forbidden: Token mismatch');
});

// Deduplication cache to prevent re-processing retried Meta deliveries
const processedMessageIds = new Set<string>();

// POST: Inbound Messages & Events from Meta
app.post('/api/webhooks/whatsapp', (req, res) => {
  // Acknowledge Meta immediately to satisfy the 3-second SLA
  res.sendStatus(200);

  // Extract structured message records
  const messages = parseWhatsAppWebhook(req.body);
  if (messages.length === 0) return;

  for (const msg of messages) {
    // Drop duplicates
    if (processedMessageIds.has(msg.messageId)) {
      console.log(`[Webhook] Skipping duplicate message ID: ${msg.messageId}`);
      continue;
    }
    processedMessageIds.add(msg.messageId);

    // Bounded eviction to avoid unbounded memory growth
    if (processedMessageIds.size > 1000) {
      const oldestId = processedMessageIds.values().next().value;
      if (oldestId) processedMessageIds.delete(oldestId);
    }

    // Process asynchronously outside the request lifecycle
    handleFarmerMessage(msg).catch((err) => {
      console.error(`[Webhook] Error processing message ${msg.messageId}:`, err);
    });
  }
});

/**
 * Worker handler for dispatching replies or forwarding to ASR/RAG
 */
async function handleFarmerMessage(msg: ParsedWhatsAppMessage) {
  console.log(`\n[Inbound] From: ${msg.senderName} (${msg.from}) | Type: ${msg.type}`);

  if (msg.type === 'text') {
    console.log(`[Farmer Query]: "${msg.text}"`);

    // Placeholder automated response (to be wired into the RAG worker)
    const replyText = `Ẹ n lẹ o, ${msg.senderName}! A gba ifiranṣẹ rẹ:\n\n"${msg.text}"\n\nÈtò Ọ̀rọ̀Àgbẹ̀ AI ń ṣàyẹ̀wò ìmọ̀ràn àgbẹ̀ tó tọ́ fún ọ ní Osun State...`;

    await whatsappClient.sendTextMessage({
      to: msg.from,
      text: replyText,
    });
    console.log(`[Outbound] Reply sent to ${msg.from}`);
  } else if (msg.type === 'audio') {
    console.log(`[Farmer Voice Note]: Media ID ${msg.audio?.id} (${msg.audio?.mimeType})`);

    await whatsappClient.sendTextMessage({
      to: msg.from,
      text: `Ẹ n lẹ o, ${msg.senderName}! A ti gba ohùn rẹ. A ń ṣe àyẹ̀wò rẹ̀ báyìí...`,
    });

    if (msg.audio?.id) {
      const { buffer, mimeType } = await whatsappClient.downloadAudioMedia(msg.audio.id);
      console.log(`[Audio Stream Ready] ${buffer.length} bytes (${mimeType}) available for NCAIR ASR.`);
      // Connect to the NCAIR ASR pipeline worker here
    }
  } else {
    await whatsappClient.sendTextMessage({
      to: msg.from,
      text: 'Ẹ jọ̀wọ́, ẹ fi ifiranṣẹ kíkọ tàbí ohùn (voice note) ránṣẹ́ sí wa lórí ètò Ọ̀rọ̀Àgbẹ̀.',
    });
  }
}

// ---------------------------------------------------------------------------
// 4. Application API Routes
// ---------------------------------------------------------------------------
app.use('/api/chat', chatRouter); // <-- ADDED: Frontend needs this to stream LLM responses
app.use('/api/locations', locationsRouter);
app.use('/api', routes);

// ---------------------------------------------------------------------------
// 5. Global Error Handler & 404 Fallback
// ---------------------------------------------------------------------------
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.status || err.statusCode || 500;
  console.error(`[Error] ${req.path}:`, err.message);
  res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
  });
});

// ---------------------------------------------------------------------------
// 6. Server Initialization
// ---------------------------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server is running on http://127.0.0.1:${PORT}`);
});