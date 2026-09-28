import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { initDb } from './db/index.js';
import { connectorService } from './connector/index.js';
import apiRouter from './routes/apiRoutes.js';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api', apiRouter);

// Basic health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'tally-connect-server',
    time: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ServerError]', err);
  res.status(500).json({
    error: err.message || 'Internal Server Error'
  });
});

/**
 * Starts the HTTP server and initializes the ConnectorService
 */
export async function startServer(port = config.server.port) {
  // Initialize database schema
  await initDb();

  // Initialize connector service
  await connectorService.initialize();

  return new Promise((resolve) => {
    const server = app.listen(port, config.server.host, () => {
      console.log(`\n======================================================`);
      console.log(`🚀 Tally Connect Server listening on port ${port}`);
      console.log(`📡 Connector Mode: ${config.connector.mode.toUpperCase()}`);
      console.log(`🌐 Base URL: http://localhost:${port}`);
      console.log(`======================================================\n`);
      resolve(server);
    });
  });
}

// Start automatically if executed directly
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export default app;
