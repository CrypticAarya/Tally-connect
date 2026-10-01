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
      if (permissions && permissions.orders === false) {
        return res.status(403).json({
          success: false,
          error: 'Permission denied.'
        });
      }
    }

    const baseUrl = req.baseUrl || req.originalUrl || '';
    const isSalesEndpoint = baseUrl.includes('sales-order') || baseUrl.includes('sales_order');
    const isPurchaseEndpoint = baseUrl.includes('purchase-order') || baseUrl.includes('purchase_order');
    const type = req.query.type
      ? String(req.query.type).toLowerCase()
      : (isSalesEndpoint ? 'sales' : (isPurchaseEndpoint ? 'purchase' : null));

    let data = [];
    if (type === 'sales') {
      const soCache = await SaasRepository.getEntityCache(connectionId, 'sales_orders');
      if (soCache && Array.isArray(soCache.data) && soCache.data.length > 0) {
        data = soCache.data;
      }
    } else if (type === 'purchase') {
      const poCache = await SaasRepository.getEntityCache(connectionId, 'purchase_orders');
      if (poCache && Array.isArray(poCache.data) && poCache.data.length > 0) {
        data = poCache.data;
      }
    }

    if (data.length === 0) {
      const dbCache = await SaasRepository.getEntityCache(connectionId, 'orders');
      if (dbCache && Array.isArray(dbCache.data) && dbCache.data.length > 0) {
        data = dbCache.data;
      } else {
        const memCache = SyncService.getCachedEntity(connectionId, 'ORDERS');
        if (memCache && Array.isArray(memCache.data)) {
          data = memCache.data;
        } else {
          data = [];
        }
      }

      if (type === 'sales') {
        data = data.filter(o => o.voucherType?.toLowerCase().includes('sales') || o.orderType === 'SALES_ORDER');
      } else if (type === 'purchase') {
        data = data.filter(o => o.voucherType?.toLowerCase().includes('purchase') || o.orderType === 'PURCHASE_ORDER');
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
    console.error('[GET /api/v1/orders Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/orders/sales
 */
router.get('/sales', async (req, res) => {
  req.query.type = 'sales';
  return router.handle(req, res);
});

/**
 * GET /api/v1/orders/purchase
 */
router.get('/purchase', async (req, res) => {
  req.query.type = 'purchase';
  return router.handle(req, res);
});

export default router;
