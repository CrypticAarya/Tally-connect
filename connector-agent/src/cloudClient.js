export class CloudClient {
  constructor(options = {}) {
    let rawUrl = options.cloudUrl ? options.cloudUrl.replace(/\/$/, '') : 'http://127.0.0.1:5001';
    if (rawUrl.includes('//localhost')) {
      rawUrl = rawUrl.replace('//localhost', '//127.0.0.1');
    }
    this.cloudUrl = rawUrl;
    this.connectorId = options.connectorId;
    this.secret = options.secret;
    this.connectionId = options.connectionId;
    this.agentId = options.agentId;
    this.agentToken = options.agentToken;
    this.timeoutMs = options.timeoutMs || 5000;
  }

  /**
   * Health check against Cloud API
   * @returns {Promise<{ success: boolean, status?: string, error?: string }>}
   */
  async checkHealth() {
    const url = `${this.cloudUrl}/api/health`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs)
      });

      if (!response.ok) {
        return { success: false, error: `Cloud returned HTTP ${response.status}` };
      }

      const data = await response.json();
      return { success: true, status: data.status, time: data.time };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Activates this agent using a 6-character activation code (e.g. TC-4829)
   * @param {string} activationCode
   * @param {string} machineName
   * @param {string} [activeCompany]
   * @returns {Promise<{ success: boolean, connectionId?: string, agentId?: string, agentToken?: string, companyName?: string, error?: string }>}
   */
  async activateWithCode(activationCode, machineName, activeCompany = null) {
    const url = `${this.cloudUrl}/api/agent/activate`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activation_code: activationCode,
          machine_name: machineName,
          active_company: activeCompany
        }),
        signal: AbortSignal.timeout(this.timeoutMs)
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || `Activation failed with HTTP ${response.status}` };
      }

      return {
        success: true,
        connectionId: data.connection_id,
        agentId: data.agent_id,
        agentToken: data.agent_token,
        companyName: data.company_name,
        status: data.status
      };
    } catch (err) {
      return { success: false, error: `Cloud server unreachable at ${this.cloudUrl} (${err.message})` };
    }
  }

  /**
   * Registers the connector with the cloud API (legacy compatibility)
   * @param {string} machineName - Hostname of the customer machine
   * @param {string} [agentVersion]
   * @returns {Promise<{ success: boolean, message?: string, error?: string }>}
   */
  async register(machineName, agentVersion = '1.0.0-beta') {
    const url = `${this.cloudUrl}/api/connector/register`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.secret}`,
          'X-Agent-Version': agentVersion
        },
        body: JSON.stringify({
          connectorId: this.connectorId,
          machineName,
          agentVersion,
          secret: this.secret
        }),
        signal: AbortSignal.timeout(this.timeoutMs)
      });

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: `Authentication failed: Invalid connector secret for "${this.connectorId}"`
        };
      }

      if (!response.ok) {
        const text = await response.text();
        return {
          success: false,
          error: `Cloud registration rejected with HTTP ${response.status}: ${text}`
        };
      }

      const data = await response.json();
      return {
        success: true,
        data
      };
    } catch (err) {
      return {
        success: false,
        error: `Cloud server unreachable at ${this.cloudUrl} (${err.message})`
      };
    }
  }

  /**
   * Dispatches heartbeat payload to the cloud API
   * Supports both new agent authorization (/api/agent/heartbeat) and legacy (/api/connector/heartbeat)
   * @param {Object} payload - Heartbeat payload
   * @returns {Promise<{ success: boolean, acknowledged?: boolean, error?: string }>}
   */
  async sendHeartbeat(payload) {
    const isNewAgent = Boolean(this.agentToken || this.connectionId);
    const url = isNewAgent ? `${this.cloudUrl}/api/agent/heartbeat` : `${this.cloudUrl}/api/connector/heartbeat`;

    const headers = {
      'Content-Type': 'application/json'
    };
    if (this.agentToken) {
      headers['Authorization'] = `Bearer ${this.agentToken}`;
    } else if (this.secret) {
      headers['Authorization'] = `Bearer ${this.secret}`;
      headers['X-Connector-ID'] = this.connectorId;
    }

    const bodyPayload = isNewAgent
      ? {
          agentId: this.agentId,
          connectionId: this.connectionId,
          ...payload
        }
      : payload;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyPayload),
        signal: AbortSignal.timeout(this.timeoutMs)
      });

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: 'Heartbeat rejected: Invalid credentials'
        };
      }

      if (!response.ok) {
        return {
          success: false,
          error: `Cloud returned HTTP ${response.status}`
        };
      }

      const data = await response.json();
      return {
        success: true,
        acknowledged: data.acknowledged ?? true
      };
    } catch (err) {
      return {
        success: false,
        error: `Network error sending heartbeat: ${err.message}`
      };
    }
  }

  /**
   * Reads connection permissions from Cloud
   */
  async getPermissions(connectionId) {
    const connId = connectionId || this.connectionId;
    const url = `${this.cloudUrl}/api/connect/${connId}/permissions`;
    const headers = { 'Accept': 'application/json' };
    if (this.agentToken) {
      headers['Authorization'] = `Bearer ${this.agentToken}`;
    }
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(this.timeoutMs)
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.permissions || data;
    } catch {
      return null;
    }
  }

  /**
   * Initiates sync cycle and retrieves pending/allowed sync jobs
   */
  async startSync({ connectionId, agentId, entityType } = {}) {
    const url = `${this.cloudUrl}/api/agent/sync/start`;
    const headers = { 'Content-Type': 'application/json' };
    if (this.agentToken) headers['Authorization'] = `Bearer ${this.agentToken}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          connection_id: connectionId || this.connectionId,
          agent_id: agentId || this.agentId,
          entity_type: entityType
        }),
        signal: AbortSignal.timeout(this.timeoutMs)
      });

      const data = await response.json();
      return { ok: response.ok, status: response.status, ...data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Uploads extracted and transformed JSON payload to Cloud
   */
  async uploadSyncPayload({ connectionId, jobId, entityType, data, rowCount } = {}) {
    const url = `${this.cloudUrl}/api/agent/sync/upload`;
    const headers = { 'Content-Type': 'application/json' };
    if (this.agentToken) headers['Authorization'] = `Bearer ${this.agentToken}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          connection_id: connectionId || this.connectionId,
          job_id: jobId,
          entity_type: entityType,
          data,
          row_count: rowCount || (Array.isArray(data) ? data.length : 0)
        }),
        signal: AbortSignal.timeout(this.timeoutMs * 2)
      });

      const respData = await response.json();
      return { ok: response.ok, status: response.status, ...respData };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Fetches pending export jobs assigned to this connector from the cloud
   * @returns {Promise<{ success: boolean, jobs?: Array<Object>, error?: string }>}
   */
  async fetchPendingJobs() {
    const url = `${this.cloudUrl}/api/connector/jobs?connectorId=${encodeURIComponent(this.connectorId)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.secret}`,
          'X-Connector-ID': this.connectorId
        },
        signal: AbortSignal.timeout(this.timeoutMs)
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Cloud returned HTTP ${response.status} when fetching jobs`
        };
      }

      const data = await response.json();
      return {
        success: true,
        jobs: data.jobs || []
      };
    } catch (err) {
      return {
        success: false,
        error: `Failed to fetch pending jobs: ${err.message}`
      };
    }
  }

  /**
   * Updates job status and uploads generated CSV results to the cloud
   * @param {string} jobId - Job ID
   * @param {Object} statusPayload - { status: 'PROCESSING'|'COMPLETED'|'FAILED', rowCount, filename, csvContent, error }
   * @returns {Promise<{ success: boolean, job?: Object, error?: string }>}
   */
  async updateJobStatus(jobId, statusPayload) {
    const url = `${this.cloudUrl}/api/connector/jobs/${encodeURIComponent(jobId)}/status`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.secret}`,
          'X-Connector-ID': this.connectorId
        },
        body: JSON.stringify(statusPayload),
        signal: AbortSignal.timeout(this.timeoutMs * 2) // Generous timeout for CSV data upload
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Failed to update job status: HTTP ${response.status} - ${errorText}`
        };
      }

      const data = await response.json();
      return {
        success: true,
        job: data.job
      };
    } catch (err) {
      return {
        success: false,
        error: `Network error updating job status for ${jobId}: ${err.message}`
      };
    }
  }
}

