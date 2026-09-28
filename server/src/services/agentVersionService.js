/**
 * Agent Version Management Service (Phase 3 Step 1)
 *
 * Tracks:
 * - Current published agent version
 * - Minimum supported agent version for cloud compatibility
 * - Update availability and release notes
 */

export const LATEST_AGENT_VERSION = '1.1.0';
export const MIN_SUPPORTED_AGENT_VERSION = '1.0.0';

export const AGENT_RELEASE_NOTES = {
  '1.1.0': 'Optimized high-speed CSV streaming, enhanced multi-tenant isolation, and improved TallyPrime port 9000 reconnect resilience.',
  '1.0.0-beta': 'Initial production beta release supporting Customer, Chart of Accounts, Sales Register, and Trial Balance.'
};

/**
 * Normalizes semver string into [major, minor, patch] numbers
 */
function parseSemver(verString) {
  if (!verString || typeof verString !== 'string') return [0, 0, 0];
  const cleaned = verString.replace(/^v/, '').split('-')[0];
  const parts = cleaned.split('.').map(n => parseInt(n, 10) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

/**
 * Compares two semver strings:
 * returns 1 if v1 > v2, -1 if v1 < v2, 0 if v1 === v2
 */
export function compareVersions(v1, v2) {
  const [maj1, min1, pat1] = parseSemver(v1);
  const [maj2, min2, pat2] = parseSemver(v2);

  if (maj1 !== maj2) return maj1 > maj2 ? 1 : -1;
  if (min1 !== min2) return min1 > min2 ? 1 : -1;
  if (pat1 !== pat2) return pat1 > pat2 ? 1 : -1;
  return 0;
}

export const AgentVersionService = {
  getLatestVersion() {
    return LATEST_AGENT_VERSION;
  },

  getMinSupportedVersion() {
    return MIN_SUPPORTED_AGENT_VERSION;
  },

  /**
   * Evaluates a client's agent version against current policy
   */
  evaluateVersion(clientVersion = '1.0.0-beta') {
    const isSupported = compareVersions(clientVersion, MIN_SUPPORTED_AGENT_VERSION) >= 0;
    const isUpdateAvailable = compareVersions(clientVersion, LATEST_AGENT_VERSION) < 0;

    return {
      currentVersion: clientVersion,
      latestVersion: LATEST_AGENT_VERSION,
      minSupportedVersion: MIN_SUPPORTED_AGENT_VERSION,
      isSupported,
      isUpdateAvailable,
      upgradeUrgency: !isSupported ? 'CRITICAL' : isUpdateAvailable ? 'RECOMMENDED' : 'NONE',
      releaseNotes: AGENT_RELEASE_NOTES[LATEST_AGENT_VERSION] || 'Maintenance release',
      downloadUrl: '/api/agent/download'
    };
  }
};
