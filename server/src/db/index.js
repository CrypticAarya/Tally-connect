import pg from 'pg';
import crypto from 'crypto';
import { config } from '../config.js';

const { Pool } = pg;

export const pool = new Pool({
  host: config.db?.host || process.env.PGHOST || 'localhost',
  port: config.db?.port || parseInt(process.env.PGPORT || '5432', 10),
  database: config.db?.database || process.env.PGDATABASE || 'tally_connect',
  user: config.db?.user || process.env.PGUSER || process.env.USER || 'eunoia',
  password: config.db?.password || process.env.PGPASSWORD || '',
  max: 15,
  idleTimeoutMillis: 30000
});

pool.on('error', (err) => {
  console.error('[Database Pool Error]:', err.message);
});

/**
 * Executes a parameterised query
 */
export async function query(text, params) {
  return pool.query(text, params);
}

/**
 * Computes SHA-256 hash of a plain text secret token
 */
export function hashSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/**
 * Generates a cryptographically secure token
 */
export function generateToken(prefix = 'tok_live_') {
  return `${prefix}${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * PBKDF2 Password hashing with cryptographic salt
 */
export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies a password against the stored salt:hash
 */
export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  const candidateHash = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
  return candidateHash === originalHash;
}

/**
 * Initializes database tables and indices for Tally Connect Beta Hardening
 */
export async function initDb() {
  console.log('[Database] Initializing PostgreSQL schema for Tally Connect multi-tenant engine...');

  const ddl = `
    -- 1. Tenants table
    CREATE TABLE IF NOT EXISTS tenants (
      id VARCHAR(64) PRIMARY KEY,
      "companyName" VARCHAR(255) NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- 2. Users table (Phase 2 Step 2)
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      "tenantId" VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      "passwordHash" VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'admin',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- 3. Sessions table (Phase 2 Step 2)
    CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(128) PRIMARY KEY,
      "userId" VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "tenantId" VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- 4. Connectors table
    CREATE TABLE IF NOT EXISTS connectors (
      id VARCHAR(64) PRIMARY KEY,
      "tenantId" VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      "connectorId" VARCHAR(100) NOT NULL UNIQUE,
      "secretHash" VARCHAR(128) NOT NULL,
      "machineName" VARCHAR(255),
      status VARCHAR(32) NOT NULL DEFAULT 'OFFLINE',
      "lastHeartbeat" TIMESTAMPTZ,
      "activeCompany" VARCHAR(255),
      "agentVersion" VARCHAR(32) DEFAULT '1.0.0-beta',
      "lastError" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- 5. ExportJobs table
    CREATE TABLE IF NOT EXISTS "exportJobs" (
      id VARCHAR(64) PRIMARY KEY,
      "tenantId" VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      "connectorId" VARCHAR(100) NOT NULL,
      dataset VARCHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "completedAt" TIMESTAMPTZ,
      "expiresAt" TIMESTAMPTZ,
      "retryCount" INTEGER DEFAULT 0,
      "rowCount" INTEGER DEFAULT 0,
      filename VARCHAR(255),
      "fileKey" VARCHAR(255),
      "sizeBytes" BIGINT,
      filters JSONB DEFAULT '{}'::jsonb,
      preview JSONB DEFAULT '[]'::jsonb,
      error TEXT
    );

    -- Ensure missing columns are added if tables already existed
    ALTER TABLE connectors ADD COLUMN IF NOT EXISTS "agentVersion" VARCHAR(32) DEFAULT '1.0.0-beta';
    ALTER TABLE connectors ADD COLUMN IF NOT EXISTS "lastError" TEXT;
    ALTER TABLE "exportJobs" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMPTZ;
    ALTER TABLE "exportJobs" ADD COLUMN IF NOT EXISTS "retryCount" INTEGER DEFAULT 0;

    -- 6. Audit Logs table (Phase 3 Step 1)
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(64) PRIMARY KEY,
      "tenantId" VARCHAR(64) REFERENCES tenants(id) ON DELETE CASCADE,
      "userId" VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(64) NOT NULL,
      metadata JSONB DEFAULT '{}'::jsonb,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- 7. Pilot Customers Tracking Table (Phase 3 Step 2)
    CREATE TABLE IF NOT EXISTS pilot_customers (
      id VARCHAR(64) PRIMARY KEY,
      "tenantId" VARCHAR(64) NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
      "customerName" VARCHAR(255) NOT NULL,
      "companyName" VARCHAR(255) NOT NULL,
      "contactEmail" VARCHAR(255) NOT NULL,
      industry VARCHAR(128) NOT NULL DEFAULT 'General Trade & Manufacturing',
      "tallyVersion" VARCHAR(64) DEFAULT 'TallyPrime 4.1',
      "dataSizeBytes" BIGINT DEFAULT 0,
      "dataSizeCategory" VARCHAR(64) DEFAULT 'Medium (< 100k vouchers)',
      "connectorStatus" VARCHAR(32) DEFAULT 'PENDING',
      "firstExportAt" TIMESTAMPTZ,
      stage VARCHAR(64) DEFAULT 'DAY_0_INSTALLATION',
      "installedAt" TIMESTAMPTZ,
      "activatedAt" TIMESTAMPTZ,
      notes TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- 8. Customer Feedback, Issues & Feature Requests (Phase 3 Step 2)
    CREATE TABLE IF NOT EXISTS customer_feedback (
      id VARCHAR(64) PRIMARY KEY,
      "tenantId" VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      "userId" VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
      type VARCHAR(32) NOT NULL DEFAULT 'ISSUE',
      severity VARCHAR(32) DEFAULT 'MEDIUM',
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      status VARCHAR(32) DEFAULT 'OPEN',
      resolution TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Indices for high performance queries and isolation
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_tenant ON users("tenantId");
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions("userId");
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions("expiresAt");
    CREATE INDEX IF NOT EXISTS idx_connectors_tenant ON connectors("tenantId");
    CREATE INDEX IF NOT EXISTS idx_connectors_conn_id ON connectors("connectorId");
    CREATE INDEX IF NOT EXISTS idx_exportjobs_tenant ON "exportJobs"("tenantId");
    CREATE INDEX IF NOT EXISTS idx_exportjobs_conn ON "exportJobs"("connectorId");
    CREATE INDEX IF NOT EXISTS idx_exportjobs_status ON "exportJobs"(status);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs("tenantId");
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_pilot_customers_tenant ON pilot_customers("tenantId");
    CREATE INDEX IF NOT EXISTS idx_pilot_customers_stage ON pilot_customers(stage);
    CREATE INDEX IF NOT EXISTS idx_customer_feedback_tenant ON customer_feedback("tenantId");
    CREATE INDEX IF NOT EXISTS idx_customer_feedback_type ON customer_feedback(type);
    CREATE INDEX IF NOT EXISTS idx_customer_feedback_status ON customer_feedback(status);
  `;

  await pool.query(ddl);

  // Pre-seed default demo tenant, user & connector to maintain backwards compatibility
  const defaultTenantId = 'ten_default';
  const defaultConnectorId = 'conn_mumbai_hq_01';
  const defaultSecret = 'sec_beta_mumbai_9f8e7d';
  const defaultSecretHash = hashSecret(defaultSecret);

  await pool.query(`
    INSERT INTO tenants (id, "companyName", "createdAt")
    VALUES ($1, $2, NOW())
    ON CONFLICT (id) DO NOTHING;
  `, [defaultTenantId, 'National Trading Corporation (Beta Default)']);

  // Pre-seed default admin user
  const defaultPasswordHash = hashPassword('Admin@123');
  await pool.query(`
    INSERT INTO users (id, "tenantId", name, email, "passwordHash", role, "createdAt")
    VALUES ('usr_default_admin', $1, 'System Admin', 'admin@tallyconnect.local', $2, 'admin', NOW())
    ON CONFLICT (email) DO NOTHING;
  `, [defaultTenantId, defaultPasswordHash]);

  await pool.query(`
    INSERT INTO connectors (id, "tenantId", "connectorId", "secretHash", status, "machineName", "activeCompany", "agentVersion")
    VALUES ($1, $2, $3, $4, 'OFFLINE', 'HQ-Primary', 'National Trading Corporation', '1.0.0-beta')
    ON CONFLICT ("connectorId") DO UPDATE SET "secretHash" = EXCLUDED."secretHash";
  `, ['conn_reg_default_01', defaultTenantId, defaultConnectorId, defaultSecretHash]);

  console.log('[Database] ✔ PostgreSQL schema ready with User Auth and Hardened Connectors.');
}
