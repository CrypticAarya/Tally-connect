import express from 'express';
import { SaasRepository } from '../../db/saasRepository.js';
import { SyncService } from '../../services/syncService.js';
import { config } from '../../config.js';

const router = express.Router();

async function getCachedEntityData(connectionId, entityName) {
  const dbCache = await SaasRepository.getEntityCache(connectionId, entityName);
  if (dbCache && Array.isArray(dbCache.data) && dbCache.data.length > 0) {
    return dbCache.data;
  }
  const memCache = SyncService.getCachedEntity(connectionId, entityName.toUpperCase());
  return memCache && Array.isArray(memCache.data) ? memCache.data : [];
}

function sendEntityResponse(res, data) {
  if (!data || data.length === 0) {
    if (!config.mockMode) {
      return res.status(503).json({
        success: false,
        error: 'TALLY_CONNECTION_REQUIRED',
        message: 'No real Tally data available'
      });
    }
  }
  return res.json({ success: true, data: data || [] });
}

/**
 * GET /api/v1/groups
 */
router.get('/groups', async (req, res) => {
  try {
    const connectionId = req.connectionId;
    if (connectionId && connectionId !== 'conn_default') {
      const permissions = await SaasRepository.getPermissions(connectionId);
      if (permissions && permissions.ledgers === false) {
        return res.status(403).json({ success: false, error: 'Permission denied.' });
      }
    }
    const data = await getCachedEntityData(connectionId, 'groups');
    return sendEntityResponse(res, data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/cost-centers and /api/v1/cost-centres
 */
router.get(['/cost-centres', '/cost-centers', '/cost_centers'], async (req, res) => {
  try {
    const connectionId = req.connectionId;
    if (connectionId && connectionId !== 'conn_default') {
      const permissions = await SaasRepository.getPermissions(connectionId);
      if (permissions && permissions.ledgers === false) {
        return res.status(403).json({ success: false, error: 'Permission denied.' });
      }
    }
    const data = await getCachedEntityData(connectionId, 'cost_centres');
    return sendEntityResponse(res, data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/stock-groups
 */
router.get('/stock-groups', async (req, res) => {
  try {
    const connectionId = req.connectionId;
    if (connectionId && connectionId !== 'conn_default') {
      const permissions = await SaasRepository.getPermissions(connectionId);
      if (permissions && permissions.inventory === false) {
        return res.status(403).json({ success: false, error: 'Permission denied.' });
      }
    }
    const data = await getCachedEntityData(connectionId, 'stock_groups');
    return sendEntityResponse(res, data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/units
 */
router.get('/units', async (req, res) => {
  try {
    const connectionId = req.connectionId;
    if (connectionId && connectionId !== 'conn_default') {
      const permissions = await SaasRepository.getPermissions(connectionId);
      if (permissions && permissions.inventory === false) {
        return res.status(403).json({ success: false, error: 'Permission denied.' });
      }
    }
    const data = await getCachedEntityData(connectionId, 'units');
    return sendEntityResponse(res, data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/godowns
 */
router.get('/godowns', async (req, res) => {
  try {
    const connectionId = req.connectionId;
    if (connectionId && connectionId !== 'conn_default') {
      const permissions = await SaasRepository.getPermissions(connectionId);
      if (permissions && permissions.inventory === false) {
        return res.status(403).json({ success: false, error: 'Permission denied.' });
      }
    }
    const data = await getCachedEntityData(connectionId, 'godowns');
    return sendEntityResponse(res, data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
