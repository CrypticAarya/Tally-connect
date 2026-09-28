export class CloudClient {
  constructor(options = {}) {
    this.cloudUrl = options.cloudUrl ? options.cloudUrl.replace(/\/$/, '') : 'http://localhost:5001';
    this.connectorId = options.connectorId;
    this.secret = options.secret;
    this.timeoutMs = options.timeoutMs || 5000;
  }

  /**
   * Registers the connector with the cloud API
   * @param {string} machineName - Hostname of the customer machine
   * @returns {Promise<{ success: boolean, message?: string, error?: string }>}
   */
  async register(machineName) {
    const url = `${this.cloudUrl}/api/connector/register`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.secret}`
        },
        body: JSON.stringify({
          connectorId: this.connectorId,
          machineName,
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
   * @param {Object} payload - Heartbeat payload
   * @returns {Promise<{ success: boolean, acknowledged?: boolean, error?: string }>}
   */
  async sendHeartbeat(payload) {
    const url = `${this.cloudUrl}/api/connector/heartbeat`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.secret}`,
          'X-Connector-ID': this.connectorId
        },
        body: JSON.stringify(payload),
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

