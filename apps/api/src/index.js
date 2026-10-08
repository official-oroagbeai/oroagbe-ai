// api/src/index.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import dotenv from 'dotenv';
import routes from './routes/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security and Logging Middlewares
app.use(helmet()); // Sets secure HTTP headers
app.use(cors());
app.use(express.json());
app.use(pinoHttp({
  transport: {
    target: 'pino-pretty', // Makes logs readable in development
    options: { colorize: true }
  }
}));

// Mount our application routes
app.use('/api', routes);

// Global Error Handler
app.use((err, req, res, next) => {
  req.log.error(err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Express API] Orchestrator running on port ${PORT}`);
});