import express from 'express';
import { SaasRepository } from '../../db/saasRepository.js';

const router = express.Router();

/**
 * POST /api/connect/initiate
 * Called when a SaaS user clicks "Connect Tally"
 * Generates a 6-character activation code (e.g. TC-4829) and initializes a PENDING connection
 */
router.post('/', async (req, res) => {
  const {
    saas_app_id,
    saasAppId,
    external_user_id,
    externalUserId,
    company_name,
    companyName
  } = req.body || {};

  const appId = saas_app_id || saasAppId || 'app_demo_fintech';
  const userId = external_user_id || externalUserId || 'user_default';
  const company = company_name || companyName;

  try {
    const connection = await SaasRepository.initiateConnection({
      saasAppId: appId,
      externalUserId: userId,
      companyName: company
    });

    return res.status(201).json({
      success: true,
      connection_id: connection.connection_id,
      connectionId: connection.connection_id,
      activation_code: connection.activation_code,
      activationCode: connection.activation_code,
      expiry_time: connection.expiry_time,
      status: connection.status,
      company_name: connection.company_name
    });
  } catch (err) {
    console.error('[Connect Initiate Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
