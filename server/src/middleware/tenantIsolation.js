import { pool } from '../db/mysql.js';

/**
 * Middleware: Strictly enforces multi-tenant connection isolation for /api/v1/* endpoints.
 *
 * Rules:
 * 1. If 'x-connection-id' is provided:
 *    - Validates connection existence (404 if not found).
 *    - Validates that the connection belongs to req.saasApp.id (403 if mismatched).
 * 2. If 'x-connection-id' is omitted:
 *    - If multiple connections exist for the app -> 400 CONNECTION_ID_REQUIRED.
 *    - If exactly one connection exists -> uses that connection (backward compatibility without ambiguity).
 *    - If no connections exist -> 503 TALLY_CONNECTION_REQUIRED.
 * 3. Never falls back to default, arbitrary, or another tenant's connection.
 */
export async function enforceTenantConnection(req, res, next) {
  if (!req.saasApp) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Missing verified SaaS application context.'
    });
  }

  const rawConnId =
    req.headers['x-connection-id'] ||
    req.query.connection_id ||
    req.query.connectionId;

  const connectionId = rawConnId ? String(rawConnId).trim() : null;

  try {
    if (connectionId) {
      const [rows] = await pool.query(
        `SELECT id, saas_app_id, status, company_name
         FROM connections
         WHERE id = ?
         LIMIT 1`,
        [connectionId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CONNECTION_NOT_FOUND',
            message: `Connection "${connectionId}" not found.`
          }
        });
      }

      const connection = rows[0];

      if (connection.saas_app_id !== req.saasApp.id) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'CONNECTION_ACCESS_DENIED',
            message: 'This application does not have access to the requested connection.'
          }
        });
      }

      req.connection = connection;
      req.connectionId = connection.id;
      return next();
    }

    // connectionId is omitted: Check count of connections belonging to this SaaS app
    const [connRows] = await pool.query(
      `SELECT id, saas_app_id, status, company_name
       FROM connections
       WHERE saas_app_id = ?
       ORDER BY created_at DESC`,
      [req.saasApp.id]
    );

    if (connRows.length > 1) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONNECTION_ID_REQUIRED',
          message: 'Please provide the customer connection ID using the x-connection-id header.'
        }
      });
    }

    if (connRows.length === 1) {
      req.connection = connRows[0];
      req.connectionId = connRows[0].id;
      return next();
    }

    // 0 connections exist for this app
    return res.status(503).json({
      success: false,
      error: 'TALLY_CONNECTION_REQUIRED',
      message: 'No real Tally data available'
    });
  } catch (err) {
    console.error('[Tenant Isolation Error]:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal multi-tenant connection error'
    });
  }
}
