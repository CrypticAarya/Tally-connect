/**
 * Abstract Base Class: TallyAdapter
 * 
 * Defines the contract for all Tally communication layers.
 * Whether communicating with TallyPrime via Mock data, HTTP/XML/TDL (Port 9000),
 * or ODBC, any adapter implementation must adhere to this interface.
 */
export class TallyAdapter {
  /**
   * Tests connection to the Tally instance
   * @returns {Promise<{ available: boolean, latencyMs: number, companyName: string, version: string, message: string }>}
   */
  async testConnection() {
    throw new Error('Method "testConnection" must be implemented by concrete subclass');
  }

  /**
   * Fetches Customer Master records from Tally
   * Returns hierarchical Tally ledger entities under Sundry Debtors
   * @param {Object} [options={}] - Query filters
   * @returns {Promise<Array<Object>>}
   */
  async fetchCustomers(options = {}) {
    throw new Error('Method "fetchCustomers" must be implemented by concrete subclass');
  }

  /**
   * Fetches Chart of Accounts from Tally
   * Returns hierarchical Tally Group and Ledger definitions
   * @param {Object} [options={}] - Query filters
   * @returns {Promise<Array<Object>>}
   */
  async fetchChartOfAccounts(options = {}) {
    throw new Error('Method "fetchChartOfAccounts" must be implemented by concrete subclass');
  }

  /**
   * Fetches Sales Register vouchers from Tally
   * Returns raw hierarchical vouchers with inventory lines and ledger postings
   * @param {Object} [options={}] - Date range filters ({ fromDate, toDate, branch })
   * @returns {Promise<Array<Object>>}
   */
  async fetchSalesRegister(options = {}) {
    throw new Error('Method "fetchSalesRegister" must be implemented by concrete subclass');
  }

  /**
   * Fetches Trial Balance balances from Tally
   * Returns periodic ledger balance records with Opening, Debit, Credit, and Closing
   * @param {Object} [options={}] - Period and branch filters
   * @returns {Promise<Array<Object>>}
   */
  async fetchTrialBalance(options = {}) {
    throw new Error('Method "fetchTrialBalance" must be implemented by concrete subclass');
  }

  /**
   * Returns information about the active adapter
   * @returns {{ name: string, type: 'mock' | 'xml_http' | 'odbc', version: string }}
   */
  getAdapterInfo() {
    throw new Error('Method "getAdapterInfo" must be implemented by concrete subclass');
  }
}
