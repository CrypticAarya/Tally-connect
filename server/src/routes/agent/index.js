import express from 'express';
import activateRouter from './activate.js';
import heartbeatRouter from './heartbeat.js';
import tasksRouter from './tasks.js';
import syncRouter from './sync.js';

const router = express.Router();

router.use('/activate', activateRouter);
router.use('/heartbeat', heartbeatRouter);
router.use('/tasks', tasksRouter);
router.use('/sync', syncRouter);

export default router;
