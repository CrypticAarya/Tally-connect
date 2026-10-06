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
      const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
      const companyNode = collection?.COMPANY;

      let rawNode = Array.isArray(companyNode) && companyNode.length > 0 ? companyNode[0] : companyNode;
      let companyName = null;
      if (rawNode) {
        if (rawNode['@_NAME']) {
          companyName = extractTextValue(rawNode['@_NAME']);
        } else if (rawNode.NAME) {
          companyName = extractTextValue(rawNode.NAME);
        } else {
          companyName = extractTextValue(rawNode);
        }
      }

      if (!companyName || companyName === 'No Company Loaded') {
        return {
          online: true,
          port: this.port,
          activeCompany: null,
          latencyMs: Date.now() - startTime,
          error: 'NO_ACTIVE_COMPANY',
          message: "We couldn't identify the active Tally company. Please open a company in TallyPrime and try again."
        };
      }

      return {
        online: true,
        port: this.port,
        activeCompany: companyName,
        latencyMs: Date.now() - startTime
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      return {
        online: false,
        port: this.port,
        activeCompany: null,
        latencyMs,
        error: 'TALLY_NOT_RUNNING',
        message: `TALLY_NOT_RUNNING: Tally is offline at ${this.baseUrl} (${err.message || 'Connection refused'})`
      };
    }
  }
}
