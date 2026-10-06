import { DATASET_SCHEMAS, AUTHORITATIVE_SCHEMAS } from '../engine/schemas.js';

/**
 * Central Entity Registry for Tally Connect
 * 
 * Defines all 15 extractable Tally datasets across Master Data, Transactions, and Reports.
 * Explicitly establishes the Report (TYPE=Data) vs Collection (TYPE=Collection) distinction
 * per official Tally XML specifications.
 */

export const ENTITY_CATEGORIES = {
  MASTER: 'master',
  TRANSACTION: 'transaction',
  REPORT: 'report'
};

export const REQUEST_TYPES = {
  COLLECTION: 'Collection',
  DATA: 'Data' // Official Tally Report Export
};

export const ENTITY_REGISTRY = [
  // =========================================================================
  // MASTER DATA (TYPE: Collection)
  // =========================================================================
  {
    id: 'ledgers',
    name: 'Ledgers',
    category: ENTITY_CATEGORIES.MASTER,
    type: 'master',
    isReport: false,
    requestType: REQUEST_TYPES.COLLECTION,
    tallyId: 'Collection of Ledgers',
    tdlType: 'Ledger',
    description: 'General ledger accounts with opening and closing balances',
    fileNamePrefix: 'ledgers',
    fetchMethod: 'fetchLedgers',
    parserMethod: 'normalizeLedgers',
    requiredXmlRequest: 'TdlBuilder.buildLedgerRequest() [TYPE=Collection, ID=Collection of Ledgers]',
    parameters: [],
    expectedXmlResponse: '<COLLECTION><LEDGER NAME="...">...</LEDGER></COLLECTION>',
    normalizedFields: [
      'guid', 'name', 'parent', 'description', 'openingBalance', 'closingBalance',
      'gstApplicable', 'isCostCentresOn', 'mailingName', 'city', 'state', 'pincode',
      'country', 'gstin', 'pan', 'phone', 'email', 'narration'
    ],
    csvColumns: DATASET_SCHEMAS.ledgers.columns
  },
  {
    id: 'groups',
    name: 'Groups',
    category: ENTITY_CATEGORIES.MASTER,
    type: 'master',
    isReport: false,
    requestType: REQUEST_TYPES.COLLECTION,
    tallyId: 'GroupMasterCollection',
    tdlType: 'Group',
    description: 'Account classification groups and hierarchy',
    fileNamePrefix: 'groups',
    fetchMethod: 'fetchGroups',
    parserMethod: 'normalizeGroups',
    requiredXmlRequest: 'TdlBuilder.buildGroupRequest() [TYPE=Collection, ID=GroupMasterCollection]',
    parameters: [],
    expectedXmlResponse: '<COLLECTION><GROUP NAME="...">...</GROUP></COLLECTION>',
    normalizedFields: ['guid', 'name', 'parent', 'isAddable', 'isSubLedger', 'isCalculate'],
    csvColumns: DATASET_SCHEMAS.groups.columns
  },
  {
    id: 'cost_centers',
    name: 'Cost Centers',
    category: ENTITY_CATEGORIES.MASTER,
    type: 'master',
    isReport: false,
    requestType: REQUEST_TYPES.COLLECTION,
    tallyId: 'CostCentreCollection',
    tdlType: 'Cost Centre',
    description: 'Cost centers and cost categories for departmental tracking',
    fileNamePrefix: 'cost_centers',
    fetchMethod: 'fetchCostCentres',
    parserMethod: 'normalizeCostCentres',
    requiredXmlRequest: 'TdlBuilder.buildCostCentreRequest() [TYPE=Collection, ID=CostCentreCollection]',
    parameters: [],
    expectedXmlResponse: '<COLLECTION><COSTCENTRE NAME="...">...</COSTCENTRE></COLLECTION>',
    normalizedFields: ['guid', 'name', 'parent', 'category'],
    csvColumns: DATASET_SCHEMAS.cost_centers.columns
  },
  {
    id: 'customers',
    name: 'Customers',
    category: ENTITY_CATEGORIES.MASTER,
    type: 'master',
    isReport: false,
    requestType: REQUEST_TYPES.COLLECTION,
    tallyId: 'CustomerMasterCollection',
    tdlType: 'Ledger',
    tdlFilter: 'IsSundryDebtor',
    description: 'Customer master accounts (Sundry Debtors) with tax, address, and credit info',
    fileNamePrefix: 'customers',
    fetchMethod: 'fetchCustomers',
    parserMethod: 'normalizeCustomers',
    requiredXmlRequest: 'TdlBuilder.buildCustomerRequest() [TYPE=Collection, ID=CustomerMasterCollection, Filter=IsSundryDebtor]',
    parameters: [],
    expectedXmlResponse: '<COLLECTION><LEDGER NAME="...">...</LEDGER></COLLECTION>',
    normalizedFields: [
      'guid', 'name', 'code', 'parent', 'customerType', 'accountStatus', 'contact',
      'mailingDetails', 'statutory', 'creditPolicy', 'banking', 'openingBalance',
      'closingBalance', 'active'
    ],
    csvColumns: DATASET_SCHEMAS.customers.columns
  },
  {
    id: 'vendors',
    name: 'Vendors',
    category: ENTITY_CATEGORIES.MASTER,
    type: 'master',
    isReport: false,
    requestType: REQUEST_TYPES.COLLECTION,
    tallyId: 'VendorMasterCollection',
    tdlType: 'Ledger',
    tdlFilter: 'IsSundryCreditor',
    description: 'Supplier/vendor accounts (Sundry Creditors) with bank and GST details',
    fileNamePrefix: 'vendors',
    fetchMethod: 'fetchVendors',
    parserMethod: 'normalizeVendors',
    requiredXmlRequest: 'TdlBuilder.buildVendorRequest() [TYPE=Collection, ID=VendorMasterCollection, Filter=IsSundryCreditor]',
    parameters: [],
    expectedXmlResponse: '<COLLECTION><LEDGER NAME="...">...</LEDGER></COLLECTION>',
    normalizedFields: [
      'guid', 'name', 'code', 'parent', 'vendorType', 'status', 'contact',
      'mailingDetails', 'statutory', 'creditPolicy', 'banking', 'openingBalance',
      'closingBalance', 'active'
    ],
    csvColumns: DATASET_SCHEMAS.vendors.columns
  },
  {
    id: 'stock_items',
    name: 'Stock Items',
    category: ENTITY_CATEGORIES.MASTER,
    type: 'master',
    isReport: false,
    requestType: REQUEST_TYPES.COLLECTION,
    tallyId: 'StockItemCollection',
    tdlType: 'StockItem',
    description: 'Inventory items with UOM, rates, values, and HSN codes',
    fileNamePrefix: 'stock_items',
    fetchMethod: 'fetchStockItems',
    parserMethod: 'normalizeStockItems',
    requiredXmlRequest: 'TdlBuilder.buildStockItemRequest() [TYPE=Collection, ID=StockItemCollection]',
    parameters: [],
    expectedXmlResponse: '<COLLECTION><STOCKITEM NAME="...">...</STOCKITEM></COLLECTION>',
    normalizedFields: [
      'guid', 'name', 'parent', 'uom', 'openingQuantity', 'openingRate', 'openingValue',
      'closingQuantity', 'closingRate', 'closingValue', 'gstApplicable', 'gstRate',
      'hsnCode', 'description'
    ],
    csvColumns: DATASET_SCHEMAS.stock_items.columns
  },
  {
    id: 'inventory',
    name: 'Inventory Policies',
    category: ENTITY_CATEGORIES.MASTER,
    type: 'master',
    isReport: false,
    requestType: REQUEST_TYPES.COLLECTION,
    tallyId: 'StockItemCollection',
    tdlType: 'StockItem',
    description: 'Inventory item reorder points, min/max levels, lead times, and policies',
    fileNamePrefix: 'inventory',
    fetchMethod: 'fetchStockItems',
    parserMethod: 'normalizeStockItems',
    requiredXmlRequest: 'TdlBuilder.buildStockItemRequest() [TYPE=Collection, ID=StockItemCollection]',
    parameters: [],
    expectedXmlResponse: '<COLLECTION><STOCKITEM NAME="...">...</STOCKITEM></COLLECTION>',
    normalizedFields: [
      'guid', 'name', 'code', 'parent', 'category', 'uom', 'hsnCode', 'reorderLevel',
      'minStockQty', 'maxStockQty', 'status'
    ],
    csvColumns: AUTHORITATIVE_SCHEMAS.inventory.columns
  },
  {
    id: 'stock_groups',
    name: 'Stock Groups',
    category: ENTITY_CATEGORIES.MASTER,
    type: 'master',
    isReport: false,
    requestType: REQUEST_TYPES.COLLECTION,
    tallyId: 'StockGroupCollection',
    tdlType: 'StockGroup',
    description: 'Inventory item categories and grouping hierarchy',
    fileNamePrefix: 'stock_groups',
    fetchMethod: 'fetchStockGroups',
    parserMethod: 'normalizeStockGroups',
    requiredXmlRequest: 'TdlBuilder.buildStockGroupRequest() [TYPE=Collection, ID=StockGroupCollection]',
    parameters: [],
    expectedXmlResponse: '<COLLECTION><STOCKGROUP NAME="...">...</STOCKGROUP></COLLECTION>',
    normalizedFields: ['guid', 'name', 'parent', 'isAddable'],
    csvColumns: DATASET_SCHEMAS.stock_groups.columns
  },
  {
    id: 'units',
    name: 'Units',
    category: ENTITY_CATEGORIES.MASTER,
    type: 'master',
    isReport: false,
    requestType: REQUEST_TYPES.COLLECTION,
    tallyId: 'UnitCollection',
    tdlType: 'Unit',
    description: 'Units of measurement (UOM) and decimal precision',
    fileNamePrefix: 'units',
    fetchMethod: 'fetchUnits',
    parserMethod: 'normalizeUnits',
    requiredXmlRequest: 'TdlBuilder.buildUnitRequest() [TYPE=Collection, ID=UnitCollection]',
    parameters: [],
    expectedXmlResponse: '<COLLECTION><UNIT NAME="...">...</UNIT></COLLECTION>',
    normalizedFields: ['guid', 'name', 'originalName', 'decimalPlaces', 'isGstExcluded'],
    csvColumns: DATASET_SCHEMAS.units.columns
  },
  {
    id: 'godowns',
    name: 'Godowns',
    category: ENTITY_CATEGORIES.MASTER,
    type: 'master',
    isReport: false,
    requestType: REQUEST_TYPES.COLLECTION,
    tallyId: 'GodownCollection',
    tdlType: 'Godown',
    description: 'Warehouses and physical storage locations',
    fileNamePrefix: 'godowns',
    fetchMethod: 'fetchGodowns',
    parserMethod: 'normalizeGodowns',
    requiredXmlRequest: 'TdlBuilder.buildGodownRequest() [TYPE=Collection, ID=GodownCollection]',
    parameters: [],
    expectedXmlResponse: '<COLLECTION><GODOWN NAME="...">...</GODOWN></COLLECTION>',
    normalizedFields: ['guid', 'name', 'parent', 'address', 'pincode'],
    csvColumns: DATASET_SCHEMAS.godowns.columns
  },

  // =========================================================================
  // TRANSACTIONS (TYPE: Collection with VOUCHER type filter)
  // =========================================================================
  {
    id: 'sales_orders',
    name: 'Sales Orders',
    category: ENTITY_CATEGORIES.TRANSACTION,
    type: 'transaction',
    isReport: false,
    requestType: REQUEST_TYPES.COLLECTION,
    tallyId: 'SalesOrderCollection',
    tdlType: 'Voucher',
    tdlFilter: 'IsSalesOrder',
    description: 'Open and processed sales orders with inventory lines',
    fileNamePrefix: 'sales_orders',
    fetchMethod: 'fetchSalesOrders',
    parserMethod: 'normalizeSalesOrders',
    requiredXmlRequest: 'TdlBuilder.buildSalesOrderRequest(opt) [TYPE=Collection, ID=SalesOrderCollection]',
    parameters: [
      { name: 'fromDate', label: 'From Date (YYYY-MM-DD)', required: false, default: '2026-04-01' },
      { name: 'toDate', label: 'To Date (YYYY-MM-DD)', required: false, default: '2027-03-31' }
    ],
    expectedXmlResponse: '<COLLECTION><VOUCHER VOUCHERTYPENAME="Sales Order">...</VOUCHER></COLLECTION>',
    normalizedFields: [
      'id', 'guid', 'orderNumber', 'voucherNumber', 'date', 'dueDate', 'voucherType',
      'partyName', 'partyGstin', 'placeOfSupply', 'narration', 'amount', 'totalInvoice',
      'items', 'ledgerEntries'
    ],
    csvColumns: DATASET_SCHEMAS.sales_orders.columns
  },
  {
    id: 'purchase_orders',
    name: 'Purchase Orders',
    category: ENTITY_CATEGORIES.TRANSACTION,
    type: 'transaction',
    isReport: false,
    requestType: REQUEST_TYPES.COLLECTION,
    tallyId: 'PurchaseOrderCollection',
    tdlType: 'Voucher',
    tdlFilter: 'IsPurchaseOrder',
    description: 'Supplier purchase orders and procurement lines',
    fileNamePrefix: 'purchase_orders',
    fetchMethod: 'fetchPurchaseOrders',
    parserMethod: 'normalizePurchaseOrders',
    requiredXmlRequest: 'TdlBuilder.buildPurchaseOrderRequest(opt) [TYPE=Collection, ID=PurchaseOrderCollection]',
    parameters: [
      { name: 'fromDate', label: 'From Date (YYYY-MM-DD)', required: false, default: '2026-04-01' },
      { name: 'toDate', label: 'To Date (YYYY-MM-DD)', required: false, default: '2027-03-31' }
    ],
    expectedXmlResponse: '<COLLECTION><VOUCHER VOUCHERTYPENAME="Purchase Order">...</VOUCHER></COLLECTION>',
    normalizedFields: [
      'id', 'guid', 'orderNumber', 'voucherNumber', 'date', 'dueDate', 'voucherType',
      'partyName', 'partyGstin', 'placeOfSupply', 'narration', 'amount', 'totalInvoice',
      'items', 'ledgerEntries'
    ],
    csvColumns: DATASET_SCHEMAS.purchase_orders.columns
  },
  {
    id: 'delivery_notes',
    name: 'Delivery Notes',
    category: ENTITY_CATEGORIES.TRANSACTION,
    type: 'transaction',
    isReport: false,
    requestType: REQUEST_TYPES.COLLECTION,
    tallyId: 'DeliveryNoteCollection',
    tdlType: 'Voucher',
    tdlFilter: 'IsDeliveryNote',
    description: 'Goods dispatch / delivery challans with inventory tracking',
    fileNamePrefix: 'delivery_notes',
    fetchMethod: 'fetchDeliveryNotes',
    parserMethod: 'normalizeDeliveryNotes',
    requiredXmlRequest: 'TdlBuilder.buildDeliveryNoteRequest(opt) [TYPE=Collection, ID=DeliveryNoteCollection]',
    parameters: [
      { name: 'fromDate', label: 'From Date (YYYY-MM-DD)', required: false, default: '2026-04-01' },
      { name: 'toDate', label: 'To Date (YYYY-MM-DD)', required: false, default: '2027-03-31' }
    ],
    expectedXmlResponse: '<COLLECTION><VOUCHER VOUCHERTYPENAME="Delivery Note">...</VOUCHER></COLLECTION>',
    normalizedFields: [
      'id', 'guid', 'voucherNumber', 'date', 'dueDate', 'voucherType', 'partyName',
      'partyGstin', 'placeOfSupply', 'narration', 'amount', 'totalInvoice', 'items', 'ledgerEntries'
    ],
    csvColumns: DATASET_SCHEMAS.delivery_notes.columns
  },
  {
    id: 'receipt_notes',
    name: 'Receipt Notes',
    category: ENTITY_CATEGORIES.TRANSACTION,
    type: 'transaction',
    isReport: false,
    requestType: REQUEST_TYPES.COLLECTION,
    tallyId: 'ReceiptNoteCollection',
    tdlType: 'Voucher',
    tdlFilter: 'IsReceiptNote',
    description: 'Goods receipt / inward notes from vendors',
    fileNamePrefix: 'receipt_notes',
    fetchMethod: 'fetchReceiptNotes',
    parserMethod: 'normalizeReceiptNotes',
    requiredXmlRequest: 'TdlBuilder.buildReceiptNoteRequest(opt) [TYPE=Collection, ID=ReceiptNoteCollection]',
    parameters: [
      { name: 'fromDate', label: 'From Date (YYYY-MM-DD)', required: false, default: '2026-04-01' },
      { name: 'toDate', label: 'To Date (YYYY-MM-DD)', required: false, default: '2027-03-31' }
    ],
    expectedXmlResponse: '<COLLECTION><VOUCHER VOUCHERTYPENAME="Receipt Note">...</VOUCHER></COLLECTION>',
    normalizedFields: [
      'id', 'guid', 'voucherNumber', 'date', 'dueDate', 'voucherType', 'partyName',
      'partyGstin', 'placeOfSupply', 'narration', 'amount', 'totalInvoice', 'items', 'ledgerEntries'
    ],
    csvColumns: DATASET_SCHEMAS.receipt_notes.columns
  },

  // =========================================================================
  // REPORTS (TYPE: Data / Report Request)
  // =========================================================================
  {
    id: 'trial_balance',
    name: 'Trial Balance',
    category: ENTITY_CATEGORIES.REPORT,
    type: 'report',
    isReport: true,
    requestType: REQUEST_TYPES.DATA,
    tallyId: 'TrialBalance',
    description: 'Official Tally Trial Balance report with Opening, Debit, Credit, and Closing balances',
    fileNamePrefix: 'trial_balance',
    fetchMethod: 'fetchTrialBalance',
    parserMethod: 'normalizeTrialBalance',
    requiredXmlRequest: 'TdlBuilder.buildTrialBalanceRequest(opt) [TYPE=Data, ID=TrialBalance, EXPLODEFLAG=Yes, SVCurrentCompany]',
    parameters: [
      { name: 'fromDate', label: 'From Date (YYYY-MM-DD)', required: true, default: '2026-04-01' },
      { name: 'toDate', label: 'To Date (YYYY-MM-DD)', required: true, default: '2026-09-30' }
    ],
    expectedXmlResponse: '<DATA><DSPRECORD><DSPACCNAME>...</DSPACCNAME><DSPOPDRBAL>...</DSPOPDRBAL><DSPDRAMT>...</DSPDRAMT><DSPCRAMT>...</DSPCRAMT><DSPCLDRAMT>...</DSPCLDRAMT></DSPRECORD></DATA>',
    normalizedFields: [
      'guid', 'name', 'parent', 'openingDebit', 'openingCredit', 'openingBalance',
      'debitTotals', 'creditTotals', 'closingDebit', 'closingCredit', 'closingBalance'
    ],
    csvColumns: DATASET_SCHEMAS.trial_balance.columns
  },
  {
    id: 'sales_register',
    name: 'Sales Register',
    category: ENTITY_CATEGORIES.REPORT,
    type: 'report',
    isReport: false,
    requestType: REQUEST_TYPES.COLLECTION,
    tallyId: 'SalesRegisterVouchersCollection',
    tdlType: 'Voucher',
    tdlFilter: 'IsSalesVoucher',
    description: 'Sales invoices register with customer, tax, and inventory breakdowns',
    fileNamePrefix: 'sales_register',
    fetchMethod: 'fetchSalesRegister',
    parserMethod: 'normalizeSalesVouchers',
    requiredXmlRequest: 'TdlBuilder.buildSalesRegisterRequest(opt) [TYPE=Collection, ID=SalesRegisterVouchersCollection]',
    parameters: [
      { name: 'fromDate', label: 'From Date (YYYY-MM-DD)', required: true, default: '2026-04-01' },
      { name: 'toDate', label: 'To Date (YYYY-MM-DD)', required: true, default: '2026-09-30' }
    ],
    expectedXmlResponse: '<COLLECTION><VOUCHER VOUCHERTYPENAME="Sales">...</VOUCHER></COLLECTION>',
    normalizedFields: [
      'id', 'guid', 'voucherNumber', 'date', 'partyName', 'partyGstin',
      'placeOfSupply', 'narration', 'amount', 'totalInvoice', 'items', 'ledgerEntries'
    ],
    csvColumns: DATASET_SCHEMAS.sales_register.columns
  },
  {
    id: 'purchase_register',
    name: 'Purchase Register',
    category: ENTITY_CATEGORIES.REPORT,
    type: 'report',
    isReport: false,
    requestType: REQUEST_TYPES.COLLECTION,
    tallyId: 'PurchaseRegisterVouchersCollection',
    tdlType: 'Voucher',
    tdlFilter: 'IsPurchaseVoucher',
    description: 'Purchase bills register with vendor, tax, and inventory breakdowns',
    fileNamePrefix: 'purchase_register',
    fetchMethod: 'fetchPurchaseRegister',
    parserMethod: 'normalizePurchaseVouchers',
    requiredXmlRequest: 'TdlBuilder.buildPurchaseRegisterRequest(opt) [TYPE=Collection, ID=PurchaseRegisterVouchersCollection]',
    parameters: [
      { name: 'fromDate', label: 'From Date (YYYY-MM-DD)', required: true, default: '2026-04-01' },
      { name: 'toDate', label: 'To Date (YYYY-MM-DD)', required: true, default: '2026-09-30' }
    ],
    expectedXmlResponse: '<COLLECTION><VOUCHER VOUCHERTYPENAME="Purchase">...</VOUCHER></COLLECTION>',
    normalizedFields: [
      'id', 'guid', 'voucherNumber', 'date', 'partyName', 'partyGstin',
      'placeOfSupply', 'narration', 'amount', 'totalInvoice', 'items', 'ledgerEntries'
    ],
    csvColumns: DATASET_SCHEMAS.purchase_register.columns
  },
  {
    id: 'inventory_master',
    name: 'Inventory Master',
    category: ENTITY_CATEGORIES.TRANSACTION,
    type: 'transaction',
    isReport: false,
    requestType: REQUEST_TYPES.COLLECTION,
    tallyId: 'InventoryMasterVouchersCollection',
    tdlType: 'Voucher',
    description: 'Stock movement transactions with inward/outward quantities, rates, godowns, and batches',
    fileNamePrefix: 'inventory_master',
    fetchMethod: 'fetchInventoryMaster',
    parserMethod: 'normalizeInventoryMaster',
    requiredXmlRequest: 'TdlBuilder.buildInventoryMasterRequest(opt) [TYPE=Collection, ID=InventoryMasterVouchersCollection]',
    parameters: [
      { name: 'fromDate', label: 'From Date (YYYY-MM-DD)', required: true, default: '2026-04-01' },
      { name: 'toDate', label: 'To Date (YYYY-MM-DD)', required: true, default: '2026-09-30' }
    ],
    expectedXmlResponse: '<COLLECTION><VOUCHER>...</VOUCHER></COLLECTION>',
    normalizedFields: [
      'id', 'guid', 'code', 'date', 'transactionDate', 'voucherType', 'voucherNumber',
      'documentNo', 'reference', 'voucherRef', 'godown', 'itemName', 'inwardQty',
      'outwardQty', 'rate', 'inwardValue', 'outwardValue', 'closingQty', 'closingValue',
      'batchNo', 'mfgDate', 'expiryDate', 'partyName', 'costCenter', 'remarks'
    ],
    csvColumns: AUTHORITATIVE_SCHEMAS.inventory_master.columns
  },
  {
    id: 'branch',
    name: 'Branch',
    category: ENTITY_CATEGORIES.MASTER,
    type: 'master',
    isReport: false,
    requestType: REQUEST_TYPES.COLLECTION,
    tallyId: 'BranchCollection',
    tdlType: 'Company',
    description: 'Branch offices and GST registration details',
    fileNamePrefix: 'branches',
    fetchMethod: 'fetchBranch',
    parserMethod: 'normalizeBranch',
    requiredXmlRequest: 'TdlBuilder.buildBranchRequest(opt) [TYPE=Collection, ID=BranchCollection]',
    parameters: [],
    expectedXmlResponse: '<COLLECTION><COMPANY>...</COMPANY></COLLECTION>',
    normalizedFields: ['code', 'name', 'gstNo'],
    csvColumns: AUTHORITATIVE_SCHEMAS.branch.columns
  },
  {
    id: 'sales_representative',
    name: 'Sales Representative',
    category: ENTITY_CATEGORIES.MASTER,
    type: 'master',
    isReport: false,
    requestType: REQUEST_TYPES.COLLECTION,
    tallyId: 'SalesRepresentativeCollection',
    tdlType: 'CostCentre',
    description: 'Sales representatives and contact phone numbers',
    fileNamePrefix: 'sales_representatives',
    fetchMethod: 'fetchSalesRepresentative',
    parserMethod: 'normalizeSalesRepresentative',
    requiredXmlRequest: 'TdlBuilder.buildSalesRepresentativeRequest(opt) [TYPE=Collection, ID=SalesRepresentativeCollection]',
    parameters: [],
    expectedXmlResponse: '<COLLECTION><COSTCENTRE>...</COSTCENTRE></COLLECTION>',
    normalizedFields: ['code', 'name', 'mobileNo'],
    csvColumns: AUTHORITATIVE_SCHEMAS.sales_representative.columns
  }
];

const registryMap = new Map();
ENTITY_REGISTRY.forEach(entity => {
  registryMap.set(entity.id.toLowerCase(), entity);
  if (entity.id === 'cost_centers') registryMap.set('cost_centres', entity);
  if (entity.id === 'ledgers') registryMap.set('chart_of_accounts', entity);
  if (entity.id === 'purchase_register') registryMap.set('purchases', entity);
  if (entity.id === 'branch') registryMap.set('branches', entity);
  if (entity.id === 'sales_representative') {
    registryMap.set('sales_representatives', entity);
    registryMap.set('salesrep', entity);
    registryMap.set('sales_rep', entity);
  }
  if (entity.id === 'inventory_master') {
    registryMap.set('inventorymaster', entity);
    registryMap.set('stock_movement', entity);
  }
});

export function getEntityById(id) {
  if (!id) return null;
  const canonical = String(id).trim().toLowerCase().replace(/-/g, '_');
  return registryMap.get(canonical) || null;
}

export function getAllEntities() {
  return [...ENTITY_REGISTRY];
}

export function getEntitiesByCategory(category) {
  return ENTITY_REGISTRY.filter(e => e.category === category);
}

export function getEntitiesByRequestType(requestType) {
  return ENTITY_REGISTRY.filter(e => e.requestType === requestType);
}

export const MASTER_DATA_IDS = new Set([
  'ledgers',
  'groups',
  'cost_centers',
  'customers',
  'vendors',
  'stock_items',
  'inventory',
  'stock_groups',
  'units',
  'godowns',
  'branch',
  'branches',
  'sales_representative',
  'sales_representatives'
]);

export const DATE_FILTERED_IDS = new Set([
  'sales_orders',
  'purchase_orders',
  'delivery_notes',
  'receipt_notes',
  'trial_balance',
  'sales_register',
  'purchase_register',
  'inventory_master',
  'stock_movement'
]);

export function isDateFilteredEntity(id) {
  if (!id) return false;
  const canonical = String(id).trim().toLowerCase().replace(/-/g, '_');
  return DATE_FILTERED_IDS.has(canonical);
}
