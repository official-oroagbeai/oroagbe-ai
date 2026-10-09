import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { logger } from './utils/logger.js';
import { locationsRouter } from './routes/locations.js';

export interface AppOptions {
  rateLimitMax?: number;
  rateLimitWindowMs?: number;
}

export function createApp(options: AppOptions = {}) {
  const app = express();

  // 1. HTTP Security Headers
  app.use(helmet());

  // 2. Structured Request Logging (omits verbose logs during automated test runs)
  app.use(
    pinoHttp({
      logger,
      autoLogging: process.env.NODE_ENV !== 'test',
      customLogLevel: (_req, res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      }
    })
  );

  // 3. Body Parsing
  app.use(express.json());

  // 4. Global API Rate Limiting (Default: 100 requests per 15 minutes)
  const globalLimiter = rateLimit({
    windowMs: options.rateLimitWindowMs ?? 15 * 60 * 1000,
    max: options.rateLimitMax ?? 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many requests from this IP, please try again later.'
    }
  });

  app.use('/api', globalLimiter);

  // 5. Healthcheck Route
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Diagnostic route for testing error handling pipeline (outside /api to avoid rate limiter)
  app.get('/test-error', (_req: Request, _res: Response, next: NextFunction) => {
    next(new Error('Simulated internal failure'));
  });

  // 6. Registered Routers
  app.use('/api/locations', locationsRouter);

  // 7. 404 Fallback
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  // 8. Global Error Handler Middleware (Sanitizes stack traces in production)
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const statusCode = err.status || err.statusCode || 500;
    const isProduction = process.env.NODE_ENV === 'production';

    req.log?.error?.(err) || logger.error({ err, path: req.path }, err.message);

    res.status(statusCode).json({
      error: isProduction && statusCode === 500
        ? 'Internal Server Error'
        : (err.message || 'An unexpected error occurred'),
      ...(isProduction ? {} : { stack: err.stack })
    });
  });

  return app;
}

export const app = createApp();