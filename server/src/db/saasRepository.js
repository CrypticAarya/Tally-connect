import { pool, generateApiKey, generateApiSecret, hashPassword, verifyPassword } from './mysql.js';
import crypto from 'crypto';

/**
 * Data Access Layer for MySQL SaaS Apps, Connections, Agents & Permissions
 */
export class SaasRepository {
  /**
   * Creates a new SaaS application
   */
  static async createSaasApp({ name, redirectUrl }) {
    if (!name) {
      throw new Error('Application name is required');
    }

    const id = `app_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const apiKey = generateApiKey();
    const apiSecret = generateApiSecret();

    await pool.query(
      `INSERT INTO saas_apps (id, name, api_key, api_secret, redirect_url)
       VALUES (?, ?, ?, ?, ?)`,
      [id, name, apiKey, apiSecret, redirectUrl || null]
    );

    // Keep apps table in sync
    await pool.query(
      `INSERT INTO apps (id, developer_id, app_name, api_key, api_secret, webhook_url, status, is_active)
       VALUES (?, NULL, ?, ?, ?, ?, 'ACTIVE', TRUE)
       ON DUPLICATE KEY UPDATE app_name=VALUES(app_name)`,
      [id, name, apiKey, apiSecret, redirectUrl || null]
    ).catch(() => {});

    return {
      id,
      name,
      api_key: apiKey,
      api_secret: apiSecret,
      redirect_url: redirectUrl || null,
      created_at: new Date()
    };
  }

  /**
   * Lists all registered SaaS applications
   */
  static async listSaasApps() {
    const [rows] = await pool.query(
      `SELECT a.id, a.name, a.api_key, a.redirect_url, a.created_at,
              COUNT(c.id) AS connections_count
       FROM saas_apps a
       LEFT JOIN connections c ON a.id = c.saas_app_id
       GROUP BY a.id, a.name, a.api_key, a.redirect_url, a.created_at
       ORDER BY a.created_at DESC`
    );
    return rows;
  }

  /**
   * Finds SaaS app by its API Key (checks apps and saas_apps)
   */
  static async findAppByApiKey(apiKey) {
    if (!apiKey) return null;

    try {
      // Check apps table first
      const [appRows] = await pool.query(
        `SELECT id, developer_id, app_name, app_name AS name, api_key, api_secret, webhook_url, status, is_active, created_at
         FROM apps
         WHERE api_key = ?
         LIMIT 1`,
        [apiKey]
      );
      if (appRows.length > 0) {
        return appRows[0];
      }
    } catch {
      // Ignore if apps table not yet queried
    }

    // Fallback to saas_apps
    const [rows] = await pool.query(
      `SELECT id, name, name AS app_name, api_key, redirect_url AS webhook_url, redirect_url, 'ACTIVE' AS status, TRUE AS is_active, created_at
       FROM saas_apps
       WHERE api_key = ?
       LIMIT 1`,
      [apiKey]
    );
    return rows[0] || null;
  }

  /**
   * Finds SaaS app by ID
   */
  static async getSaasAppById(id) {
    const [rows] = await pool.query(
      `SELECT id, name, api_key, redirect_url, created_at
       FROM saas_apps
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Regenerates API key and secret for a SaaS application
   */
  static async regenerateApiKey(id) {
    const existing = await this.getSaasAppById(id);
    if (!existing) {
      throw new Error(`SaaS application with ID "${id}" not found`);
    }

    const newApiKey = generateApiKey();
    const newApiSecret = generateApiSecret();

    await pool.query(
      `UPDATE saas_apps
       SET api_key = ?, api_secret = ?
       WHERE id = ?`,
      [newApiKey, newApiSecret, id]
    );

    return {
      id,
      name: existing.name,
      api_key: newApiKey,
      api_secret: newApiSecret,
      updated_at: new Date()
    };
  }

  /**
   * Creates a customer connection under a SaaS application
   */
  static async createConnection({ saasAppId, externalUserId, companyName, agentId, status = 'PENDING' }) {
    if (!saasAppId || !externalUserId) {
      throw new Error('saasAppId and externalUserId are required');
    }

    const id = `conn_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;

    await pool.query(
      `INSERT INTO connections (id, saas_app_id, external_user_id, company_name, agent_id, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, saasAppId, externalUserId, companyName || null, agentId || null, status]
    );

    // Seed default permissions for connection
    await pool.query(
      `INSERT INTO permissions (connection_id, allow_customers, allow_vendors, allow_sales, allow_inventory, allow_ledgers, allow_orders, allow_delivery_notes, allow_receipt_notes, allow_trial_balance)
       VALUES (?, TRUE, TRUE, TRUE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE)`,
      [id]
    );

    return {
      id,
      saas_app_id: saasAppId,
      external_user_id: externalUserId,
      company_name: companyName || null,
      agent_id: agentId || null,
      status,
      created_at: new Date()
    };
  }

  /**
   * Retrieves connection by ID with permissions
   */
  static async getConnectionById(id) {
    const [connections] = await pool.query(
      `SELECT id, saas_app_id, external_user_id, company_name, agent_id, status, last_sync, created_at
       FROM connections
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (connections.length === 0) return null;

    const connection = connections[0];
    const [permissions] = await pool.query(
      `SELECT allow_customers, allow_vendors, allow_sales, allow_inventory, allow_ledgers, allow_orders, allow_delivery_notes, allow_receipt_notes, allow_trial_balance
       FROM permissions
       WHERE connection_id = ?
       LIMIT 1`,
      [id]
    );

    return {
      ...connection,
      permissions: permissions[0] || null
    };
  }

  /**
   * Finds the latest active or initiated connection for a SaaS application
   */
  static async findActiveConnectionForApp(saasAppId) {
    if (!saasAppId) return null;
    const [rows] = await pool.query(
      `SELECT id, saas_app_id, external_user_id, company_name, agent_id, status, last_sync, created_at
       FROM connections
       WHERE saas_app_id = ?
       ORDER BY (CASE WHEN status = 'ACTIVE' THEN 1 ELSE 2 END), created_at DESC
       LIMIT 1`,
      [saasAppId]
    );
    return rows[0] || null;
  }

  /**
   * Initiates a connection with a 6-character activation code (Phase 3)
   */
  static async initiateConnection({ saasAppId, externalUserId, companyName, expiryMinutes = 30 }) {
    if (!saasAppId || !externalUserId) {
      throw new Error('saas_app_id and external_user_id are required');
    }

    const id = `conn_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const activationCode = `TC-${randomDigits}`;
    const expiryTime = new Date(Date.now() + expiryMinutes * 60 * 1000);

    await pool.query(
      `INSERT INTO connections (id, saas_app_id, external_user_id, company_name, status, activation_code, expiry_time)
       VALUES (?, ?, ?, ?, 'PENDING', ?, ?)`,
      [id, saasAppId, externalUserId, companyName || null, activationCode, expiryTime]
    );

    // Seed default permissions for connection
    await pool.query(
      `INSERT INTO permissions (connection_id, allow_customers, allow_vendors, allow_sales, allow_inventory, allow_ledgers, allow_orders, allow_delivery_notes, allow_receipt_notes, allow_trial_balance)
       VALUES (?, TRUE, TRUE, TRUE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE)`,
      [id]
    );

    return {
      connection_id: id,
      saas_app_id: saasAppId,
      external_user_id: externalUserId,
      company_name: companyName || null,
      activation_code: activationCode,
      expiry_time: expiryTime,
      status: 'PENDING'
    };
  }

  /**
   * Finds connection by its activation code
   */
  static async findConnectionByActivationCode(code) {
    if (!code) return null;
    const cleanCode = code.trim().toUpperCase();
    const [rows] = await pool.query(
      `SELECT id, saas_app_id, external_user_id, company_name, agent_id, status, activation_code, expiry_time, created_at
       FROM connections
       WHERE activation_code = ?
       LIMIT 1`,
      [cleanCode]
    );
    return rows[0] || null;
  }

  /**
   * Activates an agent and links it to a connection (Phase 3)
   */
  static async activateAgentForConnection({ connectionId, machineName = 'DESKTOP-PC', activeCompany = null }) {
    const connection = await this.getConnectionById(connectionId);
    if (!connection) {
      throw new Error(`Connection with ID "${connectionId}" not found`);
    }

    const agentId = `agt_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const agentToken = `agt_tok_${crypto.randomBytes(24).toString('hex')}`;

    // Create agent record in MySQL
    await pool.query(
      `INSERT INTO agents (id, connection_id, machine_name, status, agent_token, last_heartbeat, active_company)
       VALUES (?, ?, ?, 'ONLINE', ?, CURRENT_TIMESTAMP, ?)`,
      [agentId, connectionId, machineName, agentToken, activeCompany || connection.company_name || null]
    );

    // Mark connection ACTIVE
    await pool.query(
      `UPDATE connections
       SET status = 'ACTIVE',
           agent_id = ?,
           company_name = COALESCE(?, company_name)
       WHERE id = ?`,
      [agentId, activeCompany || null, connectionId]
    );

    return {
      success: true,
      connection_id: connectionId,
      agent_id: agentId,
      agent_token: agentToken,
      status: 'ACTIVE',
      company_name: activeCompany || connection.company_name || null
    };
  }

  /**
   * Retrieves permissions formatted as simple key-value booleans
   */
  static async getPermissions(connectionId) {
    const [rows] = await pool.query(
      `SELECT allow_customers, allow_vendors, allow_sales, allow_inventory, allow_ledgers, allow_orders, allow_delivery_notes, allow_receipt_notes, allow_trial_balance
       FROM permissions
       WHERE connection_id = ?
       LIMIT 1`,
      [connectionId]
    );

    if (rows.length === 0) return null;
    const r = rows[0];

    return {
      customers: Boolean(r.allow_customers),
      vendors: r.allow_vendors !== undefined ? Boolean(r.allow_vendors) : true,
      sales: Boolean(r.allow_sales),
      inventory: Boolean(r.allow_inventory),
      ledgers: Boolean(r.allow_ledgers),
      orders: Boolean(r.allow_orders),
      delivery_notes: Boolean(r.allow_delivery_notes),
      receipt_notes: Boolean(r.allow_receipt_notes),
      trial_balance: Boolean(r.allow_trial_balance)
    };
  }

  /**
   * Updates permissions for a connection
   */
  static async updatePermissions(connectionId, perms = {}) {
    const current = await this.getPermissions(connectionId) || {
      customers: true,
      vendors: true,
      sales: true,
      inventory: false,
      ledgers: true,
      orders: false,
      delivery_notes: false,
      receipt_notes: false,
      trial_balance: false
    };

    const updated = {
      customers: perms.customers !== undefined ? Boolean(perms.customers) : (perms.allow_customers !== undefined ? Boolean(perms.allow_customers) : current.customers),
      vendors: perms.vendors !== undefined ? Boolean(perms.vendors) : (perms.allow_vendors !== undefined ? Boolean(perms.allow_vendors) : (current.vendors ?? true)),
      sales: perms.sales !== undefined ? Boolean(perms.sales) : (perms.allow_sales !== undefined ? Boolean(perms.allow_sales) : current.sales),
      inventory: perms.inventory !== undefined ? Boolean(perms.inventory) : (perms.allow_inventory !== undefined ? Boolean(perms.allow_inventory) : current.inventory),
      ledgers: perms.ledgers !== undefined ? Boolean(perms.ledgers) : (perms.allow_ledgers !== undefined ? Boolean(perms.allow_ledgers) : current.ledgers),
      orders: perms.orders !== undefined ? Boolean(perms.orders) : (perms.allow_orders !== undefined ? Boolean(perms.allow_orders) : (current.orders ?? false)),
      delivery_notes: perms.delivery_notes !== undefined ? Boolean(perms.delivery_notes) : (perms.allow_delivery_notes !== undefined ? Boolean(perms.allow_delivery_notes) : (current.delivery_notes ?? false)),
      receipt_notes: perms.receipt_notes !== undefined ? Boolean(perms.receipt_notes) : (perms.allow_receipt_notes !== undefined ? Boolean(perms.allow_receipt_notes) : (current.receipt_notes ?? false)),
      trial_balance: perms.trial_balance !== undefined ? Boolean(perms.trial_balance) : (perms.allow_trial_balance !== undefined ? Boolean(perms.allow_trial_balance) : current.trial_balance)
    };

    await pool.query(
      `UPDATE permissions
       SET allow_customers = ?,
           allow_vendors = ?,
           allow_sales = ?,
           allow_inventory = ?,
           allow_ledgers = ?,
           allow_orders = ?,
           allow_delivery_notes = ?,
           allow_receipt_notes = ?,
           allow_trial_balance = ?
       WHERE connection_id = ?`,
      [
        updated.customers ? 1 : 0,
        updated.vendors ? 1 : 0,
        updated.sales ? 1 : 0,
        updated.inventory ? 1 : 0,
        updated.ledgers ? 1 : 0,
        updated.orders ? 1 : 0,
        updated.delivery_notes ? 1 : 0,
        updated.receipt_notes ? 1 : 0,
        updated.trial_balance ? 1 : 0,
        connectionId
      ]
    );

    return updated;
  }

  /**
   * Alias for updatePermissions
   */
  static async setPermissions(connectionId, perms = {}) {
    return this.updatePermissions(connectionId, perms);
  }

  /**
   * Records agent heartbeat and updates status in MySQL
   */
  static async recordAgentHeartbeat({ agentId, connectionId, machineName, tallyStatus, activeCompany }) {
    const status = tallyStatus === 'ONLINE' ? 'ONLINE' : 'OFFLINE';

    if (agentId) {
      await pool.query(
        `UPDATE agents
         SET status = ?,
             last_heartbeat = CURRENT_TIMESTAMP,
             active_company = COALESCE(?, active_company),
             machine_name = COALESCE(?, machine_name)
         WHERE id = ?`,
        [status, activeCompany || null, machineName || null, agentId]
      );
    }

    if (connectionId && activeCompany) {
      await pool.query(
        `UPDATE connections
         SET company_name = ?
         WHERE id = ?`,
        [activeCompany, connectionId]
      );
    }

    return {
      acknowledged: true,
      agentId,
      status,
      timestamp: new Date()
    };
  }

  /**
   * Creates a new sync job
   */
  static async createSyncJob(arg1, arg2, maxRetries = 3) {
    let connectionId;
    let entityType;
    if (typeof arg1 === 'object' && arg1 !== null) {
      connectionId = arg1.connectionId || arg1.connection_id;
      entityType = arg1.entityType || arg1.entity_type;
      if (arg1.maxRetries) maxRetries = arg1.maxRetries;
    } else {
      connectionId = arg1;
      entityType = arg2;
    }

    const id = `job_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const cleanType = String(entityType).toLowerCase();
    await pool.query(
      `INSERT INTO sync_jobs (id, connection_id, entity_type, status, retry_count, max_retries, created_at)
       VALUES (?, ?, ?, 'PENDING', 0, ?, CURRENT_TIMESTAMP)`,
      [id, connectionId, cleanType, maxRetries]
    );
    return {
      id,
      connection_id: connectionId,
      entity_type: cleanType,
      status: 'PENDING',
      retry_count: 0,
      max_retries: maxRetries
    };
  }

  /**
   * Gets pending sync jobs for a connection
   */
  static async getPendingSyncJobs(connectionId) {
    const [rows] = await pool.query(
      `SELECT id, connection_id, entity_type, status, created_at
       FROM sync_jobs
       WHERE connection_id = ? AND status = 'PENDING'
       ORDER BY created_at ASC`,
      [connectionId]
    );
    return rows;
  }

  /**
   * Updates sync job status to COMPLETED
   */
  static async completeSyncJob(jobId) {
    await pool.query(
      `UPDATE sync_jobs
       SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [jobId]
    );
    return { id: jobId, status: 'COMPLETED' };
  }

  /**
   * Stores or updates entity cache in MySQL
   */
  static async saveEntityCache({ connectionId, entityType, dataJson }) {
    const id = `cache_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const cleanType = String(entityType).toLowerCase();
    const jsonStr = typeof dataJson === 'string' ? dataJson : JSON.stringify(dataJson);

    await pool.query(
      `INSERT INTO entity_cache (id, connection_id, entity_type, data_json, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE data_json = VALUES(data_json), updated_at = CURRENT_TIMESTAMP`,
      [id, connectionId, cleanType, jsonStr]
    );

    await pool.query(
      `UPDATE connections
       SET last_sync = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [connectionId]
    );

    return { connection_id: connectionId, entity_type: cleanType, updated_at: new Date() };
  }

  /**
   * Gets cached entity payload
   */
  static async getEntityCache(connectionId, entityType) {
    const cleanType = String(entityType).toLowerCase();
    const [rows] = await pool.query(
      `SELECT id, connection_id, entity_type, data_json, updated_at
       FROM entity_cache
       WHERE connection_id = ? AND entity_type = ?
       LIMIT 1`,
      [connectionId, cleanType]
    );
    if (rows.length === 0) return null;
    try {
      const parsedData = typeof rows[0].data_json === 'string'
        ? JSON.parse(rows[0].data_json)
        : rows[0].data_json;
      return {
        ...rows[0],
        data: parsedData
      };
    } catch {
      return {
        ...rows[0],
        data: Array.isArray(rows[0].data_json) ? rows[0].data_json : []
      };
    }
  }

  // ==========================================
  // PHASE 6: DEVELOPER ACCOUNTS
  // ==========================================

  /**
   * Creates a new developer account
   */
  static async createDeveloper({ name, email, password }) {
    if (!name || !email || !password) {
      throw new Error('Name, email, and password are required');
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await this.findDeveloperByEmail(cleanEmail);
    if (existing) {
      const err = new Error('Developer account already exists with this email');
      err.statusCode = 409;
      throw err;
    }

    const id = `dev_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const passwordHash = hashPassword(password);

    await pool.query(
      `INSERT INTO developers (id, name, email, password_hash)
       VALUES (?, ?, ?, ?)`,
      [id, name.trim(), cleanEmail, passwordHash]
    );

    return {
      id,
      name: name.trim(),
      email: cleanEmail,
      created_at: new Date()
    };
  }

  /**
   * Finds developer by email
   */
  static async findDeveloperByEmail(email) {
    if (!email) return null;
    const [rows] = await pool.query(
      `SELECT id, name, email, password_hash, created_at
       FROM developers
       WHERE email = ?
       LIMIT 1`,
      [email.trim().toLowerCase()]
    );
    return rows[0] || null;
  }

  /**
   * Finds developer by ID
   */
  static async findDeveloperById(id) {
    if (!id) return null;
    const [rows] = await pool.query(
      `SELECT id, name, email, created_at
       FROM developers
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Verifies developer credentials
   */
  static async verifyDeveloperCredentials(email, password) {
    const dev = await this.findDeveloperByEmail(email);
    if (!dev) return null;
    const isValid = verifyPassword(password, dev.password_hash);
    if (!isValid) return null;

    const { password_hash, ...safeDev } = dev;
    return safeDev;
  }

  // ==========================================
  // PHASE 6: APPS & API KEY MANAGEMENT
  // ==========================================

  /**
   * Creates an app under a developer account
   */
  static async createApp({ developerId, appName, name, webhookUrl, redirectUrl }) {
    const finalName = appName || name;
    if (!finalName) {
      throw new Error('App name is required');
    }
    appName = finalName;

    const id = `app_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const apiKey = generateApiKey();
    const apiSecret = generateApiSecret();

    // Insert into apps table
    await pool.query(
      `INSERT INTO apps (id, developer_id, app_name, api_key, api_secret, webhook_url, status, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', TRUE)`,
      [id, developerId || null, appName.trim(), apiKey, apiSecret, webhookUrl || null]
    );

    // Keep saas_apps table synchronized so connections.saas_app_id foreign key & legacy routes work seamlessly
    await pool.query(
      `INSERT INTO saas_apps (id, name, api_key, api_secret, redirect_url)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), api_key=VALUES(api_key), api_secret=VALUES(api_secret), redirect_url=VALUES(redirect_url)`,
      [id, appName.trim(), apiKey, apiSecret, webhookUrl || null]
    );

    return {
      id,
      developer_id: developerId || null,
      app_name: appName.trim(),
      api_key: apiKey,
      api_secret: apiSecret,
      webhook_url: webhookUrl || null,
      status: 'ACTIVE',
      is_active: true,
      created_at: new Date()
    };
  }

  /**
   * Lists apps for a developer or all apps
   */
  static async listApps(developerId = null) {
    let sql = `
      SELECT a.id, a.developer_id, a.app_name, a.api_key, a.webhook_url, a.status, a.is_active, a.created_at,
             COUNT(c.id) AS connections_count
      FROM apps a
      LEFT JOIN connections c ON a.id = c.saas_app_id
    `;
    const params = [];

    if (developerId) {
      sql += ` WHERE a.developer_id = ? `;
      params.push(developerId);
    }

    sql += `
      GROUP BY a.id, a.developer_id, a.app_name, a.api_key, a.webhook_url, a.status, a.is_active, a.created_at
      ORDER BY a.created_at DESC
    `;

    const [rows] = await pool.query(sql, params);
    return rows;
  }

  /**
   * Gets an app by ID (checks apps table, falls back to saas_apps)
   */
  static async getAppById(id) {
    if (!id) return null;
    const [rows] = await pool.query(
      `SELECT id, developer_id, app_name, api_key, api_secret, webhook_url, status, is_active, created_at
       FROM apps
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    if (rows.length > 0) return rows[0];

    // Fallback to saas_apps
    const saasApp = await this.getSaasAppById(id);
    if (!saasApp) return null;
    return {
      id: saasApp.id,
      developer_id: null,
      app_name: saasApp.name,
      name: saasApp.name,
      api_key: saasApp.api_key,
      api_secret: saasApp.api_secret,
      webhook_url: saasApp.redirect_url,
      status: 'ACTIVE',
      is_active: true,
      created_at: saasApp.created_at
    };
  }

  /**
   * Regenerates API key and secret for an app
   */
  static async regenerateAppApiKey(id) {
    const existing = await this.getAppById(id);
    if (!existing) {
      throw new Error(`Application with ID "${id}" not found`);
    }

    const newApiKey = generateApiKey();
    const newApiSecret = generateApiSecret();

    // Update apps table
    await pool.query(
      `UPDATE apps
       SET api_key = ?, api_secret = ?
       WHERE id = ?`,
      [newApiKey, newApiSecret, id]
    );

    // Also update saas_apps table
    await pool.query(
      `UPDATE saas_apps
       SET api_key = ?, api_secret = ?
       WHERE id = ?`,
      [newApiKey, newApiSecret, id]
    );

    return {
      id,
      app_name: existing.app_name || existing.name,
      api_key: newApiKey,
      api_secret: newApiSecret,
      status: existing.status,
      is_active: existing.is_active,
      updated_at: new Date()
    };
  }

  /**
   * Disables or enables an application's API key
   */
  static async setAppStatus(id, { isActive, status }) {
    const existing = await this.getAppById(id);
    if (!existing) {
      throw new Error(`Application with ID "${id}" not found`);
    }

    const newIsActive = isActive !== undefined ? Boolean(isActive) : (status ? status === 'ACTIVE' : true);
    const newStatus = status || (newIsActive ? 'ACTIVE' : 'DISABLED');

    await pool.query(
      `UPDATE apps
       SET is_active = ?, status = ?
       WHERE id = ?`,
      [newIsActive, newStatus, id]
    );

    return {
      id,
      app_name: existing.app_name || existing.name,
      api_key: existing.api_key,
      is_active: newIsActive,
      status: newStatus
    };
  }

  // ==========================================
  // PHASE 6: WEBHOOK LOGS
  // ==========================================

  /**
   * Saves a webhook delivery attempt in webhook_logs
   */
  static async saveWebhookLog({ appId, event, payload, targetUrl, statusCode = null, responseBody = null, success = false, attempts = 1 }) {
    const id = `whl_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const payloadJson = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const responseStr = responseBody ? String(responseBody).slice(0, 1000) : null;

    await pool.query(
      `INSERT INTO webhook_logs (id, app_id, event, payload, target_url, status_code, response_body, success, attempts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, appId, event, payloadJson, targetUrl, statusCode, responseStr, success, attempts]
    );

    return { id, appId, event, targetUrl, success, statusCode };
  }

  /**
   * Retrieves recent webhook logs for an app
   */
  static async getWebhookLogs(appId, limit = 50) {
    const [rows] = await pool.query(
      `SELECT id, app_id, event, payload, target_url, status_code, response_body, success, attempts, created_at
       FROM webhook_logs
       WHERE app_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [appId, Number(limit) || 50]
    );
    return rows.map(r => ({
      ...r,
      payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload
    }));
  }

  // ==========================================
  // PHASE 7: SYNC HISTORY & STATUS
  // ==========================================

  /**
   * Retrieves connection sync history, total records synced, and errors
   */
  static async getConnectionSyncHistory(connectionId) {
    const connection = await this.getConnectionById(connectionId);
    if (!connection) return null;

    // 1. Fetch recent sync jobs
    const [jobs] = await pool.query(
      `SELECT id, connection_id, entity_type, status, created_at, completed_at
       FROM sync_jobs
       WHERE connection_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [connectionId]
    );

    // 2. Fetch cached entities to determine record counts
    const [caches] = await pool.query(
      `SELECT entity_type, data_json, updated_at
       FROM entity_cache
       WHERE connection_id = ?`,
      [connectionId]
    );

    let totalRecordsSynced = 0;
    const entityCounts = {};
    for (const c of caches) {
      try {
        const parsed = typeof c.data_json === 'string' ? JSON.parse(c.data_json) : c.data_json;
        const count = Array.isArray(parsed) ? parsed.length : 0;
        entityCounts[c.entity_type] = count;
        totalRecordsSynced += count;
      } catch {
        entityCounts[c.entity_type] = 0;
      }
    }

    // 3. Compile error history from failed jobs
    const errors = jobs
      .filter(j => j.status === 'FAILED' || j.status === 'ERROR')
      .map(j => ({
        job_id: j.id,
        entity_type: j.entity_type,
        error: `Sync failed for ${j.entity_type}`,
        timestamp: j.completed_at || j.created_at
      }));

    const history = jobs.map(j => {
      const records = entityCounts[j.entity_type] || 0;
      return {
        job_id: j.id,
        entity_type: j.entity_type,
        status: j.status,
        records_synced: records,
        created_at: j.created_at,
        completed_at: j.completed_at
      };
    });

    return {
      connection_id: connectionId,
      last_sync: connection.last_sync || (history[0]?.completed_at || null),
      status: connection.status,
      records_synced: totalRecordsSynced,
      errors,
      history
    };
  }
}


