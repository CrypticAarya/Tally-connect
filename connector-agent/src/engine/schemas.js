/**
 * Schemas Definition Module for Tally Connect
 * 
 * Defines clean, authoritative schemas for all Tally datasets.
 * Supports dual profiles:
 * 1. 'canonical'     : Clean Tally Connect standard schemas (15 datasets)
 * 2. 'authoritative' : Exact schema specifications matching the 13 authoritative
 *                      sample CSV templates (SampleCustomer.csv, SampleChartAccounts.csv, etc.)
 * 
 * Rules:
 * - Field order and column counts are strictly enforced.
 * - Headers are defined once here; never hardcoded elsewhere.
 * - Missing/unavailable Tally fields are emitted as empty strings without fabrication.
 */

// ============================================================================
// PROFILE 1: CANONICAL SCHEMAS (Standard Clean Tally Model)
// ============================================================================
export const CANONICAL_SCHEMAS = {
  ledgers: {
    id: 'ledgers',
    displayName: 'Ledgers',
    fileNamePrefix: 'ledgers',
    columns: [
      'Ledger Name',
      'Parent Group',
      'Opening Balance',
      'Closing Balance',
      'GST Applicable',
      'Cost Centres Enabled',
      'Mailing Name',
      'State',
      'Pincode',
      'Country',
      'GSTIN',
      'PAN',
      'Phone',
      'Email',
      'Description'
    ]
  },

  groups: {
    id: 'groups',
    displayName: 'Groups',
    fileNamePrefix: 'groups',
    columns: [
      'Group Name',
      'Parent Group',
      'Is Addable',
      'Is Sub Ledger',
      'Is Calculate'
    ]
  },

  cost_centers: {
    id: 'cost_centers',
    displayName: 'Cost Centers',
    fileNamePrefix: 'cost_centers',
    columns: [
      'Cost Center Name',
      'Parent',
      'Category'
    ]
  },

  customers: {
    id: 'customers',
    displayName: 'Customers',
    fileNamePrefix: 'customers',
    columns: [
      'Customer Name',
      'Parent Group',
      'GSTIN',
      'PAN',
      'Contact Person',
      'Email',
      'Phone',
      'Address',
      'State',
      'Pincode',
      'Country',
      'Credit Days',
      'Credit Limit',
      'Bank Name',
      'Account Number',
      'IFSC Code',
      'Opening Balance',
      'Closing Balance'
    ]
  },

  vendors: {
    id: 'vendors',
    displayName: 'Vendors',
    fileNamePrefix: 'vendors',
    columns: [
      'Vendor Name',
      'Parent Group',
      'GSTIN',
      'PAN',
      'Contact Person',
      'Email',
      'Phone',
      'Address',
      'State',
      'Pincode',
      'Country',
      'Credit Days',
      'Credit Limit',
      'Bank Name',
      'Account Number',
      'IFSC Code',
      'Opening Balance',
      'Closing Balance'
    ]
  },

  stock_items: {
    id: 'stock_items',
    displayName: 'Stock Items',
    fileNamePrefix: 'stock_items',
    columns: [
      'Item Name',
      'Stock Group',
      'Unit of Measure',
      'HSN Code',
      'Opening Quantity',
      'Opening Rate',
      'Opening Value',
      'Closing Quantity',
      'Closing Rate',
      'Closing Value',
      'GST Applicable',
      'GST Rate',
      'Description'
    ]
  },

  stock_groups: {
    id: 'stock_groups',
    displayName: 'Stock Groups',
    fileNamePrefix: 'stock_groups',
    columns: [
      'Stock Group Name',
      'Parent',
      'Is Addable'
    ]
  },

  units: {
    id: 'units',
    displayName: 'Units',
    fileNamePrefix: 'units',
    columns: [
      'Unit Name',
      'Original Name',
      'Decimal Places',
      'GST Excluded'
    ]
  },

  godowns: {
    id: 'godowns',
    displayName: 'Godowns',
    fileNamePrefix: 'godowns',
    columns: [
      'Godown Name',
      'Parent',
      'Address',
      'Pincode'
    ]
  },

  sales_orders: {
    id: 'sales_orders',
    displayName: 'Sales Orders',
    fileNamePrefix: 'sales_orders',
    columns: [
      'Order Number',
      'Order Date',
      'Due Date',
      'Customer Name',
      'GSTIN',
      'Place of Supply',
      'Item Name',
      'Quantity',
      'Rate',
      'Amount',
      'Godown',
      'Order Total',
      'Narration'
    ]
  },

  purchase_orders: {
    id: 'purchase_orders',
    displayName: 'Purchase Orders',
    fileNamePrefix: 'purchase_orders',
    columns: [
      'Order Number',
      'Order Date',
      'Due Date',
      'Vendor Name',
      'GSTIN',
      'Place of Supply',
      'Item Name',
      'Quantity',
      'Rate',
      'Amount',
      'Godown',
      'Order Total',
      'Narration'
    ]
  },

  delivery_notes: {
    id: 'delivery_notes',
    displayName: 'Delivery Notes',
    fileNamePrefix: 'delivery_notes',
    columns: [
      'Note Number',
      'Date',
      'Customer Name',
      'GSTIN',
      'Place of Supply',
      'Item Name',
      'Quantity',
      'Rate',
      'Amount',
      'Godown',
      'Note Total',
      'Narration'
    ]
  },

  receipt_notes: {
    id: 'receipt_notes',
    displayName: 'Receipt Notes',
    fileNamePrefix: 'receipt_notes',
    columns: [
      'Note Number',
      'Date',
      'Vendor Name',
      'GSTIN',
      'Place of Supply',
      'Item Name',
      'Quantity',
      'Rate',
      'Amount',
      'Godown',
      'Note Total',
      'Narration'
    ]
  },

  trial_balance: {
    id: 'trial_balance',
    displayName: 'Trial Balance',
    fileNamePrefix: 'trial_balance',
    columns: [
      'Ledger Name',
      'Group',
      'Opening Debit',
      'Opening Credit',
      'Debit',
      'Credit',
      'Closing Debit',
      'Closing Credit'
    ]
  },

  sales_register: {
    id: 'sales_register',
    displayName: 'Sales Register',
    fileNamePrefix: 'sales_register',
    columns: [
      'Invoice Number',
      'Invoice Date',
      'Customer Name',
      'GSTIN',
      'Place of Supply',
      'Item Name',
      'Quantity',
      'Rate',
      'Amount',
      'Godown',
      'Total Invoice',
      'Narration'
    ]
  },

  purchase_register: {
    id: 'purchase_register',
    displayName: 'Purchase Register',
    fileNamePrefix: 'purchase_register',
    columns: [
      'Invoice Number',
      'Invoice Date',
      'Vendor Name',
      'GSTIN',
      'Place of Supply',
      'Item Name',
      'Quantity',
      'Rate',
      'Amount',
      'Godown',
      'Total Invoice',
      'Narration'
    ]
  }
};

// ============================================================================
// PROFILE 2: AUTHORITATIVE SCHEMAS (13 Sample File Formats)
// ============================================================================
export const AUTHORITATIVE_SCHEMAS = {
  // 1. Branch (3 columns) -> SampleBranch.csv
  branch: {
    id: 'branch',
    displayName: 'Branch',
    fileNamePrefix: 'SampleBranch',
    columns: [
      'Code',
      'Name',
      'GSTNo'
    ]
  },

  // 2. Chart of Accounts (17 columns) -> SampleChartAccounts.csv
  chart_of_accounts: {
    id: 'chart_of_accounts',
    displayName: 'Chart of Accounts',
    fileNamePrefix: 'SampleChartAccounts',
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

  // 3. Cost Center (3 columns) -> SampleCostCenter.csv
  cost_centers: {
    id: 'cost_centers',
    displayName: 'Cost Center',
    fileNamePrefix: 'SampleCostCenter',
    columns: [
      'Code',
      'Name',
      'Branch Code/Name'
    ]
  },

  // 4. Customer Master (36 columns) -> SampleCustomer.csv
  customers: {
    id: 'customers',
    displayName: 'Customer Master',
    fileNamePrefix: 'SampleCustomer',
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

  // 5. Inventory (17 columns) -> SampleInventory.csv
  inventory: {
    id: 'inventory',
    displayName: 'Inventory Policies',
    fileNamePrefix: 'SampleInventory',
    columns: [
      'Item/SKU ID',
      'Item Name/Description',
      'Item Category/Type',
      'Item Sub-category',
      'HSN',
      'Brand',
      'Manufacturer/Vendor Name',
      'Unit of Measure',
      'Reorder Point',
      'Economic Order Quantity',
      'Minimum Order Quantity',
      'Maximum Stock Level',
      'Safety Stock Level',
      'Lead Time',
      'Markup Percentage',
      'Profit Margin',
      'Status'
    ]
  },

  // 6. Inventory Master / Stock Movement (20 columns) -> SampleInventoryMaster.csv
  inventory_master: {
    id: 'inventory_master',
    displayName: 'Inventory Master',
    fileNamePrefix: 'SampleInventoryMaster',
    columns: [
      'Code',
      'Transaction Date',
      'Transaction Type',
      'Document No',
      'Voucher Ref (ERP)',
      'Godown Name/Code',
      'Item Code/Name',
      'Inward Qty',
      'Outward Qty',
      'Rate per Unit',
      'Inward Value',
      'Outward Value',
      'Closing Qty',
      'Closing Value',
      'Batch No',
      'Mfg Date',
      'Expiry Date',
      'Party Name',
      'Cost Centre Name/Code',
      'Remarks'
    ]
  },

  // 7. Item Master (27 columns) -> SampleItemMaster.csv
  stock_items: {
    id: 'stock_items',
    displayName: 'Item Master',
    fileNamePrefix: 'SampleItemMaster',
    columns: [
      'Item/SKU ID',
      'Item Name/Description',
      'Month/Year',
      'Item Category/Type',
      'Item Sub-category',
      'HSN',
      'Brand',
      'Manufacturer/Vendor Name',
      'Unit of Measure',
      'GST Rate %',
      'GST Applicable',
      'Costing Method',
      'Standard Cost per Unit',
      'MRP',
      'Standard Selling Price',
      'Reorder Level (Qty)',
      'Min Stock Qty',
      'Max Stock Qty',
      'Opening Stock Qty',
      'Opening Stock Rate',
      'Opening Stock Value',
      'Economic Order Quantity (EOQ)',
      'Safety Stock Level',
      'Lead Time',
      'Markup Percentage',
      'Profit Margin',
      'Status'
    ]
  },

  // 8. Purchase Register (32 columns) -> SamplePurchaseRegister.csv
  purchase_register: {
    id: 'purchase_register',
    displayName: 'Purchase Register',
    fileNamePrefix: 'SamplePurchaseRegister',
    columns: [
      'Code',
      'Purchase Date',
      'Invoice No',
      'Invoice Date',
      'Vendor Name/Code',
      'GSTIN',
      'Vendor Type',
      'Purchase Type',
      'Branch Name/Code',
      'Cost Center Name/Code',
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
      'Total Invoice',
      'GRN No',
      'PO Reference No',
      'Payment Terms',
      'Due Date',
      'Payment Status',
      'Payment Date',
      'Mode Of Payment',
      'Payment Voucher Ref',
      'Remarks'
    ]
  },

  // 9. Sales Register (32 columns) -> SampleSalesRegister.csv
  sales_register: {
    id: 'sales_register',
    displayName: 'Sales Register',
    fileNamePrefix: 'SampleSalesRegister',
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

  // 10. Sales Representative (3 columns) -> SampleSalesRepresentative.csv
  sales_representative: {
    id: 'sales_representative',
    displayName: 'Sales Representative',
    fileNamePrefix: 'SampleSalesRepresentative',
    columns: [
      'Code',
      'Name',
      'Mobile No'
    ]
  },

  // 11. Trial Balance (9 columns) -> SampleTrialBalances.csv
  trial_balance: {
    id: 'trial_balance',
    displayName: 'Trial Balance',
    fileNamePrefix: 'SampleTrialBalances',
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
  },

  // 12. Vendor Master (33 columns) -> SampleVendor.csv
  vendors: {
    id: 'vendors',
    displayName: 'Vendor Master',
    fileNamePrefix: 'SampleVendor',
    columns: [
      'Vendor Code',
      'Vendor Name',
      'Vendor Type',
      'Vendor Status',
      'Primary Contact Name',
      'Primary Contact Email',
      'Primary Contact Phone',
      'Street Address',
      'City',
      'State/Province',
      'Postal/ZIP Code',
      'Country',
      'Credit Limit',
      'Payment Terms',
      'Currency',
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
      'Nature of vendor',
      'TDS Category',
      'TDS Section',
      'PAN Number'
    ]
  },

  // 13. Godown (4 columns) -> Samplegodown.csv
  godowns: {
    id: 'godowns',
    displayName: 'Godown',
    fileNamePrefix: 'Samplegodown',
    columns: [
      'Code',
      'Name',
      'Branch Code/Name',
      'Active'
    ]
  }
};

// Aliases mapping for common alternative naming
const ALIAS_MAP = {
  customer: 'customers',
  customers: 'customers',
  customer_master: 'customers',
  vendor: 'vendors',
  vendors: 'vendors',
  vendor_master: 'vendors',
  ledger: 'ledgers',
  ledgers: 'ledgers',
  chart_of_accounts: 'chart_of_accounts',
  chartaccounts: 'chart_of_accounts',
  group: 'groups',
  groups: 'groups',
  cost_centre: 'cost_centers',
  cost_centres: 'cost_centers',
  cost_center: 'cost_centers',
  cost_centers: 'cost_centers',
  inventory: 'inventory',
  inventory_policies: 'inventory',
  inventory_master: 'inventory_master',
  stock_item: 'stock_items',
  stock_items: 'stock_items',
  item_master: 'stock_items',
  items: 'stock_items',
  stock_group: 'stock_groups',
  stock_groups: 'stock_groups',
  unit: 'units',
  units: 'units',
  godown: 'godowns',
  godowns: 'godowns',
  sales_order: 'sales_orders',
  sales_orders: 'sales_orders',
  purchase_order: 'purchase_orders',
  purchase_orders: 'purchase_orders',
  delivery_note: 'delivery_notes',
  delivery_notes: 'delivery_notes',
  receipt_note: 'receipt_notes',
  receipt_notes: 'receipt_notes',
  trial_balance: 'trial_balance',
  trialbalance: 'trial_balance',
  trial_balances: 'trial_balance',
  sales_register: 'sales_register',
  sales: 'sales_register',
  purchase_register: 'purchase_register',
  purchases: 'purchase_register',
  branch: 'branch',
  branches: 'branch',
  sales_representative: 'sales_representative',
  sales_representatives: 'sales_representative',
  sales_rep: 'sales_representative',
  stock_movement: 'inventory_master'
};

// Default export profile in this environment
let defaultExportProfile = 'canonical';

export function setDefaultExportProfile(profile) {
  if (profile === 'authoritative' || profile === 'target' || profile === 'sample') {
    defaultExportProfile = 'authoritative';
  } else {
    defaultExportProfile = 'canonical';
  }
}

export function getDefaultExportProfile() {
  return defaultExportProfile;
}

/**
 * Normalizes input key to canonical dataset key
 */
export function normalizeDatasetKey(key) {
  if (!key) return null;
  const canonical = String(key).trim().toLowerCase().replace(/[-\s]/g, '_');
  return ALIAS_MAP[canonical] || canonical;
}

/**
 * Returns the schema definition for a given dataset key and profile
 * @param {string} datasetKey
 * @param {'canonical'|'authoritative'} [profile]
 */
export function getSchema(datasetKey, profile = defaultExportProfile) {
  const normalized = normalizeDatasetKey(datasetKey);
  const isAuth = profile === 'authoritative' || profile === 'target' || profile === 'sample';

  if (isAuth) {
    if (AUTHORITATIVE_SCHEMAS[normalized]) {
      return AUTHORITATIVE_SCHEMAS[normalized];
    }
    // Cross-alias fallbacks for authoritative profile
    if (normalized === 'ledgers' && AUTHORITATIVE_SCHEMAS.chart_of_accounts) {
      return AUTHORITATIVE_SCHEMAS.chart_of_accounts;
    }
    if (normalized === 'stock_items' && AUTHORITATIVE_SCHEMAS.stock_items) {
      return AUTHORITATIVE_SCHEMAS.stock_items;
    }
  }

  // Fallback to canonical profile
  if (CANONICAL_SCHEMAS[normalized]) {
    return CANONICAL_SCHEMAS[normalized];
  }

  if (normalized === 'chart_of_accounts' && CANONICAL_SCHEMAS.ledgers) {
    return CANONICAL_SCHEMAS.ledgers;
  }

  if (AUTHORITATIVE_SCHEMAS[normalized]) {
    return AUTHORITATIVE_SCHEMAS[normalized];
  }

  throw new Error(`Unsupported dataset type: "${datasetKey}". Supported types: ${Object.keys(CANONICAL_SCHEMAS).join(', ')}`);
}

// Backward-compatible export of default DATASET_SCHEMAS
export const DATASET_SCHEMAS = CANONICAL_SCHEMAS;
