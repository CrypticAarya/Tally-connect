import { TallyAdapter } from './tallyAdapter.js';
import { TdlBuilder } from './tdlBuilder.js';
import { TallyXmlParser } from './xmlParser.js';

export class TallyXmlHttpAdapter extends TallyAdapter {
  /**
   * @param {Object} [options={}]
   * @param {string} [options.host] - Tally host (defaults to 127.0.0.1)
   * @param {number} [options.port] - Tally HTTP port (defaults to 9000)
   * @param {number} [options.timeoutMs] - Request timeout (default: 6000ms)
   */
  constructor(options = {}) {
    super();
    this.host = options.host || '127.0.0.1';
    this.port = options.port || 9000;
    this.timeoutMs = options.timeoutMs ?? 6000;

    this.parser = new TallyXmlParser();
    this.baseUrl = `http://${this.host}:${this.port}`;
    this.fixtureFallback = false;
  }

  /**
   * Core HTTP POST dispatcher to TallyPrime port 9000
   * @param {string} xmlPayload - TDL envelope
   * @returns {Promise<string>} Raw XML response text
   */
  async _sendTallyPost(xmlPayload) {
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

      return await response.text();
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
      const xmlResponse = await this._sendTallyPost(xmlRequest);
      const latencyMs = Date.now() - startTime;
      const companyInfo = this.parser.normalizeCompany(xmlResponse);

      return {
        available: true,
        latencyMs,
        companyName: companyInfo.name,
        version: companyInfo.tallyVersion,
        port: this.port,
        financialYear: `${companyInfo.financialYearFrom} to ${companyInfo.financialYearTo}`,
        message: `Connected to TallyPrime at ${this.baseUrl} ("${companyInfo.name}")`
      };
    } catch (err) {
      return {
        available: false,
        latencyMs: Date.now() - startTime,
        companyName: null,
        version: null,
        port: this.port,
        message: err.message
      };
    }
  }

  /**
   * Fetches active company info
   */
  async fetchCompany() {
    const xmlRequest = TdlBuilder.buildCompanyRequest();
    const xmlResponse = await this._sendTallyPost(xmlRequest);
    return this.parser.normalizeCompany(xmlResponse);
  }

  /**
   * Fetches Customer Master ledgers from TallyPrime
   */
  async fetchCustomers(options = {}) {
    const xmlRequest = TdlBuilder.buildCustomerRequest();
    const xmlResponse = await this._sendTallyPost(xmlRequest);
    return this.parser.normalizeCustomers(xmlResponse);
  }

  /**
   * Fetches Vendor Master ledgers from TallyPrime
   */
  async fetchVendors(options = {}) {
    const xmlRequest = TdlBuilder.buildVendorRequest();
    const xmlResponse = await this._sendTallyPost(xmlRequest);
    return this.parser.normalizeVendors(xmlResponse);
  }

  /**
   * Fetches all Groups
   */
  async fetchGroups(options = {}) {
    const xmlRequest = TdlBuilder.buildGroupRequest();
    const xmlResponse = await this._sendTallyPost(xmlRequest);
    return this.parser.normalizeGroups(xmlResponse);
  }

  /**
   * Fetches all Ledgers
   */
  async fetchLedgers(options = {}) {
    const xmlRequest = TdlBuilder.buildLedgerRequest();
    const xmlResponse = await this._sendTallyPost(xmlRequest);
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
    const xmlResponse = await this._sendTallyPost(xmlRequest);
    return this.parser.normalizeCostCentres(xmlResponse);
  }

  /**
   * Fetches Stock Items (Inventory)
   */
  async fetchStockItems(options = {}) {
    const xmlRequest = TdlBuilder.buildStockItemRequest();
    const xmlResponse = await this._sendTallyPost(xmlRequest);
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
    const xmlResponse = await this._sendTallyPost(xmlRequest);
    return this.parser.normalizeStockGroups(xmlResponse);
  }

  /**
   * Fetches Units of Measurement
   */
  async fetchUnits(options = {}) {
    const xmlRequest = TdlBuilder.buildUnitRequest();
    const xmlResponse = await this._sendTallyPost(xmlRequest);
    return this.parser.normalizeUnits(xmlResponse);
  }

  /**
   * Fetches Godowns (Locations)
   */
  async fetchGodowns(options = {}) {
    const xmlRequest = TdlBuilder.buildGodownRequest();
    const xmlResponse = await this._sendTallyPost(xmlRequest);
    return this.parser.normalizeGodowns(xmlResponse);
  }

  /**
   * Fetches Sales Orders
   */
  async fetchSalesOrders(options = {}) {
    const xmlRequest = TdlBuilder.buildSalesOrderRequest(options);
    const xmlResponse = await this._sendTallyPost(xmlRequest);
    return this.parser.normalizeSalesOrders(xmlResponse);
  }

  /**
   * Fetches Purchase Orders
   */
  async fetchPurchaseOrders(options = {}) {
    const xmlRequest = TdlBuilder.buildPurchaseOrderRequest(options);
    const xmlResponse = await this._sendTallyPost(xmlRequest);
    return this.parser.normalizePurchaseOrders(xmlResponse);
  }

  /**
   * Fetches Delivery Notes
   */
  async fetchDeliveryNotes(options = {}) {
    const xmlRequest = TdlBuilder.buildDeliveryNoteRequest(options);
    const xmlResponse = await this._sendTallyPost(xmlRequest);
    return this.parser.normalizeDeliveryNotes(xmlResponse);
  }

  /**
   * Fetches Receipt Notes
   */
  async fetchReceiptNotes(options = {}) {
    const xmlRequest = TdlBuilder.buildReceiptNoteRequest(options);
    const xmlResponse = await this._sendTallyPost(xmlRequest);
    return this.parser.normalizeReceiptNotes(xmlResponse);
  }

  /**
   * Fetches Sales Register vouchers
   */
  async fetchSalesRegister(options = {}) {
    const xmlRequest = TdlBuilder.buildSalesRegisterRequest(options);
    const xmlResponse = await this._sendTallyPost(xmlRequest);
    return this.parser.normalizeSalesVouchers(xmlResponse);
  }

  /**
   * Fetches Trial Balance
   */
  async fetchTrialBalance(options = {}) {
    const xmlRequest = TdlBuilder.buildTrialBalanceRequest(options);
    const xmlResponse = await this._sendTallyPost(xmlRequest);
    return this.parser.normalizeTrialBalance(xmlResponse);
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
