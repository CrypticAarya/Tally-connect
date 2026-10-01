import express from 'express';
import { SaasRepository } from '../../db/saasRepository.js';

const router = express.Router();

/**
 * POST /api/connect/session
 * Creates an embedded connection session for SaaS applications
 * 
 * Input:
 * {
 *   app_id: string,
 *   external_user_id: string,
 *   callback_url?: string
 * }
 * 
 * Returns:
 * {
 *   session_id: string,
 *   activation_code: string,
 *   expires_at: string
 * }
 */
router.post('/', async (req, res) => {
  const {
    app_id,
    appId,
    saas_app_id,
    saasAppId,
    external_user_id,
    externalUserId,
    callback_url,
    callbackUrl,
    company_name,
    companyName
  } = req.body || {};

  const effectiveAppId = app_id || appId || saas_app_id || saasAppId;
  const effectiveUserId = external_user_id || externalUserId;
  const effectiveCallback = callback_url || callbackUrl;
  const effectiveCompany = company_name || companyName;

  if (!effectiveAppId || !effectiveUserId) {
    return res.status(400).json({
      success: false,
      error: 'app_id and external_user_id are required to create a connection session.'
    });
  }

  try {
    const existingApp = await SaasRepository.getAppById(effectiveAppId);
    if (!existingApp) {
      return res.status(404).json({
        success: false,
        error: { code: 'APP_NOT_FOUND', message: `Application "${effectiveAppId}" not found.` }
      });
    }

    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    if (apiKey) {
      const authApp = await SaasRepository.findAppByApiKey(apiKey);
      if (!authApp || authApp.status === 'DISABLED' || authApp.is_active === false) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid or disabled API key.' }
        });
      }
      if (authApp.id !== effectiveAppId) {
        return res.status(403).json({
          success: false,
          error: { code: 'APP_ACCESS_DENIED', message: 'API key does not match the requested app_id.' }
        });
      }
    }

    const connection = await SaasRepository.initiateConnection({
      saasAppId: effectiveAppId,
      externalUserId: effectiveUserId,
      companyName: effectiveCompany
    });

    const expiresAt = new Date(connection.expiry_time).toISOString();

    return res.status(201).json({
      success: true,
      session_id: connection.connection_id,
      sessionId: connection.connection_id,
      connection_id: connection.connection_id,
      activation_code: connection.activation_code,
      activationCode: connection.activation_code,
      expires_at: expiresAt,
      expiresAt: expiresAt,
      callback_url: effectiveCallback || null
    });
  } catch (err) {
    console.error('[Connect Session Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
