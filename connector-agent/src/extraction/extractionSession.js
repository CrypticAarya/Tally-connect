import { TallyXmlHttpAdapter } from '../adapters/tallyXmlHttpAdapter.js';
import { logger } from '../logger.js';

/**
 * In-Memory Extraction Session
 * 
 * Manages the explicit, live Tally company selection for an extraction run.
 * 
 * Architectural Rules:
 * 1. ZERO persistence: Selected company is stored strictly in memory for this session.
 * 2. ZERO fallback: Never fall back to config, cloud tenant, or past sessions.
 * 3. Live Tally authority: The company list originates strictly from the live TallyPrime instance.
 * 4. Switch detection: If Tally switches companies or closes the selected company, extraction halts.
 */
export class ExtractionSession {
  /**
   * @param {Object} [options={}]
   * @param {string} [options.tallyHost='127.0.0.1']
   * @param {number} [options.tallyPort=9000]
   * @param {string} [options.selectedCompany=null]
   * @param {TallyXmlHttpAdapter} [options.tallyAdapter]
   */
  constructor(options = {}) {
    this.tallyHost = options.tallyHost || '127.0.0.1';
    this.tallyPort = Number(options.tallyPort || 9000);
    this.selectedCompany = options.selectedCompany || null;
    this.tallyAdapter = options.tallyAdapter || new TallyXmlHttpAdapter({
      host: this.tallyHost,
      port: this.tallyPort
    });
    this.availableCompanies = [];
  }

  /**
   * Refreshes the list of available/open companies from live TallyPrime port 9000.
   * Throws TALLY_NOT_RUNNING if TallyPrime is offline.
   * Throws NO_ACTIVE_COMPANY if no companies are currently open.
   * @returns {Promise<Array<{ name: string, guid: string, financialYear: string, financialYearFrom: string, financialYearTo: string }>>}
   */
  async refreshAvailableCompanies() {
    logger.info(`Querying TallyPrime on ${this.tallyHost}:${this.tallyPort} for open companies...`);
    const status = await this.tallyAdapter.testConnection();

    if (!status.available) {
      if (status.errorCode === 'TALLY_NOT_RUNNING' || !status.tallyRunning) {
        const err = new Error('TallyPrime could not be reached. Please ensure TallyPrime is open with port 9000 enabled.');
        err.code = 'TALLY_NOT_RUNNING';
        logger.error(err.message);
        throw err;
      }
      const err = new Error('No active Tally company detected. Please open a company in TallyPrime and try again.');
      err.code = 'NO_ACTIVE_COMPANY';
      logger.error(err.message);
      throw err;
    }

    const companies = status.companies || [];
    if (companies.length === 0) {
      const err = new Error('No active Tally company detected. Please open a company in TallyPrime and try again.');
      err.code = 'NO_ACTIVE_COMPANY';
      logger.error(err.message);
      throw err;
    }

    this.availableCompanies = companies;
    logger.info(`Discovered ${companies.length} open company(ies) in TallyPrime: ${companies.map(c => `"${c.name}"`).join(', ')}`);
    return companies;
  }

  /**
   * Explicitly sets the user-selected company after validating that it exists in the live Tally response.
   * @param {string} companyName - Exact company name
   * @returns {Promise<{ name: string, guid: string, financialYear: string }>}
   */
  async selectCompany(companyName) {
    if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
      throw new Error('Please select a valid company.');
    }

    const cleanName = companyName.trim();
    // Validate strictly against current live Tally instance
    const companies = await this.refreshAvailableCompanies();
    const match = companies.find(c => c.name.toLowerCase() === cleanName.toLowerCase());

    if (!match) {
      const availableList = companies.map(c => `"${c.name}"`).join(', ');
      const err = new Error(`The company "${cleanName}" is not currently available in TallyPrime. Available: ${availableList}`);
      err.code = 'COMPANY_NOT_FOUND';
      err.availableCompanies = companies.map(c => c.name);
      logger.error(err.message);
      throw err;
    }

    this.selectedCompany = match.name;
    logger.info(`ExtractionSession: User explicitly selected Tally company "${this.selectedCompany}"`);
    return match;
  }

  /**
   * Clears the current in-memory selected company.
   */
  clearSelection() {
    this.selectedCompany = null;
  }

  /**
   * Verifies that the selected company is STILL open and unchanged in TallyPrime.
   * Detects company switches and halts immediately.
   * @returns {Promise<{ name: string, guid: string, financialYear: string }>}
   */
  async verifySelectedCompany() {
    if (!this.selectedCompany) {
      const err = new Error('No Tally company has been selected. Please select a company first.');
      err.code = 'NO_COMPANY_SELECTED';
      throw err;
    }

    let companies;
    try {
      companies = await this.refreshAvailableCompanies();
    } catch (err) {
      const previous = this.selectedCompany;
      this.selectedCompany = null; // Invalidate session on Tally disconnect or company closure
      if (err.code === 'NO_ACTIVE_COMPANY') {
        const notAvailErr = new Error('The selected Tally company is no longer available. Please select a company again.');
        notAvailErr.code = 'COMPANY_NOT_AVAILABLE';
        notAvailErr.previousCompany = previous;
        throw notAvailErr;
      }
      throw err;
    }

    const match = companies.find(c => c.name.toLowerCase() === this.selectedCompany.toLowerCase());

    if (!match) {
      const previous = this.selectedCompany;
      this.selectedCompany = null; // Force re-selection
      const currentList = companies.map(c => c.name).join(', ') || 'None';
      const msg = `Tally company changed.\nSelected company:\n  ${previous}\nCurrent Tally company:\n  ${currentList}\nPlease select the company again.`;
      const err = new Error(msg);
      err.code = 'COMPANY_CHANGED';
      err.selectedCompany = previous;
      err.currentCompanies = companies.map(c => c.name);
      logger.warn(`Company mismatch detected: was "${previous}", now "${currentList}"`);
      throw err;
    }

    return match;
  }

  /**
   * Returns current in-memory session state summary.
   */
  getSessionState() {
    return {
      tallyHost: this.tallyHost,
      tallyPort: this.tallyPort,
      selectedCompany: this.selectedCompany || 'NONE',
      availableCompaniesCount: this.availableCompanies.length
    };
  }
}
