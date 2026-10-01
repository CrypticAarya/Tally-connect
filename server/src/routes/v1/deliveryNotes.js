import express from 'express';
import { SaasRepository } from '../../db/saasRepository.js';
import { SyncService } from '../../services/syncService.js';
import { config } from '../../config.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const connectionId = req.connectionId;

    // Permission enforcement
    if (connectionId && connectionId !== 'conn_default') {
      const permissions = await SaasRepository.getPermissions(connectionId);
      if (permissions && permissions.delivery_notes === false) {
        return res.status(403).json({
          success: false,
          error: 'Permission denied.'
        });
      }
    }

    let data = [];
    const dbCache = await SaasRepository.getEntityCache(connectionId, 'delivery_notes');
    if (dbCache && Array.isArray(dbCache.data) && dbCache.data.length > 0) {
      data = dbCache.data;
    } else {
      const memCache = SyncService.getCachedEntity(connectionId, 'DELIVERY_NOTES');
      if (memCache && Array.isArray(memCache.data)) {
        data = memCache.data;
      } else {
        data = [];
      }
    }

    // In production mode, if real Tally data is unavailable, return TALLY_CONNECTION_REQUIRED
    if (!data || data.length === 0) {
      if (!config.mockMode) {
        return res.status(503).json({
          success: false,
          error: 'TALLY_CONNECTION_REQUIRED',
          message: 'No real Tally data available'
        });
      }
    }

    return res.json({
      success: true,
      data
    });
  } catch (err) {
    console.error('[GET /api/v1/delivery-notes Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
