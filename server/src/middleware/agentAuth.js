import { pool } from '../db/mysql.js';

/**
 * Middleware: Strictly authenticates desktop connector agents via Bearer token
 * Enforces cross-connection isolation and rejects mismatched connection IDs.
 */
export async function authenticateAgent(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AGENT_AUTH_FAILED',
        message: 'Agent authentication required: Bearer token is missing.'
      }
    });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AGENT_AUTH_FAILED',
        message: 'Agent authentication required: Empty Bearer token.'
      }
    });
  }

  try {
    const [agentRows] = await pool.query(
      `SELECT id, connection_id, machine_name, status, agent_token, active_company
       FROM agents
       WHERE agent_token = ?
       LIMIT 1`,
      [token]
    );

    if (agentRows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AGENT_AUTH_FAILED',
          message: 'Invalid or unrecognized agent token.'
        }
      });
    }

    const agent = agentRows[0];

    const [connRows] = await pool.query(
      `SELECT id, saas_app_id, status, company_name
       FROM connections
       WHERE id = ?
       LIMIT 1`,
      [agent.connection_id]
    );

    if (connRows.length === 0) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'CONNECTION_NOT_FOUND',
          message: 'Agent connection not found or inactive.'
        }
      });
    }

    const connection = connRows[0];

    // Enforce Cross-Connection Protection:
    // If request body, params, or headers specify a connection ID, it MUST match the authenticated agent's connection ID
    const claimedConnId =
      req.body?.connection_id ||
      req.body?.connectionId ||
      req.params?.connectionId ||
      req.headers['x-connection-id'];

    if (claimedConnId && claimedConnId !== agent.connection_id) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'CONNECTION_MISMATCH',
          message: 'Cross-connection access denied: Agent does not belong to the requested connection.'
        }
      });
    }

    // Attach authenticated agent and verified connection to request
    req.agent = agent;
    req.connection = connection;
    req.connectionId = agent.connection_id;

    next();
  } catch (err) {
    console.error('[Agent Authentication Error]:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal agent authentication error'
    });
  }
}
