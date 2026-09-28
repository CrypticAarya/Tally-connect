import path from 'path';
import { fileURLToPath } from 'url';
import { getActiveEnvironment, ENVIRONMENTS } from './config/environments.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const activeEnv = getActiveEnvironment();

export const config = {
  activeEnvironment: activeEnv.name,
  displayName: activeEnv.displayName,
  server: {
    port: activeEnv.server.port,
    host: activeEnv.server.host,
    env: activeEnv.name,
    corsOrigins: activeEnv.server.corsOrigins
  },
  urls: activeEnv.urls,
  db: activeEnv.database,
  connector: {
    mode: activeEnv.connector.mode,
    agentId: 'tc-agent-local-01',
    agentVersion: '1.0.0-beta',
    tallyHost: activeEnv.connector.tallyHost,
    tallyPort: activeEnv.connector.tallyPort,
    companyName: process.env.TALLY_COMPANY || 'National Trading Corporation',
    defaultHeartbeatInterval: activeEnv.connector.defaultHeartbeatInterval,
    offlineTimeoutSeconds: activeEnv.connector.offlineTimeoutSeconds
  },
  storage: {
    exportsDir: activeEnv.storage.exportsDir || path.resolve(__dirname, '../storage/exports'),
    downloadRetentionDays: activeEnv.storage.downloadRetentionDays,
    maxExportRows: activeEnv.storage.maxExportRows
  },
  datasets: {
    CUSTOMER: 'CUSTOMER',
    CHART_OF_ACCOUNTS: 'CHART_OF_ACCOUNTS',
    SALES_REGISTER: 'SALES_REGISTER',
    TRIAL_BALANCE: 'TRIAL_BALANCE'
  },
  allEnvironments: ENVIRONMENTS
};
