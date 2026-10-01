import express from 'express';
import { SaasRepository } from '../../db/saasRepository.js';
import { SyncService } from '../../services/syncService.js';
import { JsonTransformer } from '../../engine/jsonTransformer.js';
import { config } from '../../config.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const connectionId = req.connectionId;

    // Permission enforcement
    if (connectionId && connectionId !== 'conn_default') {
      const permissions = await SaasRepository.getPermissions(connectionId);
      if (permissions && permissions.customers === false) {
        return res.status(403).json({
          success: false,
          error: 'Permission denied.'
        });
      }
    }

    // Load from MySQL entity_cache or in-memory cache
    let data = null;
    const dbCache = await SaasRepository.getEntityCache(connectionId, 'customers');
    if (dbCache && Array.isArray(dbCache.data) && dbCache.data.length > 0) {
      data = dbCache.data;
    } else {
      const memCache = SyncService.getCachedEntity(connectionId, 'CUSTOMERS');
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

    // Format to required customer schema
    const formatted = data.map(c => {
      let addr = '';
      if (typeof c.address === 'string') {
        addr = c.address;
      } else if (c.address && typeof c.address === 'object') {
        addr = [c.address.street, c.address.city, c.address.state, c.address.pincode].filter(Boolean).join(', ');
      } else if (Array.isArray(c.mailingDetails?.addressLines)) {
        addr = c.mailingDetails.addressLines.filter(Boolean).join(', ');
      }

      return {
        id: String(c.id || c.code || ''),
        name: String(c.name || ''),
        gstin: String(c.gstin || ''),
        address: String(addr || '')
      };
    });

    return res.json({
      success: true,
      data: formatted
    });
  } catch (err) {
    console.error('[GET /api/v1/customers Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
