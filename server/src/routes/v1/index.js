import express from 'express';
import { authenticateSaasApp } from '../../middleware/saasAuth.js';
import { enforceTenantConnection } from '../../middleware/tenantIsolation.js';
import customersRouter from './customers.js';
import vendorsRouter from './vendors.js';
import salesRouter from './sales.js';
import inventoryRouter from './inventory.js';
import ledgersRouter from './ledgers.js';
import trialBalanceRouter from './trialBalance.js';
import ordersRouter from './orders.js';
import deliveryNotesRouter from './deliveryNotes.js';
import receiptNotesRouter from './receiptNotes.js';
import masterDataRouter from './masterData.js';
import syncRouter from './sync.js';

const router = express.Router();

// Enforce SaaS API key authentication on all /v1 endpoints
router.use(authenticateSaasApp);

// Enforce strict multi-tenant customer connection isolation on all /v1 endpoints
router.use(enforceTenantConnection);

router.use('/customers', customersRouter);
router.use('/vendors', vendorsRouter);
router.use('/sales', salesRouter);
router.use('/inventory', inventoryRouter);
router.use('/stock-items', inventoryRouter);
router.use('/stock_items', inventoryRouter);
router.use('/ledgers', ledgersRouter);
router.use('/trial-balance', trialBalanceRouter);
router.use('/trial_balance', trialBalanceRouter);
router.use('/orders', ordersRouter);
router.use('/sales-orders', ordersRouter);
router.use('/sales_orders', ordersRouter);
router.use('/purchase-orders', ordersRouter);
router.use('/purchase_orders', ordersRouter);
router.use('/delivery-notes', deliveryNotesRouter);
router.use('/delivery_notes', deliveryNotesRouter);
router.use('/receipt-notes', receiptNotesRouter);
router.use('/receipt_notes', receiptNotesRouter);
router.use('/', masterDataRouter);
router.use('/sync', syncRouter);

export default router;
