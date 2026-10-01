import { TallyXmlHttpAdapter } from './tallyXmlHttpAdapter.js';
import { TallyAdapter } from './tallyAdapter.js';
import { config } from '../config.js';

/**
 * Creates the production Tally XML HTTP adapter communicating over port 9000
 */
export function createProductionAdapter(options = {}) {
  return new TallyXmlHttpAdapter({
    host: options.host || config.connector?.tallyHost || '127.0.0.1',
    port: options.port || config.connector?.tallyPort || 9000,
    ...options
  });
}

/**
 * Adapter Factory
 * Production execution strictly locks to real Tally XML over port 9000.
 */
export function createAdapter(mode = 'xml_http', options = {}) {
  return createProductionAdapter(options);
}

// Active singleton adapter instance
export const tallyAdapter = createAdapter();

export {
  TallyAdapter,
  TallyXmlHttpAdapter
};
