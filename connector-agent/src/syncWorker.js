import { TallyXmlHttpAdapter } from './adapters/tallyXmlHttpAdapter.js';
import { JsonTransformer } from './engine/jsonTransformer.js';
import { logger } from './logger.js';

export class SyncWorker {
  constructor({ cloudClient, tallyAdapter, config, pollIntervalSeconds = 30 }) {
    this.cloudClient = cloudClient;
    this.config = config;
    this.pollIntervalSeconds = pollIntervalSeconds;
    this.isSyncing = false;
    this.timer = null;

    this.tallyAdapter = tallyAdapter || new TallyXmlHttpAdapter({
      host: config?.tallyHost || '127.0.0.1',
      port: config?.tallyPort || 9000,
      fixtureFallback: false
    });
  }

  /**
   * Fetches inventory/stock items from Tally
   */
  async fetchInventory() {
    if (typeof this.tallyAdapter.fetchStockItems === 'function') {
      return await this.tallyAdapter.fetchStockItems();
    }
    if (typeof this.tallyAdapter.fetchInventory === 'function') {
      return await this.tallyAdapter.fetchInventory();
    }
    throw new Error('Stock items extraction method not available on adapter');
  }

  /**
   * Syncs a single entity type
   */
  async syncEntity(entityType, jobId = null) {
    const canonical = String(entityType).toLowerCase();
    logger.info(`[SyncWorker] Starting sync for entity: ${canonical}...`);

    let rawData = [];
    try {
      switch (canonical) {
        case 'customers':
        case 'customer':
          rawData = await this.tallyAdapter.fetchCustomers();
          break;
        case 'vendors':
        case 'vendor':
        case 'suppliers':
          rawData = await this.tallyAdapter.fetchVendors();
          break;
        case 'sales':
        case 'sales_register':
          rawData = await this.tallyAdapter.fetchSalesRegister();
          break;
        case 'inventory':
        case 'stock_items':
        case 'stockitems':
          rawData = await this.fetchInventory();
          break;
        case 'stock_groups':
        case 'stockgroups':
          rawData = await this.tallyAdapter.fetchStockGroups();
          break;
        case 'units':
          rawData = await this.tallyAdapter.fetchUnits();
          break;
        case 'godowns':
          rawData = await this.tallyAdapter.fetchGodowns();
          break;
        case 'groups':
          rawData = await this.tallyAdapter.fetchGroups();
          break;
        case 'cost_centres':
        case 'costcentres':
          rawData = await this.tallyAdapter.fetchCostCentres();
          break;
        case 'ledgers':
        case 'chart_of_accounts':
          rawData = await (typeof this.tallyAdapter.fetchLedgers === 'function'
            ? this.tallyAdapter.fetchLedgers()
            : this.tallyAdapter.fetchChartOfAccounts());
          break;
        case 'orders':
        case 'sales_orders':
        case 'salesorders': {
          const salesOrders = await this.tallyAdapter.fetchSalesOrders();
          let purchaseOrders = [];
          try {
            purchaseOrders = await this.tallyAdapter.fetchPurchaseOrders();
          } catch (_) {}
          rawData = canonical === 'orders' ? [...salesOrders, ...purchaseOrders] : salesOrders;
          break;
        }
        case 'purchase_orders':
        case 'purchaseorders':
          rawData = await this.tallyAdapter.fetchPurchaseOrders();
          break;
        case 'delivery_notes':
        case 'deliverynotes':
          rawData = await this.tallyAdapter.fetchDeliveryNotes();
          break;
        case 'receipt_notes':
        case 'receiptnotes':
          rawData = await this.tallyAdapter.fetchReceiptNotes();
          break;
        case 'trial_balance':
        case 'trialbalance':
          rawData = await this.tallyAdapter.fetchTrialBalance();
          break;
        default:
          logger.warn(`[SyncWorker] Unknown entity type: ${canonical}`);
          return { success: false, error: `Unknown entity type: ${canonical}` };
      }
    } catch (err) {
      const isTallyDown = err.code === 'TALLY_NOT_RUNNING' ||
                          err.message?.includes('TALLY_NOT_RUNNING') ||
                          err.message?.includes('ECONNREFUSED') ||
                          err.message?.includes('fetch failed');
      const errorCode = isTallyDown ? 'TALLY_NOT_RUNNING' : 'SYNC_FAILED';
      logger.error(`[SyncWorker] Extraction failed for ${canonical} [${errorCode}]: ${err.message}`);
      return {
        success: false,
        error: errorCode,
        message: err.message,
        entity: canonical
      };
    }

    logger.info(`[SyncWorker] Extracted ${rawData.length} raw records for ${canonical} from Tally.`);

    // Transform into clean JSON entities
    const transformed = JsonTransformer.transform(canonical, rawData);
    logger.info(`[SyncWorker] Transformed ${transformed.length} JSON records for ${canonical}.`);

    // Upload to Cloud Sync API
    const uploadRes = await this.cloudClient.uploadSyncPayload({
      connectionId: this.config.connectionId,
      jobId,
      entityType: canonical,
      data: transformed,
      rowCount: transformed.length
    });

    if (uploadRes.success || uploadRes.ok) {
      logger.info(`[SyncWorker] ✔ Successfully uploaded ${transformed.length} ${canonical} records to Cloud.`);
      return { success: true, count: transformed.length, entity: canonical };
    } else {
      logger.warn(`[SyncWorker] ✖ Upload rejected for ${canonical}: ${uploadRes.error}`);
      return { success: false, error: uploadRes.error, entity: canonical };
    }
  }

  /**
   * Polls Cloud for pending sync jobs, reads permissions, and executes allowed entity extractions
   */
  async pollAndSync() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      // 1. Contact cloud to initiate sync and get permitted jobs
      const syncInit = await this.cloudClient.startSync({
        connectionId: this.config.connectionId,
        agentId: this.config.agentId
      });

      if (!syncInit || !syncInit.jobs || syncInit.jobs.length === 0) {
        this.isSyncing = false;
        return { success: true, synced: 0, message: 'No pending sync jobs' };
      }

      logger.info(`[SyncWorker] Received ${syncInit.jobs.length} permitted sync job(s) from Cloud.`);

      const results = [];
      for (const job of syncInit.jobs) {
        const res = await this.syncEntity(job.entity_type, job.id);
        results.push(res);
      }

      this.isSyncing = false;
      return { success: true, results };
    } catch (err) {
      this.isSyncing = false;
      logger.error('[SyncWorker] Sync cycle failure:', err.message);
      return { success: false, error: err.message };
    }
  }

  start() {
    if (this.timer) return;
    this.pollAndSync().catch(err => logger.error('[SyncWorker] Initial sync error:', err.message));

    this.timer = setInterval(() => {
      this.pollAndSync().catch(err => logger.error('[SyncWorker] Recurring sync error:', err.message));
    }, this.pollIntervalSeconds * 1000);

    if (this.timer.unref) this.timer.unref();
    logger.info(`[SyncWorker] Agent Sync Worker active (polling every ${this.pollIntervalSeconds}s).`);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
