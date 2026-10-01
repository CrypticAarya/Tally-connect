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
      if (permissions && permissions.sales === false) {
        return res.status(403).json({
          success: false,
          error: 'Permission denied.'
        });
      }
    }

    // Load from MySQL entity_cache or in-memory cache
    let data = null;
    const dbCache = await SaasRepository.getEntityCache(connectionId, 'sales');
    if (dbCache && Array.isArray(dbCache.data) && dbCache.data.length > 0) {
      data = dbCache.data;
    } else {
      const memCache = SyncService.getCachedEntity(connectionId, 'SALES');
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

    // Format to required sales schema
    const formatted = data.map(s => {
      const items = (s.items || s.inventoryEntries || []).map(item => ({
        itemName: item.itemName || item.stockItemName || item.itemDescription || '',
        quantity: item.quantity != null ? item.quantity : (item.qty != null ? item.qty : 0),
        rate: item.rate != null ? item.rate : 0,
        amount: item.amount != null ? item.amount : 0
      }));

      return {
        invoice: String(s.invoice || s.voucherNumber || s.id || ''),
        customer: String(s.customer || s.partyName || ''),
        amount: String(s.amount != null ? s.amount : (s.totalAmount != null ? s.totalAmount : '0')),
        items
      };
    });

    return res.json({
      success: true,
      data: formatted
    });
  } catch (err) {
    console.error('[GET /api/v1/sales Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
