/**
 * Schemas Definition Module
 * 
 * Strict column orders and definitions matching the uploaded sample CSV templates:
 * - SampleCustomer.csv (36 columns)
 * - SampleChartAccounts.csv (17 columns)
 * - SampleSalesRegister.csv (32 columns)
 * - SampleTrialBalances.csv (9 columns)
 */

export const DATASET_SCHEMAS = {
  CUSTOMER: {
    id: 'CUSTOMER',
    displayName: 'Customer Master',
    fileNamePrefix: 'Customer',
    description: 'Customer master accounts with tax, banking, credit, and contact details',
    columns: [
      'Customer Code',
      'Customer Name',
      'Customer Type',
      'Account Status',
      'Primary Contact Name',
      'Primary Contact Email',
      'Primary Contact Phone',
      'Street Address',
      'City',
      'State/Province',
      'Postal/ZIP Code',
      'Country',
      'GST Reg Type',
      'Pan',
      'Credit Days',
      'Credit Limit',
      'Payment Terms',
      'Currency',
      'Branch ID/Name',
      'Sales Representative',
      'GST Number',
      'GST State Code',
      'GST State Name',
      'MainDistributor',
      'MainDealer',
      'MainAgent',
      'SubDistributor',
      'SubDealer',
      'SubAgent',
      'AccPartyBankName',
      'AccPartyBankIFSCCode',
      'AccPartyBankActNo',
      'AccStartDate',
      'AccEndDate',
      'Active',
      'Remarks'
    ]
  },

  CHART_OF_ACCOUNTS: {
    id: 'CHART_OF_ACCOUNTS',
    displayName: 'Chart of Accounts',
    fileNamePrefix: 'ChartAccounts',
    description: 'Hierarchical general ledger chart of accounts and grouping structure',
    columns: [
      'Account Code',
      'GL Name',
      'Ledger Description',
      'Parent',
      'Grouping',
      'Grouping for Financial Summary',
      'Branch',
      'Cost Center',
      'Cost Classification',
      'Cost Behaviour Description',
      'SV Variable %',
      'Inter-branch',
      'Related Party',
      'GST Applicable',
      'TDS Applicable',
      'Active',
      'Remarks'
    ]
  },

  SALES_REGISTER: {
    id: 'SALES_REGISTER',
    displayName: 'Sales Register',
    fileNamePrefix: 'SalesRegister',
    description: 'Flattened line-item sales invoice transactions with tax breakdowns',
    columns: [
      'Code',
      'Sales Date',
      'Invoice No',
      'Invoice Date',
      'Customer Name/Code',
      'GSTIN',
      'Customer Type',
      'Sales Type',
      'Branch Name/Code',
      'Cost Center Name/Code',
      'Godown Name/Code',
      'Item Description',
      'HSN',
      'Qty',
      'Rate',
      'Discount',
      'Tax Value',
      'CGST',
      'CGST Amount',
      'SGST',
      'SGST Amount',
      'IGST',
      'IGST Amount',
      'Other Charges (₹)',
      'Total Invoice',
      'Place of Supply (State)',
      'Payment Terms',
      'Due Date',
      'Payment Status',
      'Payment Date',
      'Mode Of Payment',
      'Remarks'
    ]
  },

  TRIAL_BALANCE: {
    id: 'TRIAL_BALANCE',
    displayName: 'Trial Balance',
    fileNamePrefix: 'TrialBalances',
    description: 'Periodic trial balance balances by ledger and branch',
    columns: [
      'Month/Year',
      'Branch',
      'Particulars',
      'Name',
      'Opening',
      'Debit',
      'Credit',
      'Closing',
      'Dr/Cr'
    ]
  }
};

/**
 * Normalizes input key to uppercase standard schema key
 * e.g. "sales_register" -> "SALES_REGISTER"
 */
export function normalizeDatasetKey(key) {
  if (!key) return null;
  const upper = key.toUpperCase().replace(/-/g, '_');
  return DATASET_SCHEMAS[upper] ? upper : null;
}

/**
 * Returns the schema definition for a given dataset key
 */
export function getSchema(datasetKey) {
  const normalized = normalizeDatasetKey(datasetKey);
  if (!normalized) {
    throw new Error(`Unsupported dataset type: "${datasetKey}". Supported types: ${Object.keys(DATASET_SCHEMAS).join(', ')}`);
  }
  return DATASET_SCHEMAS[normalized];
}
