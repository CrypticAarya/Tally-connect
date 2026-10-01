import express from 'express';
import { AgentService } from '../../services/agentService.js';
import { AgentVersionService } from '../../services/agentVersionService.js';
import { SaasRepository } from '../../db/saasRepository.js';
import { WebhookService } from '../../services/webhookService.js';
import { pool } from '../../db/mysql.js';

const router = express.Router();

/**
 * POST /api/agent/heartbeat
 * Receives recurring telemetry heartbeats from desktop connector agent and records in MySQL
 */
router.post('/', async (req, res) => {
  const {
    agentId,
    agent_id,
    connectionId,
    connection_id,
    machineName,
    machine_name,
    tallyStatus,
    tally_status,
    activeCompany,
    active_company,
    tallyVersion,
    port,
    agentVersion = '1.0.0'
  } = req.body || {};

  let effectiveAgentId = agentId || agent_id;
  let effectiveConnId = connectionId || connection_id;
  const effectiveMachine = machineName || machine_name;
  const effectiveTallyStatus = tallyStatus || tally_status || 'ONLINE';
  const effectiveCompany = activeCompany || active_company;

  // Strict agent authentication via Bearer token
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Agent authentication required: Missing Bearer token.'
    });
  }

  const token = authHeader.slice(7).trim();
  const [agentRows] = await pool.query(
    'SELECT id, connection_id FROM agents WHERE agent_token = ? LIMIT 1',
    [token]
  );

  if (agentRows.length === 0) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or unrecognized agent token.'
    });
  }

  const authenticatedAgent = agentRows[0];

  // Enforce cross-connection isolation:
  // Agent cannot heartbeat against another connection
  if (effectiveConnId && effectiveConnId !== authenticatedAgent.connection_id) {
    return res.status(403).json({
      success: false,
      error: 'Cross-connection access denied: Agent does not belong to the requested connection.'
    });
  }

  if (effectiveAgentId && effectiveAgentId !== authenticatedAgent.id) {
    return res.status(403).json({
      success: false,
      error: 'Cross-connection access denied: Agent ID mismatch.'
    });
  }

  effectiveAgentId = authenticatedAgent.id;
  effectiveConnId = authenticatedAgent.connection_id;

  const primaryAgentId = effectiveAgentId;

  const record = AgentService.recordHeartbeat({
    agentId: primaryAgentId,
    connectionId: effectiveConnId || 'conn_default',
    machineName: effectiveMachine,
    tallyStatus: effectiveTallyStatus,
    activeCompany: effectiveCompany,
    tallyVersion,
    port,
    agentVersion
  });

  // Also mirror under agt_connId for fallback lookups
  if (effectiveConnId && primaryAgentId !== `agt_${effectiveConnId}`) {
    AgentService.recordHeartbeat({
      agentId: `agt_${effectiveConnId}`,
      connectionId: effectiveConnId,
      machineName: effectiveMachine,
      tallyStatus: effectiveTallyStatus,
      activeCompany: effectiveCompany,
      tallyVersion,
      port,
      agentVersion
    });
  }

  // Persist in MySQL if agentId or connectionId present
  if (effectiveAgentId || effectiveConnId) {
    try {
      await SaasRepository.recordAgentHeartbeat({
        agentId: effectiveAgentId,
        connectionId: effectiveConnId,
        machineName: effectiveMachine,
        tallyStatus: effectiveTallyStatus,
        activeCompany: effectiveCompany
      });

      if (effectiveTallyStatus === 'OFFLINE' || req.body?.status === 'OFFLINE') {
        WebhookService.deliverForConnection(effectiveConnId, WebhookService.EVENTS.CONNECTION_OFFLINE, {
          machine: effectiveMachine,
          tallyStatus: effectiveTallyStatus,
          timestamp: new Date().toISOString()
        }).catch(() => {});
      }
    } catch (dbErr) {
      console.error('[Heartbeat MySQL Persist Warning]:', dbErr.message);
    }
  }

  const versionInfo = AgentVersionService.evaluateVersion(agentVersion);

  return res.json({
    success: true,
    acknowledged: true,
    cloudTime: new Date().toISOString(),
    status: record.status,
    versionInfo
  });
});

export default router;
