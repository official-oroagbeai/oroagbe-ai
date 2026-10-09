import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Server } from 'http';
import { createApp } from '../app.js';

describe('Task 10: Express Middleware & Security Hardening', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    // Main server with standard capacity (100 requests)
    const testApp = createApp();

    await new Promise<void>((resolve) => {
      server = testApp.listen(0, () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          baseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('should include secure HTTP headers set by helmet', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);

    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-dns-prefetch-control')).toBe('off');
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
  });

  it('should suppress stack traces and sanitize error output in production mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const res = await fetch(`${baseUrl}/test-error`);
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.error).toBe('Internal Server Error');
      expect(body.stack).toBeUndefined();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('should include error details and stack trace in non-production mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const res = await fetch(`${baseUrl}/test-error`);
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.error).toBe('Simulated internal failure');
      expect(body.stack).toBeDefined();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('should trigger HTTP 429 when rate limit is exceeded on an isolated server', async () => {
    // Dedicated app instance configured with a low limit of 3 requests
    const limitedApp = createApp({
      rateLimitMax: 3,
      rateLimitWindowMs: 60 * 1000
    });

    const limitedServer: Server = await new Promise((resolve) => {
      const s = limitedApp.listen(0, () => resolve(s));
    });

    const port = (limitedServer.address() as any).port;
    const testUrl = `http://127.0.0.1:${port}/api/locations?q=Osogbo`;

    try {
      // 3 allowed requests
      for (let i = 0; i < 3; i++) {
        const res = await fetch(testUrl);
        expect(res.status).toBe(200);
      }

      // 4th request must be rejected by rate limiter
      const blockedRes = await fetch(testUrl);
      expect(blockedRes.status).toBe(429);

      const body = await blockedRes.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toMatch(/too many requests/i);
    } finally {
      await new Promise<void>((resolve) => limitedServer.close(() => resolve()));
    }
  });
});