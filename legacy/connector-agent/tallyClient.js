import { XMLParser } from 'fast-xml-parser';

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
   * Builds the minimal TDL XML request to probe Tally and extract the active company
   */
  _buildProbeEnvelope() {
    return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>ActiveCompanyProbe</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="ActiveCompanyProbe">
            <TYPE>Company</TYPE>
            <FETCH>NAME, GUID, STARTINGFROM, ENDINGAT</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
  }

  /**
   * Connects to local TallyPrime XML server, checks availability, and detects active company
   * @returns {Promise<{ online: boolean, port: number, activeCompany: string|null, latencyMs: number, error?: string }>}
   */
  async checkStatus() {
    const startTime = Date.now();
    const payload = this._buildProbeEnvelope();

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

      let companyName = null;
      if (Array.isArray(companyNode) && companyNode.length > 0) {
        companyName = companyNode[0].NAME || companyNode[0]['@_NAME'];
      } else if (companyNode) {
        companyName = companyNode.NAME || companyNode['@_NAME'];
      }

      return {
        online: true,
        port: this.port,
        activeCompany: companyName || 'Default Company',
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
