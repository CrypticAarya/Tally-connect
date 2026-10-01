import { SaasRepository } from '../db/saasRepository.js';

/**
 * Middleware: Authenticates incoming API requests using the 'x-api-key' header.
 * 
 * Attaches the verified SaaS application record to `req.saasApp`.
 */
export async function authenticateSaasApp(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (!apiKey) {
    return res.status(401).json({
      error: 'Authentication required. Please provide an "x-api-key" header.'
    });
  }

  try {
    const app = await SaasRepository.findAppByApiKey(apiKey);
    if (!app) {
      return res.status(403).json({
        error: 'Invalid or unrecognized API key.'
      });
    }

    if (app.is_active === false || app.status === 'DISABLED') {
      return res.status(403).json({
        error: 'API key has been disabled. Please enable it in the developer portal or generate a new key.'
      });
    }

    req.saasApp = app;
    next();
  } catch (err) {
    console.error('[SaasAuth Middleware Error]:', err);
    return res.status(500).json({ error: 'Internal authentication error' });
  }
}
