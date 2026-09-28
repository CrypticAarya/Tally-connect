/**
 * Environment Configuration Separation (Phase 3 Step 1)
 *
 * Provides dedicated configuration profiles for:
 * - Development (Local testing & rapid debugging)
 * - Staging (Pre-production pilot testing & simulation)
 * - Production (Live multi-tenant customer workload)
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ENVIRONMENTS = {
  development: {
    name: 'development',
    displayName: 'Local Development',
    server: {
      host: process.env.HOST || '0.0.0.0',
      port: parseInt(process.env.PORT || '5001', 10),
      corsOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173']
    },
    urls: {
      apiUrl: process.env.API_URL || 'http://localhost:5001',
      clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
      agentEndpoint: process.env.AGENT_ENDPOINT || 'http://localhost:5001/api/connector'
    },
    database: {
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      database: process.env.PGDATABASE || 'tally_connect',
      user: process.env.PGUSER || process.env.USER || 'eunoia',
      password: process.env.PGPASSWORD || '',
      ssl: false,
      maxPoolSize: 10,
      idleTimeoutMillis: 30000
    },
    connector: {
      mode: process.env.CONNECTOR_MODE || 'mock',
      defaultHeartbeatInterval: 30,
      offlineTimeoutSeconds: 90,
      tallyHost: process.env.TALLY_HOST || '127.0.0.1',
      tallyPort: parseInt(process.env.TALLY_PORT || '9000', 10),
      tallyTimeoutMs: 5000
    },
    storage: {
      exportsDir: path.resolve(__dirname, '../../storage/exports'),
      maxExportRows: 500000,
      downloadRetentionDays: 7
    },
    logging: {
      level: 'debug',
      enableAuditLogs: true
    }
  },

  staging: {
    name: 'staging',
    displayName: 'Staging Pilot Environment',
    server: {
      host: process.env.HOST || '0.0.0.0',
      port: parseInt(process.env.PORT || '5002', 10),
      corsOrigins: ['https://staging.tallyconnect.cloud', 'http://localhost:5173']
    },
    urls: {
      apiUrl: process.env.API_URL || 'https://staging-api.tallyconnect.cloud',
      clientUrl: process.env.CLIENT_URL || 'https://staging.tallyconnect.cloud',
      agentEndpoint: process.env.AGENT_ENDPOINT || 'https://staging-api.tallyconnect.cloud/api/connector'
    },
    database: {
      host: process.env.STAGING_PGHOST || process.env.PGHOST || 'localhost',
      port: parseInt(process.env.STAGING_PGPORT || process.env.PGPORT || '5432', 10),
      database: process.env.STAGING_PGDATABASE || 'tally_connect_staging',
      user: process.env.STAGING_PGUSER || process.env.PGUSER || 'eunoia',
      password: process.env.STAGING_PGPASSWORD || process.env.PGPASSWORD || '',
      ssl: process.env.STAGING_PGSSL === 'true',
      maxPoolSize: 20,
      idleTimeoutMillis: 10000
    },
    connector: {
      mode: process.env.CONNECTOR_MODE || 'tally',
      defaultHeartbeatInterval: 30,
      offlineTimeoutSeconds: 90,
      tallyHost: process.env.TALLY_HOST || '127.0.0.1',
      tallyPort: parseInt(process.env.TALLY_PORT || '9000', 10),
      tallyTimeoutMs: 10000
    },
    storage: {
      exportsDir: path.resolve(__dirname, '../../storage/exports'),
      maxExportRows: 1000000,
      downloadRetentionDays: 7
    },
    logging: {
      level: 'info',
      enableAuditLogs: true
    }
  },

  production: {
    name: 'production',
    displayName: 'Production Multi-Tenant Cloud',
    server: {
      host: process.env.HOST || '0.0.0.0',
      port: parseInt(process.env.PORT || '5000', 10),
      corsOrigins: ['https://app.tallyconnect.cloud']
    },
    urls: {
      apiUrl: process.env.API_URL || 'https://api.tallyconnect.cloud',
      clientUrl: process.env.CLIENT_URL || 'https://app.tallyconnect.cloud',
      agentEndpoint: process.env.AGENT_ENDPOINT || 'https://api.tallyconnect.cloud/api/connector'
    },
    database: {
      host: process.env.PROD_PGHOST || process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PROD_PGPORT || process.env.PGPORT || '5432', 10),
      database: process.env.PROD_PGDATABASE || 'tally_connect',
      user: process.env.PROD_PGUSER || process.env.PGUSER || 'eunoia',
      password: process.env.PROD_PGPASSWORD || process.env.PGPASSWORD || '',
      ssl: process.env.PROD_PGSSL === 'true',
      maxPoolSize: 50,
      idleTimeoutMillis: 10000
    },
    connector: {
      mode: 'tally',
      defaultHeartbeatInterval: 30,
      offlineTimeoutSeconds: 90,
      tallyHost: '127.0.0.1',
      tallyPort: 9000,
      tallyTimeoutMs: 15000
    },
    storage: {
      exportsDir: path.resolve(__dirname, '../../storage/exports'),
      maxExportRows: 2000000,
      downloadRetentionDays: 7
    },
    logging: {
      level: 'warn',
      enableAuditLogs: true
    }
  }
};

/**
 * Returns configuration profile according to active NODE_ENV
 */
export function getActiveEnvironment() {
  const env = (process.env.NODE_ENV || 'development').toLowerCase();
  return ENVIRONMENTS[env] || ENVIRONMENTS.development;
}
