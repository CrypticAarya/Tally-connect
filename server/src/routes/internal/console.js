import express from 'express';
import { AgentService } from '../../services/agentService.js';
import { SyncService } from '../../services/syncService.js';
import { ActivationService } from '../../services/activationService.js';

const router = express.Router();

/**
 * GET /api/internal/console/metrics
 * Returns operator telemetry for the testing console
 */
router.get('/metrics', (req, res) => {
  const agents = AgentService.listAgents();
  const onlineCount = agents.filter(a => a.status === 'ONLINE').length;

  return res.json({
    activeAgents: onlineCount,
    totalRegisteredAgents: agents.length,
    activeCodesCount: ActivationService.activeCodes.size,
    cachedEntitiesCount: SyncService.entityCache.size
  });
});

export default router;
