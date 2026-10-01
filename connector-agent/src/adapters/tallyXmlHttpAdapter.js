import fs from 'fs';
import path from 'path';
import { TallyAdapter } from './tallyAdapter.js';
import { TdlBuilder } from './tdlBuilder.js';
import { TallyXmlParser } from './xmlParser.js';
import { getDefaultDebugDirectory } from '../storage/localExportStorage.js';

export class TallyXmlHttpAdapter extends TallyAdapter {
  /**
   * @param {Object} [options={}]
   * @param {string} [options.host] - Tally host (defaults to 127.0.0.1)
   * @param {number} [options.port] - Tally HTTP port (defaults to 9000)
   * @param {number} [options.timeoutMs] - Request timeout (default: 6000ms)
   * @param {string} [options.debugDir] - Directory to persist raw XML requests/responses
   */
  constructor(options = {}) {
    super();
    this.host = options.host || '127.0.0.1';
    this.port = options.port || 9000;
    this.timeoutMs = options.timeoutMs ?? 6000;
    this.debugDir = options.debugDir || getDefaultDebugDirectory();

    this.parser = new TallyXmlParser();
    this.baseUrl = `http://${this.host}:${this.port}`;
    this.fixtureFallback = false;
  }

  /**
   * Saves raw XML payload to debug directory for developer inspection
   */
  _saveDebugXml(filename, content) {
    try {
      if (!fs.existsSync(this.debugDir)) {
        fs.mkdirSync(this.debugDir, { recursive: true });
      }
      fs.writeFileSync(path.join(this.debugDir, filename), content, 'utf-8');
    } catch (_) {
      try {
        const fallback = path.resolve(process.cwd(), 'debug', 'raw_xml');
        if (!fs.existsSync(fallback)) {
          fs.mkdirSync(fallback, { recursive: true });
        }
        fs.writeFileSync(path.join(fallback, filename), content, 'utf-8');
      } catch (__) {
        // Non-blocking debug capture
      }
    }
  }

  /**
   * Core HTTP POST dispatcher to TallyPrime port 9000
   * @param {string} xmlPayload - TDL envelope
   * @param {string} [entityTag='request'] - Identifying tag for debug logs
   * @returns {Promise<string>} Raw XML response text
   */
  async _sendTallyPost(xmlPayload, entityTag = 'request') {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    this._saveDebugXml(`raw_request_${entityTag}_${timestamp}.xml`, xmlPayload);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml;charset=utf-8',
          'Accept': 'text/xml'
        },
        body: xmlPayload,
        signal: AbortSignal.timeout(this.timeoutMs)
      });

      if (!response.ok) {
        throw new Error(`TallyPrime returned HTTP error: ${response.status} ${response.statusText}`);
      }

      const rawResponse = await response.text();
      this._saveDebugXml(`raw_response_${entityTag}_${timestamp}.xml`, rawResponse);
      return rawResponse;
    } catch (err) {
      const isConnectionIssue =
        err.name === 'AbortError' ||
        err.name === 'TimeoutError' ||
        err.message?.includes('fetch failed') ||
        err.message?.includes('ECONNREFUSED') ||
        err.message?.includes('ETIMEDOUT');

      if (isConnectionIssue) {
        const helpfulMessage =
          `TALLY_NOT_RUNNING: Unable to connect to TallyPrime at ${this.baseUrl}. ` +
          `Please verify that:\n` +
          `1. TallyPrime is open and running on this machine.\n` +
          `2. The TallyPrime HTTP Server is enabled:\n` +
          `   - Press F1 (Help) in TallyPrime -> Settings -> Connectivity\n` +
          `   - Set "TallyPrime act as" to "Both" or "Server"\n` +
          `   - Ensure port is set to ${this.port}.`;

        const connectionError = new Error(helpfulMessage);
        connectionError.code = 'TALLY_NOT_RUNNING';
        connectionError.statusCode = 503;
        connectionError.originalError = err;
        throw connectionError;
      }

      throw err;
    }
  }

  /**
   * Tests connection to the real TallyPrime instance
   */
  async testConnection() {
    const startTime = Date.now();
    const xmlRequest = TdlBuilder.buildCompanyRequest();

    try {
      const xmlResponse = await this._sendTallyPost(xmlRequest, 'probe_company');
      const latencyMs = Date.now() - startTime;
      const companyInfo = this.parser.normalizeCompany(xmlResponse);

      return {
        available: true,
        tallyRunning: true,
        latencyMs,
        companyName: companyInfo.name,
        version: companyInfo.tallyVersion,
        port: this.port,
        financialYear: `${companyInfo.financialYearFrom} to ${companyInfo.financialYearTo}`,
        message: `Connected to TallyPrime at ${this.baseUrl} ("${companyInfo.name}")`
      };
    } catch (err) {
      const isConnectionIssue = err.code === 'TALLY_NOT_RUNNING' || err.message?.includes('TALLY_NOT_RUNNING');
      return {
        available: false,
        tallyRunning: !isConnectionIssue,
        latencyMs: Date.now() - startTime,
        companyName: null,
        version: null,
        port: this.port,
        errorCode: err.code || 'CONNECTION_FAILED',
        message: err.message
      };
    }
  }

  /**
   * Fetches active company info
   */
  async fetchCompany() {
    const xmlRequest = TdlBuilder.buildCompanyRequest();
    const xmlResponse = await this._sendTallyPost(xmlRequest, 'company');
    return this.parser.normalizeCompany(xmlResponse);
  }

  /**
   * Fetches Customer Master ledgers from TallyPrime
   */
  async fetchCustomers(options = {}) {
    const xmlRequest = TdlBuilder.buildCustomerRequest();
    const xmlResponse = await this._sendTallyPost(xmlRequest, 'customers');
    return this.parser.normalizeCustomers(xmlResponse);
  }

  /**
   * Fetches Vendor Master ledgers from TallyPrime
   */
  async fetchVendors(options = {}) {
    const xmlRequest = TdlBuilder.buildVendorRequest();
    const xmlResponse = await this._sendTallyPost(xmlRequest, 'vendors');
    return this.parser.normalizeVendors(xmlResponse);
  }

  /**
   * Fetches all Groups
   */
  async fetchGroups(options = {}) {
    const xmlRequest = TdlBuilder.buildGroupRequest();
    const xmlResponse = await this._sendTallyPost(xmlRequest, 'groups');
    return this.parser.normalizeGroups(xmlResponse);
  }

  /**
   * Fetches all Ledgers
   */
  async fetchLedgers(options = {}) {
    const xmlRequest = TdlBuilder.buildLedgerRequest();
    const xmlResponse = await this._sendTallyPost(xmlRequest, 'ledgers');
    return this.parser.normalizeLedgers(xmlResponse);
  }

  /**
   * Fetches Chart of Accounts
   */
  async fetchChartOfAccounts(options = {}) {
    return this.fetchLedgers(options);
  }

  /**
   * Fetches Cost Centres
   */
  async fetchCostCentres(options = {}) {
    const xmlRequest = TdlBuilder.buildCostCentreRequest();
    const xmlResponse = await this._sendTallyPost(xmlRequest, 'cost_centres');
    return this.parser.normalizeCostCentres(xmlResponse);
  }

  /**
   * Fetches Stock Items (Inventory)
   */
  async fetchStockItems(options = {}) {
    const xmlRequest = TdlBuilder.buildStockItemRequest();
    const xmlResponse = await this._sendTallyPost(xmlRequest, 'stock_items');
    return this.parser.normalizeStockItems(xmlResponse);
  }

  /**
   * Alias for fetchStockItems
   */
  async fetchInventory(options = {}) {
    return this.fetchStockItems(options);
  }

  /**
   * Fetches Stock Groups
   */
  async fetchStockGroups(options = {}) {
    const xmlRequest = TdlBuilder.buildStockGroupRequest();
    const xmlResponse = await this._sendTallyPost(xmlRequest, 'stock_groups');
    return this.parser.normalizeStockGroups(xmlResponse);
  }

  /**
   * Fetches Units of Measurement
   */
  async fetchUnits(options = {}) {
    const xmlRequest = TdlBuilder.buildUnitRequest();
    const xmlResponse = await this._sendTallyPost(xmlRequest, 'units');
    return this.parser.normalizeUnits(xmlResponse);
  }

  /**
   * Fetches Godowns (Locations)
   */
  async fetchGodowns(options = {}) {
    const xmlRequest = TdlBuilder.buildGodownRequest();
    const xmlResponse = await this._sendTallyPost(xmlRequest, 'godowns');
    return this.parser.normalizeGodowns(xmlResponse);
  }

  /**
   * Fetches Sales Orders
   */
  async fetchSalesOrders(options = {}) {
    const xmlRequest = TdlBuilder.buildSalesOrderRequest(options);
    const xmlResponse = await this._sendTallyPost(xmlRequest, 'sales_orders');
    return this.parser.normalizeSalesOrders(xmlResponse);
  }

  /**
   * Fetches Purchase Orders
   */
  async fetchPurchaseOrders(options = {}) {
    const xmlRequest = TdlBuilder.buildPurchaseOrderRequest(options);
    const xmlResponse = await this._sendTallyPost(xmlRequest, 'purchase_orders');
    return this.parser.normalizePurchaseOrders(xmlResponse);
  }

  /**
   * Fetches Delivery Notes
   */
  async fetchDeliveryNotes(options = {}) {
    const xmlRequest = TdlBuilder.buildDeliveryNoteRequest(options);
    const xmlResponse = await this._sendTallyPost(xmlRequest, 'delivery_notes');
    return this.parser.normalizeDeliveryNotes(xmlResponse);
  }

  /**
   * Fetches Receipt Notes
   */
  async fetchReceiptNotes(options = {}) {
    const xmlRequest = TdlBuilder.buildReceiptNoteRequest(options);
    const xmlResponse = await this._sendTallyPost(xmlRequest, 'receipt_notes');
    return this.parser.normalizeReceiptNotes(xmlResponse);
  }

  /**
   * Fetches Sales Register vouchers
   */
  async fetchSalesRegister(options = {}) {
    const xmlRequest = TdlBuilder.buildSalesRegisterRequest(options);
    const xmlResponse = await this._sendTallyPost(xmlRequest, 'sales_register');
    return this.parser.normalizeSalesVouchers(xmlResponse);
  }

  /**
   * Fetches Trial Balance (Official Report Request TYPE=Data, ID=TrialBalance)
   * Evaluates report formulas and falls back to collection if needed
   */
  async fetchTrialBalance(options = {}) {
    const xmlRequest = TdlBuilder.buildTrialBalanceRequest(options);
    const xmlResponse = await this._sendTallyPost(xmlRequest, 'trial_balance');
    let results = this.parser.normalizeTrialBalance(xmlResponse, options);

    if (!results || results.length === 0) {
      try {
        const fallbackRequest = TdlBuilder.buildTrialBalanceCollectionRequest(options);
        const fallbackResponse = await this._sendTallyPost(fallbackRequest, 'trial_balance_collection');
        const fallbackResults = this.parser.normalizeTrialBalance(fallbackResponse, options);
        if (fallbackResults && fallbackResults.length > 0) {
          results = fallbackResults;
        }
      } catch (_) {
        // Return results from primary request
      }
    }

    return results;
  }

  /**
   * Returns metadata about this adapter
   */
  getAdapterInfo() {
    return {
      name: 'TallyXmlHttpAdapter',
      type: 'xml_http',
      version: '1.0.0-beta',
      target: this.baseUrl,
      description: 'Production TallyPrime XML/TDL connector communicating over HTTP port 9000'
    };
  }
}
