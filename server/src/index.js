import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { initDb } from './db/index.js';
import { connectorService } from './connector/index.js';
import apiRouter from './routes/index.js';
import adminRouter from './routes/admin/index.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { apiUsageTracker } from './middleware/apiUsageTracker.js';
import { JobQueue } from './queue/jobQueue.js';
import { pool } from './db/mysql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Phase 11 Step 2: Production Startup Validation
 * Strictly enforces that production mode NEVER starts with mock data dependencies.
 */
export function validateProductionSafety() {
  const nodeEnv = (process.env.NODE_ENV || config.server.env || '').toLowerCase();
  const isProd = nodeEnv === 'production' || process.env.MOCK_MODE === 'false';

  if (!isProd) {
    return; // Development mode
  }

  // 1. Production must not have MOCK_MODE=true
  if (process.env.MOCK_MODE === 'true') {
    throw new Error('FATAL: Production mode cannot start with MOCK_MODE=true. Tally Connect production mode must NEVER return fake/demo data.');
  }

  // 2. Production must not have config.mockMode === true
  if (config.mockMode) {
    throw new Error('FATAL: Production mode detected config.mockMode=true. Halting startup.');
  }

  // 3. Production must not have CONNECTOR_MODE='mock'
  if (config.connector?.mode === 'mock') {
    throw new Error("FATAL: Production mode cannot start with CONNECTOR_MODE='mock'. A real TallyPrime connection is strictly required.");
  }

  // 4. Runtime path audit for forbidden mock files
  const forbiddenProductionPaths = [
    'server/src/adapters/mockData.js',
    'server/src/adapters/mockTallyAdapter.js',
    'server/src/adapters/xmlFixtures.js',
    'connector-agent/src/adapters/xmlFixtures.js',
    'connector-agent/src/adapters/mockData.js',
    'connector-agent/src/adapters/mockTallyAdapter.js'
  ];

  const rootDir = path.resolve(__dirname, '../../');
  const foundViolations = [];
  for (const relPath of forbiddenProductionPaths) {
    if (fs.existsSync(path.join(rootDir, relPath))) {
      foundViolations.push(relPath);
    }
  }

  if (foundViolations.length > 0) {
    throw new Error(
      `FATAL: Production mode startup aborted! Detected mock files in runtime paths:\n` +
      foundViolations.map(f => `  - ${f}`).join('\n') +
      `\nAll mock data must strictly reside in /tests/mock/ for automated testing.`
    );
  }

  console.log('🔒 [Production Startup Validation] Passed: Zero mock data dependencies in runtime paths.');
}

const app = express();

// Middlewares
app.use(cors({ origin: config.server.corsOrigins || '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Production Hardening: API Usage Tracker & Rate Limiter
app.use(apiUsageTracker);
app.use(rateLimiter);

// Direct Admin Endpoints (/admin/stats, /admin/sync-health)
app.use('/admin', adminRouter);

// API Routes
app.use('/api', apiRouter);

// Production Health & Observability Endpoints
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'tally-connect-server',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 as healthy');
    const dbHealthy = rows && rows.length > 0;
    
    if (!dbHealthy) {
      return res.status(503).json({
        status: 'NOT_READY',
        database: 'unresponsive',
        timestamp: new Date().toISOString()
      });
    }

    res.status(200).json({
      status: 'READY',
      database: 'connected',
      queue: JobQueue.isProcessing ? 'active' : 'idle',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: 'NOT_READY',
      database: 'error',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/version', (req, res) => {
  res.status(200).json({
    version: '1.0.0',
    service: 'tally-connect-server',
    environment: process.env.NODE_ENV || 'production',
    nodeVersion: process.version,
    commit: process.env.GIT_COMMIT || 'production-release',
    buildDate: process.env.BUILD_DATE || '2026-09-30'
  });
});

// Legacy/Compatibility health endpoint
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
  // Validate production safety (zero mock data dependencies)
  validateProductionSafety();

  // Initialize database schema
  await initDb();

  // Initialize connector service
  await connectorService.initialize();

  // Start background job queue worker
  JobQueue.startWorker();

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
