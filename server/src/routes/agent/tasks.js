import express from 'express';
import { SyncService } from '../../services/syncService.js';
import { authenticateAgent } from '../../middleware/agentAuth.js';

const router = express.Router();

router.use(authenticateAgent);

/**
 * GET /api/agent/tasks
 * Agent polls for pending sync instructions for its authenticated connection
 */
router.get('/', (req, res) => {
  const connectionId = req.connectionId;
  const tasks = SyncService.getPendingTasks(connectionId);
  return res.json({ tasks });
});

/**
 * POST /api/agent/tasks/:taskId/payload
 * Agent streams extracted JSON entity array to the gateway
 */
router.post('/:taskId/payload', (req, res) => {
  const { taskId } = req.params;
  const connectionId = req.connectionId;
  const { entityType, data } = req.body || {};

  if (!entityType || !Array.isArray(data)) {
    return res.status(400).json({
      error: 'Payload requires "entityType" and "data" array'
    });
  }

  const cached = SyncService.cacheEntity(connectionId, entityType, data);

  return res.json({
    success: true,
    taskId,
    entityType,
    recordsStored: cached.count,
    syncedAt: cached.syncedAt
  });
});

export default router;
