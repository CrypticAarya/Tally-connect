import express from 'express';
import { SyncService } from '../../services/syncService.js';

const router = express.Router();

/**
 * POST /api/v1/sync
 * Triggers an immediate background synchronization job for a customer connection
 */
router.post('/', (req, res) => {
  const bodyConnId = req.body?.connectionId || req.body?.connection_id;
  const effectiveConnId = req.connectionId || bodyConnId;

  if (bodyConnId && req.connectionId && bodyConnId !== req.connectionId) {
    return res.status(403).json({
      success: false,
      error: 'Cross-connection access denied: Application does not own this connection.'
    });
  }

  if (!effectiveConnId) {
    return res.status(400).json({ error: 'Missing required field: "connectionId"' });
  }

  const { datasets } = req.body || {};

  const requestedDatasets = Array.isArray(datasets) && datasets.length > 0 
    ? datasets 
    : ['CUSTOMERS', 'SALES', 'INVENTORY', 'LEDGERS', 'TRIAL_BALANCE'];

  const task = SyncService.queueSyncTask({
    connectionId: effectiveConnId,
    datasets: requestedDatasets,
    requestedBy: 'SAAS_API'
  });

  return res.status(202).json({
    success: true,
    message: 'Synchronization task queued',
    task
  });
});

export default router;
