import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Default Public Cloud URL for Tally Connect.
 * In production/distribution builds, this points to the live Cloud API.
 * For this demo: https://ham-karen-basename-collaboration.trycloudflare.com
 */
export const DEFAULT_PUBLIC_CLOUD_URL =
  process.env.PUBLIC_CLOUD_URL ||
  process.env.BUILD_CLOUD_URL ||
  'https://ham-karen-basename-collaboration.trycloudflare.com';

/**
 * Resolves the appropriate Cloud URL based on clean precedence:
 * 1. Explicit CLI argument (--cloud-url <url>) or function argument
 * 2. Environment variables: AGENT_CLOUD_URL, CLOUD_URL, API_DOMAIN
 * 3. Existing local config.json (if already present and configured)
 * 4. Configured Default Public Cloud URL
 *
 * @param {string} [explicitUrl]
 * @param {string} [configPath]
 * @returns {string}
 */
export function resolveCloudUrl(explicitUrl, configPath = null) {
  // 1. Explicit argument passed via CLI (--cloud-url) or caller options
  if (explicitUrl && typeof explicitUrl === 'string' && explicitUrl.trim() !== '') {
    return explicitUrl.trim().replace(/\/$/, '');
  }

  // 2. Environment variables (for developers / CI / self-hosters)
  if (process.env.AGENT_CLOUD_URL && process.env.AGENT_CLOUD_URL.trim() !== '') {
    return process.env.AGENT_CLOUD_URL.trim().replace(/\/$/, '');
  }
  if (process.env.CLOUD_URL && process.env.CLOUD_URL.trim() !== '') {
    return process.env.CLOUD_URL.trim().replace(/\/$/, '');
  }
  if (process.env.API_DOMAIN && process.env.API_DOMAIN.trim() !== '') {
    const domain = process.env.API_DOMAIN.trim();
    return (domain.startsWith('http') ? domain : `https://${domain}`).replace(/\/$/, '');
  }

  // 3. Existing config.json file (if already installed / configured)
  if (configPath && fs.existsSync(configPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (parsed.cloudUrl && typeof parsed.cloudUrl === 'string' && parsed.cloudUrl.trim() !== '') {
        return parsed.cloudUrl.trim().replace(/\/$/, '');
      }
    } catch {
      // ignore JSON parse error in config fallback
    }
  }

  // 4. Default public production cloud URL configured for this distribution/build
  return DEFAULT_PUBLIC_CLOUD_URL.replace(/\/$/, '');
}

/**
 * Resolves the system logs directory:
 * Windows: %APPDATA%\TallyConnect\logs
 * Fallback / POSIX: ~/.tallyconnect/logs
 */
export function getSystemLogsDir() {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || 'C:\\ProgramData';
    return path.join(appData, 'TallyConnect', 'logs');
  }
  return path.join(os.homedir(), '.tallyconnect', 'logs');
}

/**
 * Resolves standard system error log path
 */
export function getSystemErrorLogPath() {
  return path.join(getSystemLogsDir(), 'errors.log');
}
