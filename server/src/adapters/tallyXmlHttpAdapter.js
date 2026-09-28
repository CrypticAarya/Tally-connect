import { TallyAdapter } from './tallyAdapter.js';
import { TdlBuilder } from './tdlBuilder.js';
import { TallyXmlParser } from './xmlParser.js';
import {
  SAMPLE_COMPANY_XML,
  SAMPLE_CUSTOMER_XML,
  SAMPLE_CHART_OF_ACCOUNTS_XML,
  SAMPLE_SALES_REGISTER_XML,
  SAMPLE_TRIAL_BALANCE_XML
} from './xmlFixtures.js';
import { config } from '../config.js';

export class TallyXmlHttpAdapter extends TallyAdapter {
  /**
   * @param {Object} [options={}]
   * @param {string} [options.host] - Tally host (defaults to 127.0.0.1)
   * @param {number} [options.port] - Tally HTTP port (defaults to 9000)
   * @param {number} [options.timeoutMs] - Request timeout (default: 6000ms)
   * @param {boolean} [options.fixtureFallback] - If true, falls back to XML fixtures when Tally is offline
   */
  constructor(options = {}) {
    super();
    this.host = options.host || config.connector.tallyHost || '127.0.0.1';
    this.port = options.port || config.connector.tallyPort || 9000;
    this.timeoutMs = options.timeoutMs ?? 6000;
    this.fixtureFallback = options.fixtureFallback ?? false;

    this.parser = new TallyXmlParser();
    this.baseUrl = `http://${this.host}:${this.port}`;
  }

  /**
   * Core HTTP POST dispatcher to TallyPrime port 9000
   * @param {string} xmlPayload - TDL envelope
   * @param {string} [fixtureFallbackKey] - Key for XML fixture fallback if enabled
   * @returns {Promise<string>} Raw XML response text
   */
  async _sendTallyPost(xmlPayload, fixtureFallbackKey = null) {
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
        if (this.fixtureFallback && fixtureFallbackKey) {
          return this._getFixture(fixtureFallbackKey);
        }

        const helpfulMessage =
          `Unable to connect to TallyPrime at ${this.baseUrl}. ` +
          `Please verify that:\n` +
          `1. TallyPrime is open and running on this machine.\n` +
          `2. The TallyPrime HTTP Server is enabled:\n` +
          `   - Press F1 (Help) in TallyPrime -> Settings -> Connectivity\n` +
          `   - Set "TallyPrime act as" to "Both" or "Server"\n` +
          `   - Ensure port is set to ${this.port}.`;

        const connectionError = new Error(helpfulMessage);
        connectionError.code = 'TALLY_UNREACHABLE';
        connectionError.originalError = err;
        throw connectionError;
      }

      throw err;
    }
  }

  /**
   * Returns sample XML fixture for offline testing
   */
  _getFixture(key) {
    switch (key) {
      case 'COMPANY':
        return SAMPLE_COMPANY_XML;
      case 'CUSTOMER':
        return SAMPLE_CUSTOMER_XML;
      case 'CHART_OF_ACCOUNTS':
        return SAMPLE_CHART_OF_ACCOUNTS_XML;
      case 'SALES_REGISTER':
        return SAMPLE_SALES_REGISTER_XML;
      case 'TRIAL_BALANCE':
        return SAMPLE_TRIAL_BALANCE_XML;
      default:
        throw new Error(`Unknown fixture key: ${key}`);
    }
  }

  /**
   * Tests connection to the real TallyPrime instance
   */
  async testConnection() {
    const startTime = Date.now();
    const xmlRequest = TdlBuilder.buildCompanyRequest();

    try {
      const xmlResponse = await this._sendTallyPost(xmlRequest, 'COMPANY');
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
   * Fetches Customer Master ledgers from TallyPrime
   */
  async fetchCustomers(options = {}) {
    const xmlRequest = TdlBuilder.buildCustomerRequest();
    const xmlResponse = await this._sendTallyPost(xmlRequest, 'CUSTOMER');
    return this.parser.normalizeCustomers(xmlResponse);
  }

  /**
   * Fetches Chart of Accounts ledgers from TallyPrime
   */
  async fetchChartOfAccounts(options = {}) {
    const xmlRequest = TdlBuilder.buildChartOfAccountsRequest();
    const xmlResponse = await this._sendTallyPost(xmlRequest, 'CHART_OF_ACCOUNTS');
    return this.parser.normalizeChartOfAccounts(xmlResponse);
  }

  /**
   * Fetches Sales Register vouchers from TallyPrime with date filters
   */
  async fetchSalesRegister(options = {}) {
    const xmlRequest = TdlBuilder.buildSalesRegisterRequest(options);
    const xmlResponse = await this._sendTallyPost(xmlRequest, 'SALES_REGISTER');
    return this.parser.normalizeSalesVouchers(xmlResponse);
  }

  /**
   * Fetches Trial Balance balances from TallyPrime
   */
  async fetchTrialBalance(options = {}) {
    const xmlRequest = TdlBuilder.buildTrialBalanceRequest(options);
    const xmlResponse = await this._sendTallyPost(xmlRequest, 'TRIAL_BALANCE');
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
      description: 'Real TallyPrime XML/TDL connector communicating over HTTP port 9000'
    };
  }
}
