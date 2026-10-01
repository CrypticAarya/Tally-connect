/**
 * Standardized Customer-Facing Error Definitions
 * Provides actionable, non-technical error guidance for SaaS end-users.
 */
export const CUSTOMER_ERRORS = {
  TALLY_NOT_RUNNING: {
    code: 'TALLY_NOT_RUNNING',
    message: 'TallyPrime application is not running or XML communication port is disabled.',
    solution: 'Open TallyPrime on your desktop and verify that port 9000 is enabled in F12 > Advanced Configuration > Enable ODBC/XML.'
  },
  AGENT_OFFLINE: {
    code: 'AGENT_OFFLINE',
    message: 'The Tally Connect Desktop Agent is currently offline.',
    solution: 'Launch the Tally Connect Desktop Agent application on your computer to resume data synchronization.'
  },
  INVALID_PERMISSION: {
    code: 'INVALID_PERMISSION',
    message: 'Access to this accounting data entity has not been permitted.',
    solution: 'Ask your organization administrator to enable access for this entity in your Tally Connect connection settings.'
  },
  SYNC_FAILED: {
    code: 'SYNC_FAILED',
    message: 'Data extraction from Tally encountered an unexpected synchronization failure.',
    solution: 'Ensure your active company in TallyPrime has finished loading and retry the sync.'
  },
  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    message: 'Network connection between desktop agent and cloud server timed out.',
    solution: 'Check your internet connection and verify that your firewall allows outbound HTTP requests to the cloud server.'
  }
};

/**
 * Creates a standardized customer error object
 * @param {string} code - Error code key
 * @param {Object} [overrides] - Custom message or solution overrides
 * @returns {{ code: string, message: string, solution: string }}
 */
export function formatCustomerError(code, overrides = {}) {
  const base = CUSTOMER_ERRORS[code] || {
    code: code || 'UNKNOWN_ERROR',
    message: 'An unexpected connection error occurred.',
    solution: 'Please retry the operation or contact technical support.'
  };

  return {
    code: base.code,
    message: overrides.message || base.message,
    solution: overrides.solution || base.solution
  };
}
