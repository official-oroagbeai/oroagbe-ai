import { Router, Request, Response } from 'express';

export const webhookRouter = Router();

// GET /api/webhooks/whatsapp (Meta Verification Challenge)
webhookRouter.get('/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'oroagbe_osun_verify_token_2026';

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('[Webhook] Handshake verified with Meta!');
    // Send challenge as raw string, NOT json
    return res.status(200).send(challenge);
  }

  console.warn('[Webhook] Verification failed. Token received:', token);
  return res.sendStatus(403);
});

// POST /api/webhooks/whatsapp (Inbound Messages)
webhookRouter.post('/whatsapp', (req: Request, res: Response) => {
  // Acknowledge receipt within 3s to satisfy Meta SLA
  res.sendStatus(200);
  console.log('[Webhook] Inbound event:', JSON.stringify(req.body, null, 2));
});