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
      if (permissions && permissions.vendors === false) {
        return res.status(403).json({
          success: false,
          error: 'Permission denied.'
        });
      }
    }

    let data = [];
    const dbCache = await SaasRepository.getEntityCache(connectionId, 'vendors');
    if (dbCache && Array.isArray(dbCache.data) && dbCache.data.length > 0) {
      data = dbCache.data;
    } else {
      const memCache = SyncService.getCachedEntity(connectionId, 'VENDORS');
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

    const formatted = data.map(v => {
      let addr = '';
      if (typeof v.address === 'string') {
        addr = v.address;
      } else if (v.address && typeof v.address === 'object') {
        addr = [v.address.street, v.address.city, v.address.state, v.address.pincode].filter(Boolean).join(', ');
      } else if (Array.isArray(v.mailingDetails?.addressLines)) {
        addr = v.mailingDetails.addressLines.filter(Boolean).join(', ');
      }

      return {
        id: v.id || v.guid || '',
        name: v.name || '',
        gstin: v.gstin || '',
        address: addr,
        phone: v.phone || v.mobile || '',
        email: v.email || '',
        state: v.state || '',
        country: v.country || 'India',
        closingBalance: v.closingBalance != null ? v.closingBalance : 0
      };
    });

    return res.json({
      success: true,
      data: formatted
    });
  } catch (err) {
    console.error('[GET /api/v1/vendors Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
