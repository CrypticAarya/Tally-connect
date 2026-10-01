import { TallyAdapter } from '../../server/src/adapters/tallyAdapter.js';
import { mockTallyData } from './mockData.js';

export class MockTallyAdapter extends TallyAdapter {
  constructor(options = {}) {
    super();
    this.company = options.company || mockTallyData.company;
    this.simulatedLatencyMs = options.simulatedLatencyMs ?? 40;
  }

  /**
   * Helper to simulate realistic async I/O latency
   */
  async _delay(ms = this.simulatedLatencyMs) {
    if (ms <= 0) return;
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Tests connection to the simulated TallyPrime instance
   */
  async testConnection() {
    const startTime = Date.now();
    await this._delay();
    const latencyMs = Date.now() - startTime;

    return {
      available: true,
      latencyMs,
      companyName: this.company.name,
      version: this.company.tallyVersion,
      port: this.company.port,
      financialYear: `${this.company.financialYearFrom} to ${this.company.financialYearTo}`,
      message: `TallyPrime connection active on port ${this.company.port}`
    };
  }

  /**
   * Fetches Customer Master records as hierarchical Tally ledgers
   */
  async fetchCustomers(options = {}) {
    await this._delay();
    let results = JSON.parse(JSON.stringify(mockTallyData.customers));

    if (options.branch) {
      results = results.filter(c => c.organization.branch.toLowerCase().includes(options.branch.toLowerCase()));
    }
    if (options.active !== undefined) {
      results = results.filter(c => c.active === options.active);
    }

    return results;
  }

  /**
   * Fetches Chart of Accounts hierarchical ledger tree
   */
  async fetchChartOfAccounts(options = {}) {
    await this._delay();
    let results = JSON.parse(JSON.stringify(mockTallyData.chartOfAccounts));

    if (options.branch) {
      results = results.filter(g => g.branch.toLowerCase().includes(options.branch.toLowerCase()));
    }
    if (options.parent) {
      results = results.filter(g => g.parent.toLowerCase().includes(options.parent.toLowerCase()));
    }

    return results;
  }

  /**
   * Fetches Sales Register vouchers with hierarchical inventory and ledger entries
   */
  async fetchSalesRegister(options = {}) {
    await this._delay();
    let results = JSON.parse(JSON.stringify(mockTallyData.salesVouchers));

    if (options.fromDate) {
      results = results.filter(v => v.date >= options.fromDate);
    }
    if (options.toDate) {
      results = results.filter(v => v.date <= options.toDate);
    }
    if (options.branch) {
      results = results.filter(v => v.branchName.toLowerCase().includes(options.branch.toLowerCase()));
    }

    return results;
  }

  /**
   * Fetches Trial Balance balances
   */
  async fetchTrialBalance(options = {}) {
    await this._delay();
    let results = JSON.parse(JSON.stringify(mockTallyData.trialBalance));

    if (options.monthYear) {
      results = results.filter(t => t.monthYear === options.monthYear);
    }
    if (options.branch) {
      results = results.filter(t => t.branch.toLowerCase().includes(options.branch.toLowerCase()));
    }

    return results;
  }

  /**
   * Returns metadata about this adapter
   */
  getAdapterInfo() {
    return {
      name: 'MockTallyAdapter',
      type: 'mock',
      version: '1.0.0-poc',
      description: 'Realistic TallyPrime hierarchical mock data engine (ready for TallyXmlHttpAdapter)'
    };
  }
}
