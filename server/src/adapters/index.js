import { MockTallyAdapter } from './mockTallyAdapter.js';
import { TallyXmlHttpAdapter } from './tallyXmlHttpAdapter.js';
import { TallyAdapter } from './tallyAdapter.js';
import { config } from '../config.js';

/**
 * Adapter Factory
 * Instantiates the appropriate adapter based on configured mode ('mock' or 'tally')
 */
export function createAdapter(mode = config.connector.mode, options = {}) {
  switch (mode) {
    case 'tally':
      return new TallyXmlHttpAdapter(options);
    case 'mock':
    default:
      return new MockTallyAdapter(options);
  }
}

// Active singleton adapter instance
export const tallyAdapter = createAdapter();

export {
  TallyAdapter,
  MockTallyAdapter,
  TallyXmlHttpAdapter
};
