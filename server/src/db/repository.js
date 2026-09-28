import crypto from 'crypto';
import { query, hashSecret, generateToken, hashPassword, verifyPassword } from './index.js';

export const Repository = {
  // ==========================================
  // 1. TENANTS
  // ==========================================

  async createTenant(companyName) {
    if (!companyName || typeof companyName !== 'string') {
      throw new Error('Tenant creation requires a valid "companyName"');
    }
    const tenantId = `ten_${crypto.randomBytes(6).toString('hex')}`;
    const sql = `
      INSERT INTO tenants (id, "companyName", "createdAt")
      VALUES ($1, $2, NOW())
      RETURNING id, "companyName", "createdAt";
    `;
    const res = await query(sql, [tenantId, companyName.trim()]);
    return res.rows[0];
  },

  async getTenant(tenantId) {
    const res = await query('SELECT id, "companyName", "createdAt" FROM tenants WHERE id = $1', [tenantId]);
    return res.rows[0] || null;
  },

  async listTenants() {
    const res = await query('SELECT id, "companyName", "createdAt" FROM tenants ORDER BY "createdAt" DESC');
    return res.rows;
  },

  // ==========================================
  // 2. USERS & SESSIONS (Phase 2 Step 2)
  // ==========================================

  async createUser({ tenantId, name, email, password, role = 'admin' }) {
    if (!tenantId || !name || !email || !password) {
      throw new Error('User creation requires tenantId, name, email, and password');
    }
    const userId = `usr_${crypto.randomBytes(6).toString('hex')}`;
    const passwordHash = hashPassword(password);

    const sql = `
      INSERT INTO users (id, "tenantId", name, email, "passwordHash", role, "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id, "tenantId", name, email, role, "createdAt";
    `;
    const res = await query(sql, [userId, tenantId, name.trim(), email.toLowerCase().trim(), passwordHash, role]);
    return res.rows[0];
  },

  async findUserByEmail(email) {
    const sql = `
      SELECT u.id, u."tenantId", u.name, u.email, u."passwordHash", u.role, u."createdAt",
             t."companyName"
      FROM users u
      JOIN tenants t ON u."tenantId" = t.id
      WHERE u.email = $1;
    `;
    const res = await query(sql, [email.toLowerCase().trim()]);
    return res.rows[0] || null;
  },

  async authenticateUser(email, password) {
    const user = await this.findUserByEmail(email);
    if (!user) return null;

    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) return null;

    // Do not return passwordHash
    const { passwordHash, ...cleanUser } = user;
    return cleanUser;
  },

  async createSession(userId, tenantId, durationDays = 7) {
    const token = `sess_${crypto.randomBytes(32).toString('hex')}`;
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    const sql = `
      INSERT INTO sessions (id, "userId", "tenantId", "expiresAt", "createdAt")
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, "userId", "tenantId", "expiresAt";
    `;
    const res = await query(sql, [token, userId, tenantId, expiresAt.toISOString()]);
    return res.rows[0];
  },

  async getSession(token) {
    if (!token) return null;
    const sql = `
      SELECT s.id as token, s."userId", s."tenantId", s."expiresAt",
             u.name as "userName", u.email as "userEmail", u.role as "userRole",
             t."companyName"
      FROM sessions s
      JOIN users u ON s."userId" = u.id
      JOIN tenants t ON s."tenantId" = t.id
      WHERE s.id = $1 AND s."expiresAt" > NOW();
    `;
    const res = await query(sql, [token]);
    return res.rows[0] || null;
  },

  async deleteSession(token) {
    await query('DELETE FROM sessions WHERE id = $1', [token]);
    return { success: true };
  },

  // ==========================================
  // 3. CONNECTORS & HEALTH
  // ==========================================

  async provisionConnector(tenantId, customConnectorId = null) {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      throw new Error(`Cannot provision connector: Tenant "${tenantId}" not found`);
    }

    const regId = `creg_${crypto.randomBytes(6).toString('hex')}`;
    const connectorId = customConnectorId
      ? customConnectorId.trim()
      : `conn_${tenant.companyName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 15)}_${crypto.randomBytes(4).toString('hex')}`;

    const plainToken = generateToken('tok_beta_');
    const secretHash = hashSecret(plainToken);

    const sql = `
      INSERT INTO connectors (id, "tenantId", "connectorId", "secretHash", status, "machineName", "activeCompany", "agentVersion")
      VALUES ($1, $2, $3, $4, 'OFFLINE', NULL, NULL, '1.0.0-beta')
      RETURNING id, "tenantId", "connectorId", status, "createdAt";
    `;
    const res = await query(sql, [regId, tenantId, connectorId, secretHash]);
    const created = res.rows[0];

    return {
      connectorId: created.connectorId,
      tenantId: created.tenantId,
      token: plainToken, // Shown once
      status: created.status,
      message: 'Configure this connectorId and secret token in the desktop connector agent config.json'
    };
  },

  async listConnectorsForTenant(tenantId) {
    const sql = `
      SELECT id, "tenantId", "connectorId", status, "machineName", "activeCompany", "agentVersion", "lastError", "lastHeartbeat", "createdAt"
      FROM connectors
      WHERE "tenantId" = $1
      ORDER BY "createdAt" DESC;
    `;
    const res = await query(sql, [tenantId]);

    // Dynamic offline detection: If lastHeartbeat > 90 seconds ago, mark OFFLINE
    const now = Date.now();
    return res.rows.map(row => {
      const lastSeenMs = row.lastHeartbeat ? new Date(row.lastHeartbeat).getTime() : 0;
      const isStale = (now - lastSeenMs) > 90000; // 90 seconds timeout
      let effectiveStatus = row.status;
      let errorReason = row.lastError;

      if (row.status === 'ONLINE' && isStale) {
        effectiveStatus = 'OFFLINE';
        errorReason = 'Heartbeat timed out (> 90s without pulse)';
      }

      return {
        ...row,
        status: effectiveStatus,
        isOnline: effectiveStatus === 'ONLINE',
        lastSeenSecondsAgo: row.lastHeartbeat ? Math.floor((now - lastSeenMs) / 1000) : null,
        errorReason
      };
    });
  },

  async findConnector(connectorId) {
    const sql = `
      SELECT c.*, t."companyName"
      FROM connectors c
      JOIN tenants t ON c."tenantId" = t.id
      WHERE c."connectorId" = $1;
    `;
    const res = await query(sql, [connectorId]);
    return res.rows[0] || null;
  },

  async authenticateConnector(connectorId, rawToken) {
    if (!connectorId || !rawToken) return null;

    const connector = await this.findConnector(connectorId);
    if (!connector) return null;

    const candidateHash = hashSecret(rawToken);
    if (candidateHash !== connector.secretHash) {
      return null;
    }

    return connector;
  },

  async registerConnector(connectorId, machineName, agentVersion = '1.0.0-beta') {
    const sql = `
      UPDATE connectors
      SET status = 'ONLINE',
          "machineName" = $2,
          "agentVersion" = COALESCE($3, "agentVersion"),
          "lastError" = NULL,
          "lastHeartbeat" = NOW()
      WHERE "connectorId" = $1
      RETURNING *;
    `;
    const res = await query(sql, [connectorId, machineName, agentVersion]);
    return res.rows[0] || null;
  },

  async updateHeartbeat(connectorId, { machineName, tallyStatus, activeCompany, agentVersion, lastError }) {
    const isTallyUp = tallyStatus === 'ONLINE' || tallyStatus === 'CONNECTED';
    const status = isTallyUp ? 'ONLINE' : 'DEGRADED';
    const sql = `
      UPDATE connectors
      SET status = $2,
          "machineName" = COALESCE($3, "machineName"),
          "activeCompany" = COALESCE($4, "activeCompany"),
          "agentVersion" = COALESCE($5, "agentVersion"),
          "lastError" = $6,
          "lastHeartbeat" = NOW()
      WHERE "connectorId" = $1
      RETURNING *;
    `;
    const res = await query(sql, [connectorId, status, machineName, activeCompany, agentVersion, lastError || null]);
    return res.rows[0] || null;
  },

  // ==========================================
  // 4. EXPORT JOBS & LIFECYCLE
  // ==========================================

  async createExportJob({ tenantId, connectorId, dataset, filters = {} }) {
    const jobId = `job_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const sql = `
      INSERT INTO "exportJobs" (id, "tenantId", "connectorId", dataset, status, filters, "createdAt")
      VALUES ($1, $2, $3, $4, 'PENDING', $5, NOW())
      RETURNING *;
    `;
    const res = await query(sql, [jobId, tenantId, connectorId, dataset, JSON.stringify(filters)]);
    return res.rows[0];
  },

  async getPendingJobsForConnector(connectorId, tenantId) {
    const sql = `
      SELECT id, "tenantId", "connectorId", dataset, filters, status, "createdAt"
      FROM "exportJobs"
      WHERE "connectorId" = $1
        AND "tenantId" = $2
        AND status = 'PENDING'
      ORDER BY "createdAt" ASC;
    `;
    const res = await query(sql, [connectorId, tenantId]);
    return res.rows;
  },

  async getJobById(jobId, tenantId = null) {
    let sql = 'SELECT * FROM "exportJobs" WHERE id = $1';
    const params = [jobId];

    if (tenantId) {
      sql += ' AND "tenantId" = $2';
      params.push(tenantId);
    }

    const res = await query(sql, params);
    const job = res.rows[0] || null;

    if (job) {
      // Check download expiry (7 days)
      const isExpired = job.expiresAt ? new Date(job.expiresAt) < new Date() : false;
      job.isDownloadExpired = isExpired;
    }

    return job;
  },

  async updateJobStatus(jobId, connectorId, tenantId, payload = {}) {
    const { status, rowCount, filename, fileKey, sizeBytes, preview, error } = payload;

    const existing = await this.getJobById(jobId);
    if (!existing) {
      throw new Error(`Job "${jobId}" not found`);
    }

    if (existing.tenantId !== tenantId || existing.connectorId !== connectorId) {
      const err = new Error(`Job isolation violation: Job "${jobId}" belongs to tenant "${existing.tenantId}", not "${tenantId}"`);
      err.code = 'TENANT_ISOLATION_VIOLATION';
      throw err;
    }

    const isComplete = status === 'COMPLETED';
    const expiresAt = isComplete ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null;

    const sql = `
      UPDATE "exportJobs"
      SET status = $2,
          "rowCount" = COALESCE($3, "rowCount"),
          filename = COALESCE($4, filename),
          "fileKey" = COALESCE($5, "fileKey"),
          "sizeBytes" = COALESCE($6, "sizeBytes"),
          preview = COALESCE($7, preview),
          error = COALESCE($8, error),
          "completedAt" = CASE WHEN $9::boolean THEN NOW() ELSE "completedAt" END,
          "expiresAt" = CASE WHEN $9::boolean THEN $10::timestamptz ELSE "expiresAt" END
      WHERE id = $1
      RETURNING *;
    `;

    const res = await query(sql, [
      jobId,
      status,
      rowCount != null ? Number(rowCount) : null,
      filename || null,
      fileKey || null,
      sizeBytes != null ? Number(sizeBytes) : null,
      preview ? JSON.stringify(preview) : null,
      error || null,
      isComplete,
      expiresAt ? expiresAt.toISOString() : null
    ]);

    return res.rows[0];
  },

  /**
   * Resets a failed export job for re-execution
   */
  async retryFailedJob(jobId, tenantId) {
    const existing = await this.getJobById(jobId, tenantId);
    if (!existing) {
      throw new Error(`Job "${jobId}" not found`);
    }

    if (existing.status !== 'FAILED') {
      throw new Error(`Only FAILED jobs can be retried. Current status is ${existing.status}`);
    }

    const sql = `
      UPDATE "exportJobs"
      SET status = 'PENDING',
          error = NULL,
          "retryCount" = "retryCount" + 1,
          "completedAt" = NULL,
          "expiresAt" = NULL
      WHERE id = $1 AND "tenantId" = $2
      RETURNING *;
    `;
    const res = await query(sql, [jobId, tenantId]);
    return res.rows[0];
  },

  /**
   * Searches and filters export jobs for a tenant
   */
  async searchExportJobs({ tenantId, dataset, status, search, limit = 50 }) {
    let sql = 'SELECT * FROM "exportJobs" WHERE 1=1';
    const params = [];

    if (tenantId) {
      params.push(tenantId);
      sql += ` AND "tenantId" = $${params.length}`;
    }

    if (dataset) {
      params.push(dataset);
      sql += ` AND dataset = $${params.length}`;
    }

    if (status) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (id ILIKE $${params.length} OR filename ILIKE $${params.length} OR dataset ILIKE $${params.length})`;
    }

    sql += ' ORDER BY "createdAt" DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const res = await query(sql, params);
    const now = new Date();
    return res.rows.map(job => ({
      ...job,
      isDownloadExpired: job.expiresAt ? new Date(job.expiresAt) < now : false
    }));
  },

  async listRecentJobs(tenantId = null, limit = 20) {
    return this.searchExportJobs({ tenantId, limit });
  },

  // ==========================================
  // 5. AUDIT LOGGING (Phase 3 Step 1)
  // ==========================================

  async logAudit({ tenantId, userId = null, action, metadata = {} }) {
    try {
      const id = `aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const sql = `
        INSERT INTO audit_logs (id, "tenantId", "userId", action, metadata, timestamp)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *;
      `;
      const res = await query(sql, [id, tenantId, userId, action, JSON.stringify(metadata)]);
      return res.rows[0];
    } catch (err) {
      console.error('[AuditLog Error]:', err.message);
      return null;
    }
  },

  async getAuditLogs({ tenantId = null, action = null, limit = 50 } = {}) {
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (tenantId) {
      params.push(tenantId);
      sql += ` AND "tenantId" = $${params.length}`;
    }

    if (action) {
      params.push(action);
      sql += ` AND action = $${params.length}`;
    }

    sql += ' ORDER BY timestamp DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const res = await query(sql, params);
    return res.rows;
  },

  // ==========================================
  // 6. PILOT TRACKING & WORKFLOW (Phase 3 Step 2)
  // ==========================================

  async upsertPilotCustomer({
    tenantId,
    customerName,
    companyName,
    contactEmail,
    industry = 'General Trade & Manufacturing',
    tallyVersion = 'TallyPrime 4.1',
    dataSizeBytes = 0,
    dataSizeCategory = 'Medium (< 100k vouchers)',
    stage = 'DAY_0_INSTALLATION',
    notes = ''
  }) {
    const id = `pilot_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const sql = `
      INSERT INTO pilot_customers (
        id, "tenantId", "customerName", "companyName", "contactEmail",
        industry, "tallyVersion", "dataSizeBytes", "dataSizeCategory",
        stage, notes, "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      ON CONFLICT ("tenantId") DO UPDATE SET
        "customerName" = EXCLUDED."customerName",
        "companyName" = EXCLUDED."companyName",
        "contactEmail" = EXCLUDED."contactEmail",
        industry = EXCLUDED.industry,
        "tallyVersion" = EXCLUDED."tallyVersion",
        "dataSizeBytes" = EXCLUDED."dataSizeBytes",
        "dataSizeCategory" = EXCLUDED."dataSizeCategory",
        notes = EXCLUDED.notes,
        "updatedAt" = NOW()
      RETURNING *;
    `;
    const res = await query(sql, [
      id, tenantId, customerName, companyName, contactEmail,
      industry, tallyVersion, dataSizeBytes, dataSizeCategory,
      stage, notes
    ]);
    return res.rows[0];
  },

  async getPilotCustomer(tenantId) {
    const res = await query('SELECT * FROM pilot_customers WHERE "tenantId" = $1', [tenantId]);
    return res.rows[0] || null;
  },

  async listPilotCustomers() {
    const sql = `
      SELECT 
        p.*,
        COALESCE(c.status, 'PENDING') AS "connectorLiveStatus",
        c."lastHeartbeat",
        c."agentVersion",
        c."machineName",
        (SELECT COUNT(*) FROM customer_feedback f WHERE f."tenantId" = p."tenantId")::int AS "issuesCount",
        (SELECT COUNT(*) FROM "exportJobs" j WHERE j."tenantId" = p."tenantId" AND j.status = 'COMPLETED')::int AS "completedExportsCount",
        (SELECT COUNT(*) FROM "exportJobs" j WHERE j."tenantId" = p."tenantId" AND j.status = 'FAILED')::int AS "failedExportsCount"
      FROM pilot_customers p
      LEFT JOIN connectors c ON c."tenantId" = p."tenantId"
      ORDER BY p."createdAt" ASC;
    `;
    const res = await query(sql);
    return res.rows;
  },

  async updatePilotStage(tenantId, stage) {
    const sql = `
      UPDATE pilot_customers
      SET stage = $2, "updatedAt" = NOW()
      WHERE "tenantId" = $1
      RETURNING *;
    `;
    const res = await query(sql, [tenantId, stage]);
    return res.rows[0] || null;
  },

  async updatePilotFirstExport(tenantId, timestamp = new Date()) {
    const sql = `
      UPDATE pilot_customers
      SET "firstExportAt" = COALESCE("firstExportAt", $2),
          stage = CASE 
            WHEN stage IN ('DAY_0_INSTALLATION', 'DAY_1_FIRST_EXPORT') THEN 'WEEK_1_REVIEW_USAGE'
            ELSE stage 
          END,
          "updatedAt" = NOW()
      WHERE "tenantId" = $1
      RETURNING *;
    `;
    const res = await query(sql, [tenantId, timestamp]);
    return res.rows[0] || null;
  },

  // ==========================================
  // 7. CUSTOMER FEEDBACK & ISSUES (Phase 3 Step 2)
  // ==========================================

  async createFeedback({ tenantId, userId = null, type = 'ISSUE', severity = 'MEDIUM', title, description }) {
    const id = `fb_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const sql = `
      INSERT INTO customer_feedback (id, "tenantId", "userId", type, severity, title, description, status, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN', NOW(), NOW())
      RETURNING *;
    `;
    const res = await query(sql, [id, tenantId, userId, type, severity, title, description]);
    return res.rows[0];
  },

  async listFeedback({ tenantId = null, type = null, status = null, limit = 50 } = {}) {
    let sql = `
      SELECT f.*, p."companyName", p."customerName"
      FROM customer_feedback f
      LEFT JOIN pilot_customers p ON p."tenantId" = f."tenantId"
      WHERE 1=1
    `;
    const params = [];

    if (tenantId) {
      params.push(tenantId);
      sql += ` AND f."tenantId" = $${params.length}`;
    }

    if (type) {
      params.push(type);
      sql += ` AND f.type = $${params.length}`;
    }

    if (status) {
      params.push(status);
      sql += ` AND f.status = $${params.length}`;
    }

    sql += ' ORDER BY f."createdAt" DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const res = await query(sql, params);
    return res.rows;
  },

  async updateFeedbackStatus(id, { status, resolution = null }) {
    const sql = `
      UPDATE customer_feedback
      SET status = $2, resolution = COALESCE($3, resolution), "updatedAt" = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const res = await query(sql, [id, status, resolution]);
    return res.rows[0] || null;
  }
};
