import express from 'express';
import { SaasRepository } from '../../db/saasRepository.js';
import { ActivationService } from '../../services/activationService.js';
import { AgentService } from '../../services/agentService.js';

const router = express.Router();

/**
 * GET /api/connect/status/:code
 * Polled by frontend onboarding page to check if the desktop agent has completed activation
 */
router.get('/:code', async (req, res) => {
  const { code } = req.params;
  const cleanCode = (code || '').trim().toUpperCase();

  try {
    // 1. Check MySQL connections first
    const connection = await SaasRepository.findConnectionByActivationCode(cleanCode);
    if (connection) {
      const isPaired = connection.status === 'ACTIVE';
      const agentHealth = connection.agent_id ? AgentService.getAgentHealth(connection.agent_id) : null;

      return res.json({
        code: cleanCode,
        connectionId: connection.id,
        status: connection.status,
        paired: isPaired,
        agentStatus: agentHealth?.status || (isPaired ? 'ONLINE' : 'WAITING_FOR_AGENT'),
        activeCompany: connection.company_name || agentHealth?.activeCompany || null,
        expiresAt: connection.expiry_time
      });
    }

    // 2. Fallback to in-memory ActivationService
    const record = ActivationService.activeCodes.get(cleanCode);
    if (record) {
      const agentHealth = AgentService.getAgentHealth(`agt_${record.connectionId}`);
      return res.json({
        code: cleanCode,
        connectionId: record.connectionId,
        status: record.used ? 'ACTIVE' : 'PENDING',
        paired: Boolean(record.used),
        agentStatus: agentHealth.status || (record.used ? 'ONLINE' : 'WAITING_FOR_AGENT'),
        activeCompany: agentHealth.activeCompany || null,
        expiresAt: record.expiresAt.toISOString()
      });
    }

    return res.status(404).json({ error: 'Activation code not found or expired' });
  } catch (err) {
    console.error('[Connect Status Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
