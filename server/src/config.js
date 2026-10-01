import path from 'path';
import { fileURLToPath } from 'url';
import './config/envLoader.js';
import { getActiveEnvironment, ENVIRONMENTS } from './config/environments.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const activeEnv = getActiveEnvironment();
export function getIsProduction() {
  const env = (process.env.NODE_ENV || activeEnv.name || 'development').toLowerCase();
  return env === 'production';
}

export function getMockMode() {
  const isProd = getIsProduction();
  return process.env.MOCK_MODE !== undefined
    ? (process.env.MOCK_MODE === 'true' && !isProd)
    : (!isProd);
}

export const isProduction = getIsProduction();
export const isMockMode = getMockMode();

export const config = {
  get isProduction() {
    return getIsProduction();
  },
  get mockMode() {
    return getMockMode();
  },
  activeEnvironment: activeEnv.name,
  displayName: activeEnv.displayName,
  apiDomain: process.env.API_DOMAIN || 'api.tallyconnect.cloud',
  agentCloudUrl: process.env.AGENT_CLOUD_URL || process.env.CLOUD_URL || (process.env.API_DOMAIN ? `https://${process.env.API_DOMAIN}` : 'http://127.0.0.1:5001'),
  server: {
    port: parseInt(process.env.PORT || activeEnv.server.port || '5001', 10),
    host: process.env.HOST || activeEnv.server.host || '0.0.0.0',
    env: process.env.NODE_ENV || activeEnv.name,
    corsOrigins: activeEnv.server.corsOrigins
  },
  urls: {
    apiUrl: process.env.API_URL || (process.env.API_DOMAIN ? `https://${process.env.API_DOMAIN}` : activeEnv.urls.apiUrl),
    clientUrl: process.env.CLIENT_URL || activeEnv.urls.clientUrl,
    agentEndpoint: process.env.AGENT_ENDPOINT || (process.env.API_DOMAIN ? `https://${process.env.API_DOMAIN}/api/connector` : activeEnv.urls.agentEndpoint)
  },
  databaseUrl: process.env.DATABASE_URL || null,
  db: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root',
    database: process.env.MYSQL_DATABASE || 'tally_connect'
  },
  pg: {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || process.env.USER || 'eunoia',
    password: process.env.PGPASSWORD || '',
    database: process.env.PGDATABASE || 'tally_connect'
  },
  secrets: {
    apiMasterSecret: process.env.API_MASTER_SECRET || 'tc_sec_master_f4b7a1928374650192837465',
    jwtSecret: process.env.JWT_SECRET || 'tc_jwt_secret_99887766554433221100',
    encryptionKey: process.env.ENCRYPTION_KEY || 'tc_enc_key_0123456789abcdef0123456789abcdef',
    webhookSigningSecret: process.env.WEBHOOK_SIGNING_SECRET || 'tc_wh_sign_sec_a1b2c3d4e5f6'
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '120', 10)
  },
  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),
    pollIntervalMs: parseInt(process.env.QUEUE_POLL_INTERVAL_MS || '3000', 10),
    maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES || '3', 10)
  },
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    bucket: process.env.STORAGE_BUCKET || 'tally-connect-production',
    exportsDir: process.env.STORAGE_LOCAL_DIR
      ? path.resolve(process.env.STORAGE_LOCAL_DIR)
      : (activeEnv.storage.exportsDir || path.resolve(__dirname, '../storage/exports')),
    downloadRetentionDays: activeEnv.storage.downloadRetentionDays || 7,
    maxExportRows: activeEnv.storage.maxExportRows || 500000
  },
  connector: {
    mode: process.env.CONNECTOR_MODE || activeEnv.connector.mode || 'xml_http',
    agentId: 'tc-agent-local-01',
    agentVersion: '1.0.0-beta',
    tallyHost: process.env.TALLY_HOST || activeEnv.connector.tallyHost || '127.0.0.1',
    tallyPort: parseInt(process.env.TALLY_PORT || activeEnv.connector.tallyPort || '9000', 10),
    companyName: process.env.TALLY_COMPANY || null,
    defaultHeartbeatInterval: activeEnv.connector.defaultHeartbeatInterval,
    offlineTimeoutSeconds: activeEnv.connector.offlineTimeoutSeconds
  },
  datasets: {
    CUSTOMER: 'CUSTOMER',
    CHART_OF_ACCOUNTS: 'CHART_OF_ACCOUNTS',
    SALES_REGISTER: 'SALES_REGISTER',
    TRIAL_BALANCE: 'TRIAL_BALANCE'
  },
  allEnvironments: ENVIRONMENTS
};
