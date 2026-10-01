/**
 * Service managing permission verification and data access boundaries.
 * 
 * Ensures that SaaS applications can only query Tally data scopes explicitly
 * authorized by the end customer during their connection setup.
 */

export const DATASET_PERMISSION_MAP = {
  CUSTOMERS: 'allowCustomers',
  CUSTOMER: 'allowCustomers',
  SALES: 'allowSales',
  SALES_REGISTER: 'allowSales',
  INVENTORY: 'allowInventory',
  STOCK_ITEMS: 'allowInventory',
  LEDGERS: 'allowLedgers',
  CHART_OF_ACCOUNTS: 'allowLedgers',
  TRIAL_BALANCE: 'allowTrialBalance',
  PURCHASES: 'allowPurchases',
  OUTSTANDING: 'allowOutstanding'
};

export class PermissionService {
  /**
   * Returns default permission set for a newly initiated customer connection
   */
  static getDefaultPermissions() {
    return {
      allowCustomers: true,
      allowSales: true,
      allowInventory: false,
      allowLedgers: true,
      allowTrialBalance: false,
      allowPurchases: false,
      allowOutstanding: false
    };
  }

  /**
   * Checks if a specific dataset is permitted under the given permissions
   * @param {Object} permissions - Customer permissions object
   * @param {string} dataset - Dataset type key
   * @returns {boolean}
   */
  static isDatasetAllowed(permissions, dataset) {
    if (!permissions) return false;
    const normKey = String(dataset).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const permField = DATASET_PERMISSION_MAP[normKey];
    if (!permField) return false;
    return Boolean(permissions[permField]);
  }

  /**
   * Filters a list of requested datasets down to only those explicitly permitted
   * @param {Object} permissions - Customer permissions object
   * @param {Array<string>} requestedDatasets - List of requested dataset names
   * @returns {Array<string>}
   */
  static filterAllowedDatasets(permissions, requestedDatasets = []) {
    if (!Array.isArray(requestedDatasets)) return [];
    return requestedDatasets.filter(dataset => this.isDatasetAllowed(permissions, dataset));
  }
}
