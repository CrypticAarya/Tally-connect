import express from 'express';
import { SaasRepository } from '../../db/saasRepository.js';

const router = express.Router();

/**
 * GET /api/internal/apps
 * Lists all registered SaaS applications from MySQL
 */
router.get('/', async (req, res) => {
  try {
    const apps = await SaasRepository.listSaasApps();
    return res.json({
      success: true,
      count: apps.length,
      apps
    });
  } catch (err) {
    console.error('[Apps GET Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/internal/apps
 * Registers a new SaaS application in MySQL with API credentials
 */
router.post('/', async (req, res) => {
  const { name, appName, redirect_url, redirectUrl } = req.body || {};
  const appTitle = name || appName;

  if (!appTitle) {
    return res.status(400).json({ error: 'Missing required field: "name"' });
  }

  try {
    const app = await SaasRepository.createSaasApp({
      name: appTitle,
      redirectUrl: redirect_url || redirectUrl
    });

    return res.status(201).json({
      success: true,
      message: 'SaaS application registered successfully',
      app
    });
  } catch (err) {
    console.error('[Apps POST Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/internal/apps/:id/regenerate-key
 * Regenerates the API key and secret for a SaaS application
 */
router.post('/:id/regenerate-key', async (req, res) => {
  const { id } = req.params;

  try {
    const updated = await SaasRepository.regenerateApiKey(id);
    return res.json({
      success: true,
      message: `API Key regenerated for application "${updated.name}"`,
      app: updated
    });
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    console.error('[Apps RegenerateKey Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
