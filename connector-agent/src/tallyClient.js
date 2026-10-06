import { XMLParser } from 'fast-xml-parser';
import { TdlBuilder } from './adapters/tdlBuilder.js';
import { extractTextValue } from './adapters/xmlParser.js';

export class TallyClient {
  constructor(options = {}) {
    this.host = options.host || '127.0.0.1';
    this.port = options.port || 9000;
    this.timeoutMs = options.timeoutMs || 4000;

    this.baseUrl = `http://${this.host}:${this.port}`;
    this.parser = new XMLParser({
      ignoreAttributes: false,
      trimValues: true,
      parseTagValue: false
    });
    this.simulateIfOffline = false;
  }

  /**
   * Connects to local TallyPrime XML server, checks availability, and detects active company
   * @returns {Promise<{ online: boolean, port: number, activeCompany: string|null, latencyMs: number, error?: string }>}
   */
  async checkStatus() {
    const startTime = Date.now();
    const payload = TdlBuilder.buildCompanyRequest();

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml;charset=utf-8',
          'Accept': 'text/xml'
        },
        body: payload,
        signal: AbortSignal.timeout(this.timeoutMs)
      });

      if (!response.ok) {
        return {
          online: false,
          port: this.port,
          activeCompany: null,
          latencyMs: Date.now() - startTime,
          error: `TallyPrime responded with HTTP ${response.status}: ${response.statusText}`
        };
      }

      const xmlText = await response.text();
      const parsed = this.parser.parse(xmlText);
      const data = parsed?.ENVELOPE?.BODY?.DATA;
      const collection = data?.COLLECTION || data;
      const rawNodes = collection?.COMPANY
        ? (Array.isArray(collection.COMPANY) ? collection.COMPANY : [collection.COMPANY])
        : [];

      const companies = [];
      for (const node of rawNodes) {
        let name = '';
        if (node['@_NAME']) name = extractTextValue(node['@_NAME']);
        else if (node.NAME) name = extractTextValue(node.NAME);
        else name = extractTextValue(node);

        if (name && name !== 'No Company Loaded' && !companies.includes(name)) {
          companies.push(name);
        }
      }

      if (companies.length === 0) {
        return {
          online: true,
          port: this.port,
          companies: [],
          availableCompanies: 0,
          activeCompany: null,
          latencyMs: Date.now() - startTime,
          error: 'NO_ACTIVE_COMPANY',
          message: "We couldn't identify the active Tally company. Please open a company in TallyPrime and try again."
        };
      }

      return {
        online: true,
        port: this.port,
        companies,
        availableCompanies: companies.length,
        activeCompany: companies[0],
        latencyMs: Date.now() - startTime
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      return {
        online: false,
        port: this.port,
        companies: [],
        availableCompanies: 0,
        activeCompany: null,
        latencyMs,
        error: 'TALLY_NOT_RUNNING',
        message: `TALLY_NOT_RUNNING: Tally is offline at ${this.baseUrl} (${err.message || 'Connection refused'})`
      };
    }
  }
}
