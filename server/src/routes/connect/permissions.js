import express from 'express';
import { SaasRepository } from '../../db/saasRepository.js';
import { pool } from '../../db/mysql.js';

const router = express.Router({ mergeParams: true });

/**
 * Resolves and validates caller identity for connection permissions
 */
async function authenticateCallerForConnection(req, connectionId) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const authHeader = req.headers['authorization'];

  if (apiKey) {
    const app = await SaasRepository.findAppByApiKey(apiKey);
    if (!app || app.status === 'DISABLED' || app.is_active === false) {
      return { status: 401, error: { code: 'UNAUTHORIZED', message: 'Invalid or disabled API key' } };
    }
    const connection = await SaasRepository.getConnectionById(connectionId);
    if (!connection) {
      return { status: 404, error: { code: 'CONNECTION_NOT_FOUND', message: `Connection "${connectionId}" not found` } };
    }
    if (connection.saas_app_id !== app.id) {
      return { status: 403, error: { code: 'CONNECTION_ACCESS_DENIED', message: 'Access denied: Application does not own this connection' } };
    }
    return { success: true, app, connection };
  }

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const [agentRows] = await pool.query(
      'SELECT id, connection_id FROM agents WHERE agent_token = ? LIMIT 1',
      [token]
    );
    if (agentRows.length > 0 && agentRows[0].connection_id === connectionId) {
      const connection = await SaasRepository.getConnectionById(connectionId);
      return { success: true, agent: agentRows[0], connection };
    }
  }

  return { status: 401, error: { code: 'UNAUTHORIZED', message: 'Authentication required. Please provide a valid "x-api-key" header.' } };
}

/**
 * GET /api/connect/:connectionId/permissions
 * Retrieves permission matrix for a connection (requires verified caller)
 */
router.get('/', async (req, res) => {
  const connectionId = req.params.connectionId || req.query.connectionId;

  if (!connectionId) {
    return res.status(400).json({ error: 'Missing "connectionId"' });
  }

  try {
    const authResult = await authenticateCallerForConnection(req, connectionId);
    if (!authResult.success) {
      return res.status(authResult.status).json({ success: false, error: authResult.error });
    }

    const permissions = await SaasRepository.getPermissions(connectionId);
    if (!permissions) {
      return res.status(404).json({ error: `Connection "${connectionId}" not found` });
    }

    return res.json({
      success: true,
      connection_id: connectionId,
      permissions
    });
  } catch (err) {
    console.error('[Permissions GET Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/connect/:connectionId/permissions
 * Updates permission selections for a connection (strictly requires owning SaaS app API key)
 */
router.post('/', async (req, res) => {
  const connectionId = req.params.connectionId || req.body?.connectionId || req.body?.connection_id;

  if (!connectionId) {
    return res.status(400).json({ error: 'Missing "connectionId"' });
  }

  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please provide an "x-api-key" header.'
      }
    });
  }

  try {
    const app = await SaasRepository.findAppByApiKey(apiKey);
    if (!app || app.status === 'DISABLED' || app.is_active === false) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or disabled API key.'
        }
      });
    }

    const connection = await SaasRepository.getConnectionById(connectionId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: `Connection "${connectionId}" not found.`
        }
      });
    }

    if (connection.saas_app_id !== app.id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'CONNECTION_ACCESS_DENIED',
          message: 'Access denied: Application does not own this connection.'
        }
      });
    }

    const requestedPerms = req.body?.permissions || req.body || {};
    const updated = await SaasRepository.updatePermissions(connectionId, requestedPerms);

    return res.json({
      success: true,
      message: 'Permissions updated successfully',
      connection_id: connectionId,
      permissions: updated
    });
  } catch (err) {
    console.error('[Permissions POST Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
