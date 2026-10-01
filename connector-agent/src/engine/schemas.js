/**
 * Schemas Definition Module for Tally Connect
 * 
 * Defines clean, genuine CSV column schemas for all 15 Tally datasets.
 * Only genuine Tally fields are included. No synthetic or fake columns.
 */

export const DATASET_SCHEMAS = {
  // --- 1. LEDGERS ---
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

  // --- 2. GROUPS ---
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

  // --- 3. COST CENTERS ---
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

  // --- 4. CUSTOMERS ---
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

  // --- 5. VENDORS ---
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

  // --- 6. STOCK ITEMS ---
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

  // --- 7. STOCK GROUPS ---
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

  // --- 8. UNITS ---
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

  // --- 9. GODOWNS ---
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

  // --- 10. SALES ORDERS ---
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

  // --- 11. PURCHASE ORDERS ---
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

  // --- 12. DELIVERY NOTES ---
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

  // --- 13. RECEIPT NOTES ---
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

  // --- 14. TRIAL BALANCE ---
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

  // --- 15. SALES REGISTER ---
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
  }
};

// Aliases mapping for common alternative naming
const ALIAS_MAP = {
  customer: 'customers',
  customers: 'customers',
  vendor: 'vendors',
  vendors: 'vendors',
  ledger: 'ledgers',
  ledgers: 'ledgers',
  chart_of_accounts: 'ledgers',
  group: 'groups',
  groups: 'groups',
  cost_centre: 'cost_centers',
  cost_centres: 'cost_centers',
  cost_center: 'cost_centers',
  cost_centers: 'cost_centers',
  inventory: 'stock_items',
  stock_item: 'stock_items',
  stock_items: 'stock_items',
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
  sales_register: 'sales_register',
  sales: 'sales_register'
};

/**
 * Normalizes input key to canonical dataset key
 * e.g. "CUSTOMER" -> "customers", "trial-balance" -> "trial_balance"
 */
export function normalizeDatasetKey(key) {
  if (!key) return null;
  const canonical = String(key).trim().toLowerCase().replace(/[-\s]/g, '_');
  return ALIAS_MAP[canonical] || (DATASET_SCHEMAS[canonical] ? canonical : null);
}

/**
 * Returns the schema definition for a given dataset key
 */
export function getSchema(datasetKey) {
  const normalized = normalizeDatasetKey(datasetKey);
  if (!normalized || !DATASET_SCHEMAS[normalized]) {
    throw new Error(`Unsupported dataset type: "${datasetKey}". Supported types: ${Object.keys(DATASET_SCHEMAS).join(', ')}`);
  }
  return DATASET_SCHEMAS[normalized];
}
