import express from 'express';
import v1Router from './v1/index.js';
import connectRouter from './connect/index.js';
import agentRouter from './agent/index.js';
import internalRouter from './internal/index.js';
import developerRouter from './developer/index.js';
import docsRouter from './docs.js';
import adminRouter from './admin/index.js';
import legacyApiRouter from './apiRoutes.js';

const router = express.Router();

// Modular Route Groups
router.use('/v1', v1Router);
router.use('/connect', connectRouter);
router.use('/agent', agentRouter);
router.use('/internal', internalRouter);
router.use('/developer', developerRouter);
router.use('/docs', docsRouter);
router.use('/admin', adminRouter);

// Shortcut for playground testing: /api/playground
router.post('/playground', (req, res, next) => {
  req.url = '/playground';
  developerRouter(req, res, next);
});

// Fallback to legacy routes to guarantee 100% backward compatibility
router.use('/', legacyApiRouter);

export default router;
