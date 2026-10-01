import mysql from 'mysql2/promise';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getPoolConfig() {
  if (process.env.DATABASE_URL) {
    try {
      const parsedUrl = new URL(process.env.DATABASE_URL);
      return {
        host: parsedUrl.hostname,
        port: parseInt(parsedUrl.port || '3306', 10),
        user: decodeURIComponent(parsedUrl.username),
        password: decodeURIComponent(parsedUrl.password),
        database: parsedUrl.pathname.replace(/^\//, ''),
        waitForConnections: true,
        connectionLimit: 15,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
      };
    } catch {
      return {
        uri: process.env.DATABASE_URL,
        waitForConnections: true,
        connectionLimit: 15,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
      };
    }
  }

  return {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root',
    database: process.env.MYSQL_DATABASE || 'tally_connect',
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  };
}

export const pool = mysql.createPool(getPoolConfig());

/**
 * Executes a parameterized MySQL query
 * @param {string} sql - SQL query string with ? placeholders
 * @param {Array<any>} [params] - Parameter values
 * @returns {Promise<[any, any]>}
 */
export async function query(sql, params = []) {
  return pool.query(sql, params);
}

/**
 * Generates an API key (e.g. tc_live_8f39b1a0...)
 */
export function generateApiKey(prefix = 'tc_live_') {
  return `${prefix}${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Generates an API secret (e.g. sec_live_948f2a1...)
 */
export function generateApiSecret(prefix = 'sec_live_') {
  return `${prefix}${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * Generates a SHA-256 hash of a string
 */
/**
 * Generates a SHA-256 hash of a string
 */
export function hashSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/**
 * Generates a PBKDF2 salt:hash for developer passwords
 */
export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies developer password against stored salt:hash
 */
export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === originalHash;
}

/**
 * Initializes the MySQL database tables
 */
export async function initMySqlDb() {
  console.log('[MySQL] Initializing database tables for Tally Connect Integration Platform...');

  const rawSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  // Strip SQL single-line comments (-- ...)
  const cleanSql = rawSql.replace(/--.*$/gm, '');
  const statements = cleanSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (err) {
      console.error(`[MySQL] Error executing statement: ${statement.slice(0, 60)}...`, err.message);
      throw err;
    }
  }

  // Safe column migration for sync_jobs
  try {
    await pool.query(`ALTER TABLE sync_jobs ADD COLUMN retry_count INT NOT NULL DEFAULT 0`);
  } catch {}
  try {
    await pool.query(`ALTER TABLE sync_jobs ADD COLUMN max_retries INT NOT NULL DEFAULT 3`);
  } catch {}
  try {
    await pool.query(`ALTER TABLE sync_jobs ADD COLUMN error_message TEXT NULL`);
  } catch {}

  // Safe column migration for permissions (Phase 8.5)
  try {
    await pool.query(`ALTER TABLE permissions ADD COLUMN allow_vendors BOOLEAN NOT NULL DEFAULT TRUE`);
  } catch {}
  try {
    await pool.query(`ALTER TABLE permissions ADD COLUMN allow_orders BOOLEAN NOT NULL DEFAULT FALSE`);
  } catch {}
  try {
    await pool.query(`ALTER TABLE permissions ADD COLUMN allow_delivery_notes BOOLEAN NOT NULL DEFAULT FALSE`);
  } catch {}
  try {
    await pool.query(`ALTER TABLE permissions ADD COLUMN allow_receipt_notes BOOLEAN NOT NULL DEFAULT FALSE`);
  } catch {}

  // Pre-seed a default demo SaaS app if table is empty
  const [existingApps] = await pool.query('SELECT id FROM saas_apps LIMIT 1');
  if (existingApps.length === 0) {
    const defaultAppId = 'app_demo_fintech';
    const defaultApiKey = 'tc_live_fintech_7a8b9c0d1e2f';
    const defaultSecret = 'sec_live_fintech_99a8b7c6d5e4';

    await pool.query(
      `INSERT INTO saas_apps (id, name, api_key, api_secret, redirect_url)
       VALUES (?, ?, ?, ?, ?)`,
      [defaultAppId, 'Fintech Analytics Platform (Default)', defaultApiKey, defaultSecret, 'https://app.fintechplatform.com/callback']
    );
    console.log('[MySQL] ✔ Seeded default SaaS application: Fintech Analytics Platform');
  }

  console.log('[MySQL] ✔ All 10 MySQL tables ready (saas_apps, connections, agents, permissions, sync_jobs, entity_cache, developers, apps, webhook_logs, api_usage_logs).');
}
