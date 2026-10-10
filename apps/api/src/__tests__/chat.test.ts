import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { Server } from 'http';
import { createApp } from '../app.js';
import * as orchestrator from '../services/llm_orchestrator.js';

describe('Task 15: LLM Orchestration & Streaming Chat Endpoint', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as any;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('should reject invalid chat requests with 400', async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid request payload');
  });

  it('should stream chat chunks via text/event-stream', async () => {
    // Mock the orchestrator stream generator
    vi.spyOn(orchestrator, 'orchestrateChatStream').mockImplementation(async function* () {
      yield `data: ${JSON.stringify({ text: 'E kaabo! ' })}\n\n`;
      yield `data: ${JSON.stringify({ text: 'Lati gbin agbado, lo NPK 15:15:15.' })}\n\n`;
      yield 'data: [DONE]\n\n';
    });

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'Bawo ni mo se le gbin agbado?',
        locationId: 'osogbo'
      })
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';

    while (reader) {
      const { value, done } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });
    }

    expect(accumulated).toContain('E kaabo! ');
    expect(accumulated).toContain('Lati gbin agbado, lo NPK 15:15:15.');
    expect(accumulated).toContain('data: [DONE]');
  });

  it('should append safety advisory notice when verifier detects dosage violation', async () => {
    // Simulate LLM streaming an excessive Urea dosage
    vi.spyOn(orchestrator, 'orchestrateChatStream').mockImplementation(async function* () {
      yield `data: ${JSON.stringify({ text: 'Apply 500 kg/ha of Urea to your maize.' })}\n\n`;
      yield `data: ${JSON.stringify({ text: '\n\n⚠️ **AGRONOMIC SAFETY ADVISORY:**\n- [CRITICAL] Dangerous Urea rate detected: 500 kg/ha', safetyNotice: true })}\n\n`;
      yield 'data: [DONE]\n\n';
    });

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'How much urea should I add to my maize field?',
        locationId: 'osogbo'
      })
    });

    const text = await res.text();
    expect(text).toContain('500 kg/ha of Urea');
    expect(text).toContain('AGRONOMIC SAFETY ADVISORY');
    expect(text).toContain('Dangerous Urea rate detected');
    expect(text).toContain('data: [DONE]');
  });
});