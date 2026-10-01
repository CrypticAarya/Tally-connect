import express from 'express';
import { SaasRepository } from '../../db/saasRepository.js';
import { WebhookService } from '../../services/webhookService.js';
import {
  generateDeveloperToken,
  authenticateDeveloper,
  optionalDeveloperAuth,
  verifyAppOwnership
} from '../../middleware/developerAuth.js';

const router = express.Router();

/**
 * POST /api/developer/register
 * Creates a new SaaS Developer account and returns an authentication token
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const developer = await SaasRepository.createDeveloper({ name, email, password });
    const token = generateDeveloperToken(developer);
    return res.status(201).json({
      success: true,
      message: 'Developer account created successfully',
      developer,
      token
    });
  } catch (err) {
    if (err.statusCode === 409 || err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A developer account with this email already exists' });
    }
    console.error('[Developer Register Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/developer/login
 * Authenticates developer credentials and returns an authentication token
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const developer = await SaasRepository.verifyDeveloperCredentials(email, password);
    if (!developer) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateDeveloperToken(developer);
    return res.json({
      success: true,
      message: 'Login successful',
      developer,
      token
    });
  } catch (err) {
    console.error('[Developer Login Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/developer/apps
 * Creates a new application with an API key and webhook configuration
 * Strictly assigns application ownership to authenticated developer
 */
router.post('/apps', optionalDeveloperAuth, async (req, res) => {
  try {
    const {
      app_name,
      appName,
      webhook_url,
      webhookUrl,
      developer_id,
      developerId
    } = req.body || {};

    const effectiveName = app_name || appName || req.body?.name;
    const effectiveWebhook = webhook_url || webhookUrl;
    const bodyDevId = developer_id || developerId;

    if (!effectiveName) {
      return res.status(400).json({ error: 'Application name (app_name) is required' });
    }

    // If caller tries to claim a developer ID without authenticating as that developer, reject
    if (bodyDevId && (!req.developer || req.developer.id !== bodyDevId)) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required to assign applications to a developer account.'
      });
    }

    const effectiveDevId = req.developer ? req.developer.id : (bodyDevId || null);

    const app = await SaasRepository.createApp({
      appName: effectiveName,
      webhookUrl: effectiveWebhook,
      developerId: effectiveDevId
    });

    return res.status(201).json({
      success: true,
      message: 'Application created successfully',
      app
    });
  } catch (err) {
    console.error('[Developer Create App Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/developer/apps
 * Lists applications strictly owned by the authenticated developer
 */
router.get('/apps', authenticateDeveloper, async (req, res) => {
  try {
    const apps = await SaasRepository.listApps(req.developer.id);
    return res.json({
      success: true,
      count: apps.length,
      apps
    });
  } catch (err) {
    console.error('[Developer List Apps Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/developer/apps/:id
 * Fetches an application by ID (requires ownership)
 */
router.get('/apps/:id', authenticateDeveloper, verifyAppOwnership, async (req, res) => {
  const app = req.targetApp || req.app;
  return res.json({
    success: true,
    app: app
  });
});

/**
 * GET /api/developer/apps/:id/api-key
 * Retrieves the API credentials for an application (strictly requires developer ownership)
 */
router.get('/apps/:id/api-key', authenticateDeveloper, verifyAppOwnership, async (req, res) => {
  const app = req.targetApp || req.app;
  return res.json({
    success: true,
    app_id: app.id,
    app_name: app.app_name || app.name,
    api_key: app.api_key,
    api_secret: app.api_secret,
    status: app.status,
    is_active: Boolean(app.is_active)
  });
});

/**
 * POST /api/developer/apps/:id/regenerate-key
 * Regenerates an application's API Key and Secret (strictly requires developer ownership)
 */
router.post('/apps/:id/regenerate-key', authenticateDeveloper, verifyAppOwnership, async (req, res) => {
  try {
    const result = await SaasRepository.regenerateAppApiKey(req.params.id);
    return res.json({
      success: true,
      message: 'API Key regenerated successfully',
      app: result
    });
  } catch (err) {
    console.error('[Developer Regenerate Key Error]:', err);
    return res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
  }
});

/**
 * POST /api/developer/apps/:id/disable
 * Disables an application's API Key (strictly requires developer ownership)
 */
router.post('/apps/:id/disable', authenticateDeveloper, verifyAppOwnership, async (req, res) => {
  try {
    const result = await SaasRepository.setAppStatus(req.params.id, { isActive: false, status: 'DISABLED' });
    return res.json({
      success: true,
      message: 'API key disabled successfully',
      app: result
    });
  } catch (err) {
    console.error('[Developer Disable Key Error]:', err);
    return res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
  }
});

/**
 * POST /api/developer/apps/:id/enable
 * Re-enables an application's API Key (strictly requires developer ownership)
 */
router.post('/apps/:id/enable', authenticateDeveloper, verifyAppOwnership, async (req, res) => {
  try {
    const result = await SaasRepository.setAppStatus(req.params.id, { isActive: true, status: 'ACTIVE' });
    return res.json({
      success: true,
      message: 'API key enabled successfully',
      app: result
    });
  } catch (err) {
    console.error('[Developer Enable Key Error]:', err);
    return res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
  }
});

/**
 * GET /api/developer/apps/:id/webhooks
 * Retrieves webhook delivery logs for an application (strictly requires developer ownership)
 */
router.get('/apps/:id/webhooks', authenticateDeveloper, verifyAppOwnership, async (req, res) => {
  try {
    const logs = await SaasRepository.getWebhookLogs(req.params.id, req.query.limit || 50);
    return res.json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (err) {
    console.error('[Developer Webhooks Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/developer/playground
 * Interactive API testing playground: executes live requests using developer API key
 */
router.post('/playground', async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      api_key,
      apiKey,
      endpoint = '/api/v1/customers',
      method = 'GET',
      headers = {},
      body
    } = req.body || {};

    const effectiveApiKey = api_key || apiKey;
    if (!effectiveApiKey) {
      return res.status(400).json({
        success: false,
        error: 'API key (api_key) is required for playground request testing.'
      });
    }

    // Determine target URL for internal dispatch
    let cleanEndpoint = endpoint.trim();
    if (!cleanEndpoint.startsWith('/')) cleanEndpoint = `/${cleanEndpoint}`;
    if (!cleanEndpoint.startsWith('/api/')) cleanEndpoint = `/api/v1${cleanEndpoint}`;

    const port = process.env.PORT || 5001;
    const targetUrl = `http://127.0.0.1:${port}${cleanEndpoint}`;

    const requestHeaders = {
      'x-api-key': effectiveApiKey,
      'Content-Type': 'application/json',
      ...headers
    };

    const fetchOptions = {
      method: method.toUpperCase(),
      headers: requestHeaders,
      signal: AbortSignal.timeout(10000)
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(fetchOptions.method)) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const liveResponse = await fetch(targetUrl, fetchOptions);
    const durationMs = Date.now() - startTime;
    const contentType = liveResponse.headers.get('content-type') || '';

    let jsonResponse;
    if (contentType.includes('application/json')) {
      jsonResponse = await liveResponse.json().catch(() => ({}));
    } else {
      const text = await liveResponse.text().catch(() => '');
      try {
        jsonResponse = JSON.parse(text);
      } catch {
        jsonResponse = { raw: text };
      }
    }

    return res.json({
      success: liveResponse.ok,
      statusCode: liveResponse.status,
      statusText: liveResponse.statusText,
      durationMs,
      endpoint: cleanEndpoint,
      method: fetchOptions.method,
      response: jsonResponse
    });
  } catch (err) {
    const durationMs = Date.now() - startTime;
    return res.status(500).json({
      success: false,
      statusCode: 500,
      durationMs,
      error: `Playground execution failed: ${err.message}`
    });
  }
});

export default router;
