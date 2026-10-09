import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import { locationsRouter } from '../routes/locations.js';

describe('Task 6: GET /api/locations (Fuzzy Resolution)', () => {
  let app: express.Application;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/locations', locationsRouter);

    // Guardrail: Ensure all Express errors return JSON rather than HTML documents
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const statusCode = res.statusCode >= 400 ? res.statusCode : 500;
      res.status(statusCode).json({ error: err.message || 'Internal Server Error' });
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          baseUrl = `http://127.0.0.1:${address.port}/api/locations`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('should resolve standard input "Obaagun" to expected coordinates', async () => {
    const res = await fetch(`${baseUrl}?q=Obaagun`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    const topMatch = data[0];
    expect(topMatch.name_en).toBe('Obaagun');
    expect(topMatch.lat).toBeCloseTo(7.8925, 3);
    expect(topMatch.lon).toBeCloseTo(4.6714, 3);
    expect(topMatch.confidence).toBeGreaterThan(0.7);
  });

  it('should resolve typo/unaccented input "obagun" to "Ọbaagun"', async () => {
    const res = await fetch(`${baseUrl}?q=obagun`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    const topMatch = data[0];
    expect(topMatch.name_en).toBe('Obaagun');
    expect(topMatch.lat).toBeCloseTo(7.8925, 3);
    expect(topMatch.lon).toBeCloseTo(4.6714, 3);
  });

  it('should resolve "Osogbo" correctly with valid coordinates', async () => {
    const res = await fetch(`${baseUrl}?q=Osogbo`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    const topMatch = data[0];
    expect(topMatch.name_en).toBe('Osogbo');
    expect(topMatch.lat).toBeCloseTo(7.7827, 3);
    expect(topMatch.lon).toBeCloseTo(4.5418, 3);
  });

  it('should reject queries shorter than 2 characters with 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}?q=a`);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data).toHaveProperty('error');
    expect(data.details).toBeInstanceOf(Array);
  });
});