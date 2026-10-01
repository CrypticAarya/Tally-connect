import crypto from 'crypto';

/**
 * Tally Connect JavaScript SDK
 * 
 * Client library allowing SaaS applications to initiate customer Tally connections,
 * poll status, trigger immediate synchronizations, retrieve accounting data,
 * and verify incoming webhook signatures.
 */
export class TallyConnect {
  /**
   * Initializes Tally Connect SDK instance
   * @param {Object} options
   * @param {string} [options.baseUrl='http://127.0.0.1:5001'] - Base API URL (e.g. https://api.tallyconnect.io or http://127.0.0.1:5001)
   * @param {string} [options.apiKey] - Developer API key (tc_live_...) for server-side operations
   */
  constructor({ baseUrl = 'http://127.0.0.1:5001', apiKey = null } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  /**
   * Initiates an embedded connection session for a customer
   * @param {Object} params
   * @param {string} params.appId - SaaS Application ID
   * @param {string} [params.userId] - SaaS Customer User ID
   * @param {string} [params.externalUserId] - Alternative parameter for SaaS Customer User ID
   * @param {string} [params.callbackUrl] - Optional redirect callback after connection
   * @param {string} [params.companyName] - Optional default company name
   * @returns {Promise<{ sessionId: string, connectionId: string, activationCode: string, expiresAt: string, callbackUrl?: string }>}
   */
  async createSession({ appId, userId, externalUserId, callbackUrl, companyName }) {
    const effectiveUserId = userId || externalUserId;
    if (!appId || !effectiveUserId) {
      throw new Error('Both appId and userId (or externalUserId) are required to create a connection session.');
    }

    const response = await fetch(`${this.baseUrl}/api/connect/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { 'x-api-key': this.apiKey } : {})
      },
      body: JSON.stringify({
        app_id: appId,
        external_user_id: effectiveUserId,
        callback_url: callbackUrl,
        company_name: companyName
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || err.error || `Failed to create connection session (${response.status})`);
    }

    const data = await response.json();
    return {
      sessionId: data.session_id,
      connectionId: data.connection_id || data.session_id,
      activationCode: data.activation_code,
      expiresAt: data.expires_at,
      callbackUrl: data.callback_url
    };
  }

  /**
   * Alias for createSession
   */
  async createConnection(params) {
    return this.createSession(params);
  }

  /**
   * Retrieves live status of a customer's Tally connection
   * @param {string} connectionId
   * @returns {Promise<{ status: string, company_name: string, agent_status: string, tally_status: string, last_sync: string, permissions: Object }>}
   */
  async getStatus(connectionId) {
    if (!connectionId) throw new Error('connectionId is required');
    const response = await fetch(`${this.baseUrl}/api/connect/${encodeURIComponent(connectionId)}/status`, {
      headers: {
        ...(this.apiKey ? { 'x-api-key': this.apiKey } : {})
      }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || err.error || `Failed to get status (${response.status})`);
    }

    return await response.json();
  }

  /**
   * Alias for getStatus
   */
  async getConnectionStatus(connectionId) {
    return this.getStatus(connectionId);
  }

  /**
   * Retrieves permission matrix for a connection
   * @param {string} connectionId
   */
  async getPermissions(connectionId) {
    if (!connectionId) throw new Error('connectionId is required');
    const response = await fetch(`${this.baseUrl}/api/connect/${encodeURIComponent(connectionId)}/permissions`, {
      headers: {
        ...(this.apiKey ? { 'x-api-key': this.apiKey } : {})
      }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || err.error || `Failed to get permissions (${response.status})`);
    }

    return await response.json();
  }

  /**
   * Updates permission matrix for a connection
   * @param {string} connectionId
   * @param {Object} permissions - { customers, vendors, sales, inventory, ledgers, orders, delivery_notes, receipt_notes, trial_balance }
   */
  async updatePermissions(connectionId, permissions = {}) {
    if (!connectionId) throw new Error('connectionId is required');
    const response = await fetch(`${this.baseUrl}/api/connect/${encodeURIComponent(connectionId)}/permissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { 'x-api-key': this.apiKey } : {})
      },
      body: JSON.stringify({ permissions })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || err.error || `Failed to update permissions (${response.status})`);
    }

    return await response.json();
  }

  /**
   * Triggers an immediate data synchronization for permitted entities
   * @param {string} connectionId
   */
  async syncNow(connectionId) {
    if (!connectionId) throw new Error('connectionId is required');
    const response = await fetch(`${this.baseUrl}/api/connect/${encodeURIComponent(connectionId)}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { 'x-api-key': this.apiKey } : {})
      }
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      const err = data.error || {};
      throw new Error(err.message || `Sync trigger failed (${response.status})`);
    }

    return data;
  }

  /**
   * Alias for syncNow
   */
  async sync(connectionId) {
    return this.syncNow(connectionId);
  }

  /**
   * Retrieves connection sync history and records count
   * @param {string} connectionId
   */
  async getSyncHistory(connectionId) {
    if (!connectionId) throw new Error('connectionId is required');
    const response = await fetch(`${this.baseUrl}/api/connect/${encodeURIComponent(connectionId)}/sync-history`, {
      headers: {
        ...(this.apiKey ? { 'x-api-key': this.apiKey } : {})
      }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || err.error || `Failed to get sync history (${response.status})`);
    }

    return await response.json();
  }

  /**
   * Internal helper to query /api/v1 endpoints with authentication and multi-tenant isolation
   * @private
   */
  async _fetchEntity(path, connectionId, queryParams = {}) {
    if (!this.apiKey) {
      throw new Error('API key (apiKey) is required to query accounting data.');
    }

    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(queryParams)) {
      if (v != null) url.searchParams.set(k, String(v));
    }

    const headers = {
      'x-api-key': this.apiKey,
      'Accept': 'application/json'
    };
    if (connectionId) {
      headers['x-connection-id'] = connectionId;
    }

    const response = await fetch(url.toString(), { headers });
    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = json.error?.message || json.error || `API error (${response.status})`;
      const errObj = new Error(errorMsg);
      errObj.status = response.status;
      errObj.code = json.error?.code || (response.status === 403 ? 'PERMISSION_DENIED' : 'API_ERROR');
      throw errObj;
    }

    return json.data !== undefined ? json.data : json;
  }

  // ==========================================
  // Public Accounting Data Query Methods (/api/v1)
  // ==========================================

  /**
   * Retrieves customer masters (Sundry Debtors)
   * @param {string} connectionId
   * @returns {Promise<Array<{ id: string, name: string, gstin: string, address: string }>>}
   */
  async getCustomers(connectionId) {
    return this._fetchEntity('/api/v1/customers', connectionId);
  }

  /**
   * Retrieves vendor masters (Sundry Creditors)
   * @param {string} connectionId
   */
  async getVendors(connectionId) {
    return this._fetchEntity('/api/v1/vendors', connectionId);
  }

  /**
   * Retrieves sales vouchers / invoices
   * @param {string} connectionId
   */
  async getSales(connectionId) {
    return this._fetchEntity('/api/v1/sales', connectionId);
  }

  /**
   * Retrieves stock items / inventory valuation
   * @param {string} connectionId
   */
  async getInventory(connectionId) {
    return this._fetchEntity('/api/v1/inventory', connectionId);
  }

  /**
   * Retrieves stock item groups
   * @param {string} connectionId
   */
  async getStockGroups(connectionId) {
    return this._fetchEntity('/api/v1/stock-groups', connectionId);
  }

  /**
   * Retrieves units of measurement
   * @param {string} connectionId
   */
  async getUnits(connectionId) {
    return this._fetchEntity('/api/v1/units', connectionId);
  }

  /**
   * Retrieves godowns / locations
   * @param {string} connectionId
   */
  async getGodowns(connectionId) {
    return this._fetchEntity('/api/v1/godowns', connectionId);
  }

  /**
   * Retrieves general ledgers / Chart of Accounts
   * @param {string} connectionId
   */
  async getLedgers(connectionId) {
    return this._fetchEntity('/api/v1/ledgers', connectionId);
  }

  /**
   * Retrieves account groups
   * @param {string} connectionId
   */
  async getGroups(connectionId) {
    return this._fetchEntity('/api/v1/groups', connectionId);
  }

  /**
   * Retrieves cost centres
   * @param {string} connectionId
   */
  async getCostCenters(connectionId) {
    return this._fetchEntity('/api/v1/cost-centers', connectionId);
  }

  /**
   * Retrieves sales orders
   * @param {string} connectionId
   */
  async getSalesOrders(connectionId) {
    return this._fetchEntity('/api/v1/sales-orders', connectionId);
  }

  /**
   * Retrieves purchase orders
   * @param {string} connectionId
   */
  async getPurchaseOrders(connectionId) {
    return this._fetchEntity('/api/v1/purchase-orders', connectionId);
  }

  /**
   * Retrieves delivery notes
   * @param {string} connectionId
   */
  async getDeliveryNotes(connectionId) {
    return this._fetchEntity('/api/v1/delivery-notes', connectionId);
  }

  /**
   * Retrieves receipt notes
   * @param {string} connectionId
   */
  async getReceiptNotes(connectionId) {
    return this._fetchEntity('/api/v1/receipt-notes', connectionId);
  }

  /**
   * Retrieves Trial Balance
   * @param {string} connectionId
   */
  async getTrialBalance(connectionId) {
    return this._fetchEntity('/api/v1/trial-balance', connectionId);
  }

  // ==========================================
  // Webhook Signature Verification Utility
  // ==========================================

  /**
   * Verifies HMAC-SHA256 signature on incoming webhooks from Tally Connect
   * @param {string|Buffer|Object} rawBody - Raw HTTP request body string or Buffer
   * @param {string} signatureHeader - Header value from 'x-tally-signature' (e.g. 'sha256=...')
   * @param {string} apiSecret - The application's api_secret
   * @returns {boolean} True if signature matches cryptographically
   */
  static verifyWebhookSignature(rawBody, signatureHeader, apiSecret) {
    if (!signatureHeader || !apiSecret) {
      return false;
    }

    const cleanSig = signatureHeader.startsWith('sha256=')
      ? signatureHeader.slice(7).trim()
      : signatureHeader.trim();

    const bodyString = typeof rawBody === 'string'
      ? rawBody
      : (Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : JSON.stringify(rawBody));

    const expected = crypto.createHmac('sha256', apiSecret)
      .update(bodyString)
      .digest('hex');

    if (cleanSig.length !== expected.length) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(cleanSig, 'utf8'), Buffer.from(expected, 'utf8'));
  }
}

/**
 * Top-level convenience helper for SaaS developers
 * 
 * Example:
 * ```javascript
 * const session = await connectTally({
 *   appId: "app_live_12345",
 *   userId: "user_customer_99"
 * });
 * console.log("Customer activation code:", session.activationCode);
 * ```
 */
export async function connectTally({
  appId,
  userId,
  companyName,
  baseUrl = 'http://127.0.0.1:5001',
  callbackUrl = null
}) {
  const client = new TallyConnect({ baseUrl });
  return await client.createSession({
    appId,
    userId,
    companyName,
    callbackUrl
  });
}

