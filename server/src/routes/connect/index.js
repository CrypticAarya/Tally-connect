import express from 'express';
import sessionRouter from './session.js';
import initiateRouter from './initiate.js';
import statusRouter from './status.js';
import permissionsRouter from './permissions.js';
import connectionManagerRouter from './connectionManager.js';

const router = express.Router();

// Specific routes first
router.use('/session', sessionRouter);
router.use('/initiate', initiateRouter);
router.use('/status', statusRouter);
router.use('/:connectionId/permissions', permissionsRouter);
router.use('/permissions', permissionsRouter);

// Phase 7 Connection Manager routes (/:connectionId/status, /:connectionId/sync, /:connectionId/sync-history, /errors)
router.use('/', connectionManagerRouter);

export default router;
