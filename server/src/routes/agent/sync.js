import express from 'express';
import { SaasRepository } from '../../db/saasRepository.js';
import { SyncService } from '../../services/syncService.js';
import { JsonTransformer } from '../../engine/jsonTransformer.js';
import { WebhookService } from '../../services/webhookService.js';
import { pool } from '../../db/mysql.js';
import { authenticateAgent } from '../../middleware/agentAuth.js';

const router = express.Router();

/**
 * Normalizes entity name to canonical lowercase string
 */
function normalizeEntity(entity) {
  if (!entity) return '';
  const s = String(entity).toLowerCase().replace(/[^a-z0-9_]/g, '_');
  if (s === 'customer') return 'customers';
  if (s === 'vendor') return 'vendors';
  if (s === 'sales_register') return 'sales';
  if (s === 'stock_items' || s === 'stock') return 'inventory';
  if (s === 'chart_of_accounts') return 'ledgers';
  if (s === 'order' || s === 'sales_orders' || s === 'sales_order' || s === 'purchase_orders' || s === 'purchase_order') return 'orders';
  if (s === 'delivery_note') return 'delivery_notes';
  if (s === 'receipt_note') return 'receipt_notes';
  if (s === 'trialbalance') return 'trial_balance';
  return s;
}

/**
 * Checks if a specific entity is allowed by the permissions object
 */
function isEntityAllowed(permissions, entity) {
  if (!permissions) return true;
  const canonical = normalizeEntity(entity);
  switch (canonical) {
    case 'customers':
      return permissions.customers !== false && permissions.allow_customers !== false;
    case 'vendors':
      return permissions.vendors !== false && permissions.allow_vendors !== false;
    case 'sales':
      return permissions.sales !== false && permissions.allow_sales !== false;
    case 'inventory':
    case 'stock_groups':
    case 'stockgroups':
    case 'units':
    case 'godowns':
      return Boolean(permissions.inventory || permissions.allow_inventory);
    case 'ledgers':
    case 'groups':
    case 'cost_centres':
    case 'costcentres':
      return permissions.ledgers !== false && permissions.allow_ledgers !== false;
    case 'orders':
      return Boolean(permissions.orders || permissions.allow_orders);
    case 'delivery_notes':
      return Boolean(permissions.delivery_notes || permissions.allow_delivery_notes);
    case 'receipt_notes':
      return Boolean(permissions.receipt_notes || permissions.allow_receipt_notes);
    case 'trial_balance':
      return Boolean(permissions.trial_balance || permissions.allow_trial_balance);
    default:
      return true;
  }
}

/**
 * POST /api/agent/sync/start
 * Authenticated agent initiates a synchronization cycle
 */
router.post('/start', authenticateAgent, async (req, res) => {
  try {
    const connectionId = req.connectionId;

    const permissions = await SaasRepository.getPermissions(connectionId) || {
      customers: true,
      sales: true,
      inventory: false,
      ledgers: true,
      trial_balance: false
    };

    const requestedEntity = req.body?.entity_type || req.body?.entityType;

    // If specific entity requested
    if (requestedEntity) {
      const canonical = normalizeEntity(requestedEntity);
      if (!isEntityAllowed(permissions, canonical)) {
        return res.status(403).json({
          success: false,
          error: 'Permission denied.',
          entity: canonical,
          allowed: false
        });
      }

      const job = await SaasRepository.createSyncJob({
        connectionId,
        entityType: canonical
      });

      return res.json({
        success: true,
        connection_id: connectionId,
        permissions,
        jobs: [job]
      });
    }

    // General sync cycle: create jobs for all permitted entities
    const allEntities = ['customers', 'vendors', 'sales', 'inventory', 'ledgers', 'orders', 'delivery_notes', 'receipt_notes', 'trial_balance'];
    const jobs = [];

    for (const entity of allEntities) {
      if (isEntityAllowed(permissions, entity)) {
        const job = await SaasRepository.createSyncJob({
          connectionId,
          entityType: entity
        });
        jobs.push(job);
      }
    }

    return res.json({
      success: true,
      connection_id: connectionId,
      permissions,
      jobs
    });
  } catch (err) {
    console.error('[Agent Sync Start Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/agent/sync/upload
 * Authenticated agent uploads extracted and transformed JSON entity payloads
 */
router.post('/upload', authenticateAgent, async (req, res) => {
  try {
    const connectionId = req.connectionId;
    const {
      job_id,
      jobId,
      entity_type,
      entityType,
      data,
      payload
    } = req.body || {};

    const effectiveEntity = normalizeEntity(entity_type || entityType || req.body?.entity);
    const effectiveJobId = job_id || jobId;
    const rawData = data || payload || req.body?.records || [];

    if (!effectiveEntity) {
      return res.status(400).json({ error: 'Missing entity_type' });
    }

    // Verify job belongs to this connection if job_id was specified
    if (effectiveJobId) {
      const [jobRows] = await pool.query(
        `SELECT id, connection_id FROM sync_jobs WHERE id = ? LIMIT 1`,
        [effectiveJobId]
      );
      if (jobRows.length > 0 && jobRows[0].connection_id !== connectionId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'JOB_CONNECTION_MISMATCH',
            message: 'Cross-connection access denied: Sync job does not belong to authenticated agent connection.'
          }
        });
      }
    }

    // Check permissions
    const permissions = await SaasRepository.getPermissions(connectionId);
    if (!isEntityAllowed(permissions, effectiveEntity)) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied.',
        entity: effectiveEntity
      });
    }

    // Standardize data via JSON Transformer
    const transformedData = JsonTransformer.transform(effectiveEntity, rawData);

    // Persist to MySQL entity_cache table
    await SaasRepository.saveEntityCache({
      connectionId,
      entityType: effectiveEntity,
      dataJson: transformedData
    });

    if (effectiveEntity === 'inventory') {
      await SaasRepository.saveEntityCache({
        connectionId,
        entityType: 'stock_items',
        dataJson: transformedData
      });
    }

    const rawInputType = String(entity_type || entityType || '').toLowerCase();
    if (rawInputType.includes('sales_order') || rawInputType.includes('salesorder')) {
      await SaasRepository.saveEntityCache({
        connectionId,
        entityType: 'sales_orders',
        dataJson: transformedData
      });
    } else if (rawInputType.includes('purchase_order') || rawInputType.includes('purchaseorder')) {
      await SaasRepository.saveEntityCache({
        connectionId,
        entityType: 'purchase_orders',
        dataJson: transformedData
      });
    }

    // Also update in-memory SyncService cache
    SyncService.cacheEntity(connectionId, effectiveEntity, transformedData);

    // Complete sync job if jobId provided
    if (effectiveJobId) {
      await SaasRepository.completeSyncJob(effectiveJobId);
    }

    // Trigger sync.completed webhook notification
    try {
      await WebhookService.deliverForConnection(connectionId, WebhookService.EVENTS.SYNC_COMPLETED, {
        entity_type: effectiveEntity,
        count: transformedData.length,
        job_id: effectiveJobId || null
      });
    } catch (whErr) {
      console.warn('[Sync Webhook Warning]:', whErr.message);
    }

    return res.json({
      success: true,
      connection_id: connectionId,
      entity_type: effectiveEntity,
      count: transformedData.length,
      message: 'Entity synced and cached successfully'
    });
  } catch (err) {
    console.error('[Agent Sync Upload Error]:', err);
    if (connectionId) {
      WebhookService.deliverForConnection(connectionId, WebhookService.EVENTS.SYNC_FAILED, {
        entity_type: effectiveEntity,
        error: err.message
      }).catch(() => {});
    }
    return res.status(500).json({ error: err.message });
  }
});

export default router;
