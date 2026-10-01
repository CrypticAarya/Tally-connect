import express from 'express';
import { SaasRepository } from '../../db/saasRepository.js';

const router = express.Router();

/**
 * POST /api/agent/activate
 * Agent submits activation code.
 * Validates code, links agent, creates agent record, generates agent token, marks connection ACTIVE.
 */
router.post('/', async (req, res) => {
  const {
    activation_code,
    activationCode,
    machine_name,
    machineName,
    active_company,
    activeCompany
  } = req.body || {};

  const code = activation_code || activationCode;

  if (!code) {
    return res.status(400).json({ error: 'Missing required field: "activation_code"' });
  }

  try {
    const connection = await SaasRepository.findConnectionByActivationCode(code);
    if (!connection) {
      return res.status(404).json({ error: 'Invalid activation code' });
    }

    if (connection.status === 'ACTIVE') {
      return res.status(400).json({ error: 'Activation code has already been activated' });
    }

    if (connection.expiry_time && new Date() > new Date(connection.expiry_time)) {
      return res.status(400).json({ error: 'Activation code has expired' });
    }

    const result = await SaasRepository.activateAgentForConnection({
      connectionId: connection.id,
      machineName: machine_name || machineName || 'DESKTOP-AGENT',
      activeCompany: active_company || activeCompany || connection.company_name
    });

    return res.json({
      success: true,
      connection_id: result.connection_id,
      connectionId: result.connection_id,
      agent_id: result.agent_id,
      agentId: result.agent_id,
      agent_token: result.agent_token,
      agentToken: result.agent_token,
      status: result.status,
      company_name: result.company_name,
      companyName: result.company_name
    });
  } catch (err) {
    console.error('[Agent Activate Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
