import express from 'express';
import { SaasRepository } from '../../db/saasRepository.js';
import { AgentService } from '../../services/agentService.js';
import { CUSTOMER_ERRORS, formatCustomerError } from '../../errors/customerErrors.js';
import { pool } from '../../db/mysql.js';

const router = express.Router();

/**
 * GET /api/connect/errors
 * Returns the catalog of standardized customer friendly errors
 */
router.get('/errors', (req, res) => {
  return res.json({
    success: true,
    errors: CUSTOMER_ERRORS
  });
});

/**
 * GET /api/connect/errors/:code
 * Returns specific customer friendly error details
 */
router.get('/errors/:code', (req, res) => {
  const err = formatCustomerError(req.params.code);
  return res.json({
    success: true,
    error: err
  });
});

/**
 * GET /api/connect/:connectionId/status
 * Detailed connection health, company state, agent telemetry, and permissions
 */
router.get('/:connectionId/status', async (req, res) => {
  const { connectionId } = req.params;

  try {
    let connection = await SaasRepository.getConnectionById(connectionId);
    if (!connection) {
      connection = await SaasRepository.findConnectionByActivationCode(connectionId);
    }

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: formatCustomerError('NETWORK_ERROR', {
          message: `Connection not found for ID or code "${connectionId}".`
        })
      });
    }

    // 1. Fetch permissions
    const rawPerms = connection.permissions || await SaasRepository.getPermissions(connection.id) || {};
    const permissions = {
      customers: rawPerms.allow_customers !== false && rawPerms.customers !== false,
      vendors: rawPerms.allow_vendors !== false && rawPerms.vendors !== false,
      sales: rawPerms.allow_sales !== false && rawPerms.sales !== false,
      inventory: Boolean(rawPerms.allow_inventory || rawPerms.inventory),
      ledgers: rawPerms.allow_ledgers !== false && rawPerms.ledgers !== false,
      orders: Boolean(rawPerms.allow_orders || rawPerms.orders),
      delivery_notes: Boolean(rawPerms.allow_delivery_notes || rawPerms.delivery_notes),
      receipt_notes: Boolean(rawPerms.allow_receipt_notes || rawPerms.receipt_notes),
      trial_balance: Boolean(rawPerms.allow_trial_balance || rawPerms.trial_balance)
    };

    // 2. Fetch agent status & telemetry
    let agentRecord = null;
    if (connection.agent_id) {
      const [rows] = await pool.query(
        `SELECT id, machine_name, status, last_heartbeat, active_company
         FROM agents
         WHERE id = ? LIMIT 1`,
        [connection.agent_id]
      );
      agentRecord = rows[0] || null;
    }

    const agentHealth = connection.agent_id
      ? (AgentService.getAgentHealth(connection.agent_id) || AgentService.getAgentHealth(`agt_${connection.id}`))
      : AgentService.getAgentHealth(`agt_${connection.id}`);

    let agentStatus = 'WAITING_FOR_AGENT';
    let tallyStatus = 'UNKNOWN';

    if (connection.status === 'ACTIVE') {
      const isAgentRecent = agentHealth?.lastHeartbeat && !agentHealth.isStale;
      agentStatus = isAgentRecent ? 'ONLINE' : (agentRecord?.status || 'ONLINE');
      tallyStatus = agentHealth?.tallyStatus || (agentStatus === 'ONLINE' ? 'ONLINE' : 'OFFLINE');
    }

    const companyName = agentHealth?.activeCompany ||
                        agentRecord?.active_company ||
                        connection.company_name ||
                        'TallyPrime Company';

    const lastSync = connection.last_sync
      ? new Date(connection.last_sync).toISOString()
      : null;

    // Determine if any customer-facing friendly error exists
    let friendlyError = null;
    if (connection.status === 'ACTIVE') {
      if (agentStatus === 'OFFLINE') {
        friendlyError = CUSTOMER_ERRORS.AGENT_OFFLINE;
      } else if (tallyStatus === 'OFFLINE') {
        friendlyError = CUSTOMER_ERRORS.TALLY_NOT_RUNNING;
      }
    }

    return res.json({
      success: true,
      connection_id: connection.id,
      connectionId: connection.id,
      status: connection.status,
      company_name: companyName,
      companyName: companyName,
      agent_status: agentStatus,
      agentStatus: agentStatus,
      tally_status: tallyStatus,
      tallyStatus: tallyStatus,
      last_sync: lastSync,
      lastSync: lastSync,
      permissions,
      error: friendlyError
    });
  } catch (err) {
    console.error('[Connect Detailed Status Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/connect/:connectionId/sync
 * Triggers an immediate synchronization cycle for permitted entities
 */
router.post('/:connectionId/sync', async (req, res) => {
  const { connectionId } = req.params;

  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: formatCustomerError('UNAUTHORIZED', {
        message: 'Authentication required. Please provide an "x-api-key" header.',
        solution: 'Provide a valid "x-api-key" header with your application credentials.'
      })
    });
  }

  try {
    const app = await SaasRepository.findAppByApiKey(apiKey);
    if (!app || app.status === 'DISABLED' || app.is_active === false) {
      return res.status(401).json({
        success: false,
        error: formatCustomerError('UNAUTHORIZED', {
          message: 'Invalid or disabled API key.',
          solution: 'Verify your API key in the developer portal or generate a new key.'
        })
      });
    }

    const connection = await SaasRepository.getConnectionById(connectionId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: formatCustomerError('NETWORK_ERROR', { message: `Connection "${connectionId}" not found.` })
      });
    }

    if (connection.saas_app_id !== app.id) {
      return res.status(403).json({
        success: false,
        error: formatCustomerError('CONNECTION_ACCESS_DENIED', {
          message: 'Access denied: Application does not own this connection.',
          solution: 'Ensure the request uses the API key of the SaaS application that owns this connection.'
        })
      });
    }

    if (connection.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: CUSTOMER_ERRORS.AGENT_OFFLINE
      });
    }

    const agentHealth = connection.agent_id
      ? AgentService.getAgentHealth(connection.agent_id)
      : AgentService.getAgentHealth(`agt_${connection.id}`);

    if (agentHealth && agentHealth.tallyStatus === 'OFFLINE') {
      return res.status(503).json({
        success: false,
        error: CUSTOMER_ERRORS.TALLY_NOT_RUNNING
      });
    }

    // Check permissions
    const rawPerms = connection.permissions || await SaasRepository.getPermissions(connection.id) || {};
    const permittedEntities = [];
    if (rawPerms.allow_customers !== false && rawPerms.customers !== false) permittedEntities.push('customers');
    if (rawPerms.allow_vendors !== false && rawPerms.vendors !== false) permittedEntities.push('vendors');
    if (rawPerms.allow_sales !== false && rawPerms.sales !== false) permittedEntities.push('sales');
    if (rawPerms.allow_inventory || rawPerms.inventory) permittedEntities.push('inventory');
    if (rawPerms.allow_ledgers !== false && rawPerms.ledgers !== false) permittedEntities.push('ledgers');
    if (rawPerms.allow_orders || rawPerms.orders) permittedEntities.push('orders');
    if (rawPerms.allow_delivery_notes || rawPerms.delivery_notes) permittedEntities.push('delivery_notes');
    if (rawPerms.allow_receipt_notes || rawPerms.receipt_notes) permittedEntities.push('receipt_notes');
    if (rawPerms.allow_trial_balance || rawPerms.trial_balance) permittedEntities.push('trial_balance');

    if (permittedEntities.length === 0) {
      return res.status(403).json({
        success: false,
        error: CUSTOMER_ERRORS.INVALID_PERMISSION
      });
    }

    // Create pending sync jobs for permitted entities
    const createdJobs = [];
    for (const entity of permittedEntities) {
      const job = await SaasRepository.createSyncJob(connection.id, entity);
      createdJobs.push(job);
    }

    return res.json({
      success: true,
      message: 'Immediate sync triggered',
      connection_id: connection.id,
      jobs: createdJobs,
      entities: permittedEntities
    });
  } catch (err) {
    console.error('[Trigger Sync Error]:', err);
    return res.status(500).json({
      success: false,
      error: formatCustomerError('SYNC_FAILED', { message: err.message })
    });
  }
});

/**
 * GET /api/connect/:connectionId/sync-history
 * Returns sync execution history, total records synced, and errors
 */
router.get('/:connectionId/sync-history', async (req, res) => {
  const { connectionId } = req.params;

  try {
    const historyData = await SaasRepository.getConnectionSyncHistory(connectionId);
    if (!historyData) {
      return res.status(404).json({
        success: false,
        error: formatCustomerError('NETWORK_ERROR', { message: `Connection "${connectionId}" not found.` })
      });
    }

    return res.json({
      success: true,
      connection_id: historyData.connection_id,
      last_sync: historyData.last_sync,
      lastSync: historyData.last_sync,
      status: historyData.status,
      records_synced: historyData.records_synced,
      recordsSynced: historyData.records_synced,
      errors: historyData.errors,
      history: historyData.history
    });
  } catch (err) {
    console.error('[Sync History Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
