import { Repository } from '../db/repository.js';

/**
 * Middleware to authenticate desktop connector agents
 * Validates connectorId and secret token against PostgreSQL hashed secrets
 */
export async function authenticateConnector(req, res, next) {
  try {
    const connectorId =
      req.headers['x-connector-id'] ||
      req.query.connectorId ||
      req.body?.connectorId;

    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (req.headers['x-connector-secret']) {
      token = req.headers['x-connector-secret'];
    } else if (req.headers['x-connector-token']) {
      token = req.headers['x-connector-token'];
    } else if (req.body?.secret) {
      token = req.body.secret;
    }

    if (!connectorId || !token) {
      return res.status(401).json({
        error: 'Authentication failed: Missing connectorId or secret token in request'
      });
    }

    const connector = await Repository.authenticateConnector(connectorId, token);
    if (!connector) {
      return res.status(401).json({
        error: `Authentication failed: Invalid credentials for connector "${connectorId}"`
      });
    }

    // Attach authenticated connector to request
    req.connector = connector;
    next();
  } catch (err) {
    console.error('[ConnectorAuth Error]:', err.message);
    return res.status(500).json({ error: 'Internal authentication error' });
  }
}
