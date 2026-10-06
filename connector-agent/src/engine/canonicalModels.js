/**
 * Canonical Data Models for Tally Connect
 * 
 * Defines clean, destination-agnostic canonical business representations of Tally data.
 * Architecture:
 *   TALLY XML -> RAW PARSED TALLY OBJECT -> CANONICAL TALLY MODEL -> TARGET EXPORT SCHEMA -> CSV/XML
 * 
 * Rules:
 * 1. REAL TALLY DATA ONLY: No synthetic or fabricated values.
 * 2. If Tally does not provide a field, it is set to null or empty string.
 * 3. Never produces [object Object]: All values sanitized and unwrapped.
 * 4. Destination-system agnostic: Generic Tally and business terminology.
 */

/**
 * Extracts clean string text from strings, numbers, or XML objects
 * Prevents any accidental [object Object] serialization
 */
export function sanitizeString(val) {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') {
    if (val['#text'] !== undefined && val['#text'] !== null) {
      return String(val['#text']).trim();
    }
    if (val.value !== undefined && val.value !== null) {
      return String(val.value).trim();
    }
    if (val['@_NAME'] !== undefined && val['@_NAME'] !== null) {
      return String(val['@_NAME']).trim();
    }
    if (val.NAME !== undefined && val.NAME !== null) {
      return sanitizeString(val.NAME);
    }
    if (Array.isArray(val)) {
      return val.map(sanitizeString).filter(Boolean).join(', ');
    }
    return '';
  }
  return String(val).trim();
}

/**
 * Parses numeric amounts cleanly without producing NaN
 */
export function sanitizeAmount(val, defaultVal = 0) {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (typeof val === 'object') {
    val = val['#text'] ?? val.value ?? defaultVal;
  }
  const cleanStr = String(val).replace(/,/g, '').trim();
  const num = parseFloat(cleanStr);
  return isNaN(num) ? defaultVal : num;
}

/**
 * Parses quantity values from Tally quantity strings (e.g. "100 NOS" -> 100)
 */
export function sanitizeQty(val, defaultVal = 0) {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (typeof val === 'object') {
    val = val['#text'] ?? val.value ?? defaultVal;
  }
  const match = String(val).match(/[-+]?[0-9]*\.?[0-9]+/);
  return match ? parseFloat(match[0]) : defaultVal;
}

/**
 * Formats Tally date (YYYYMMDD or ISO) into YYYY-MM-DD
 */
export function sanitizeDate(val) {
  if (!val) return '';
  let str = val;
  if (typeof val === 'object') {
    str = val['#text'] ?? val.value ?? '';
  }
  const clean = String(str).trim();
  if (clean.length === 8 && /^\d{8}$/.test(clean)) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }
  return clean;
}

/**
 * Extracts 10-digit PAN from 15-character Indian GSTIN
 */
export function extractPanFromGstin(gstin) {
  if (!gstin) return '';
  const clean = String(gstin).trim();
  if (clean.length === 15) {
    return clean.slice(2, 12);
  }
  return '';
}

// ============================================================================
// 1. CANONICAL TRIAL BALANCE
// ============================================================================
export class CanonicalTrialBalance {
  constructor(raw = {}) {
    this.guid = sanitizeString(raw.guid);
    this.name = sanitizeString(raw.name || raw.ledgerName);
    this.parent = sanitizeString(raw.parent || raw.group);
    this.particulars = sanitizeString(raw.particulars || raw.parent || raw.group);
    this.branch = sanitizeString(raw.branch);
    this.monthYear = sanitizeString(raw.monthYear);

    const op = sanitizeAmount(raw.openingBalance ?? raw.opening, 0);
    const dr = sanitizeAmount(raw.debitTotals ?? raw.debit, 0);
    const cr = sanitizeAmount(raw.creditTotals ?? raw.credit, 0);
    const cl = sanitizeAmount(raw.closingBalance ?? raw.closing, 0);

    this.openingDebit = raw.openingDebit != null ? sanitizeAmount(raw.openingDebit) : (op > 0 ? op : 0);
    this.openingCredit = raw.openingCredit != null ? sanitizeAmount(raw.openingCredit) : (op < 0 ? Math.abs(op) : 0);
    this.openingBalance = op;

    this.debit = dr;
    this.credit = cr;

    this.closingDebit = raw.closingDebit != null ? sanitizeAmount(raw.closingDebit) : (cl > 0 ? cl : 0);
    this.closingCredit = raw.closingCredit != null ? sanitizeAmount(raw.closingCredit) : (cl < 0 ? Math.abs(cl) : 0);
    this.closingBalance = cl;

    this.drCr = raw.drCr || (cl >= 0 ? 'Dr' : 'Cr');
  }
}

// ============================================================================
// 2. CANONICAL LEDGER (Chart of Accounts)
// ============================================================================
export class CanonicalLedger {
  constructor(raw = {}) {
    this.guid = sanitizeString(raw.guid);
    this.code = sanitizeString(raw.code || (raw.guid ? raw.guid.slice(0, 10) : ''));
    this.name = sanitizeString(raw.name);
    this.parent = sanitizeString(raw.parent);
    this.grouping = sanitizeString(raw.grouping || raw.parent);
    this.description = sanitizeString(raw.description);
    this.openingBalance = sanitizeAmount(raw.openingBalance);
    this.closingBalance = sanitizeAmount(raw.closingBalance);
    this.gstApplicable = sanitizeString(raw.gstApplicable);
    this.isCostCentresOn = Boolean(raw.isCostCentresOn);
    this.mailingName = sanitizeString(raw.mailingName || raw.name);

    let address = '';
    if (Array.isArray(raw.mailingDetails?.addressLines)) {
      address = raw.mailingDetails.addressLines.map(sanitizeString).filter(Boolean).join(', ');
    } else if (raw.address) {
      address = sanitizeString(raw.address);
    }
    this.address = address;
    this.city = sanitizeString(raw.mailingDetails?.city || raw.city);
    this.state = sanitizeString(raw.mailingDetails?.state || raw.state);
    this.pincode = sanitizeString(raw.mailingDetails?.postalCode || raw.pincode);
    this.country = sanitizeString(raw.mailingDetails?.country || raw.country || 'India');

    this.gstin = sanitizeString(raw.gstin || raw.statutory?.gstin);
    this.pan = sanitizeString(raw.pan || raw.statutory?.pan || extractPanFromGstin(this.gstin));
    this.phone = sanitizeString(raw.phone || raw.contact?.phone);
    this.email = sanitizeString(raw.email || raw.contact?.email);
    this.narration = sanitizeString(raw.narration);
    this.active = raw.active !== false;
    this.remarks = sanitizeString(raw.remarks || raw.narration);
  }
}

// ============================================================================
// 3. CANONICAL CUSTOMER (Customer Master)
// ============================================================================
export class CanonicalCustomer {
  constructor(raw = {}) {
    this.guid = sanitizeString(raw.guid);
    this.code = sanitizeString(raw.code || (raw.guid ? raw.guid.slice(0, 10) : ''));
    this.name = sanitizeString(raw.name);
    this.parent = sanitizeString(raw.parent);
    this.customerType = sanitizeString(raw.customerType || raw.parent);
    this.accountStatus = raw.accountStatus || (raw.active !== false ? 'Active' : 'Inactive');

    this.contactName = sanitizeString(raw.contact?.name || raw.contactName);
    this.contactEmail = sanitizeString(raw.contact?.email || raw.email);
    this.contactPhone = sanitizeString(raw.contact?.phone || raw.phone);

    let address = '';
    if (Array.isArray(raw.mailingDetails?.addressLines)) {
      address = raw.mailingDetails.addressLines.map(sanitizeString).filter(Boolean).join(', ');
    } else if (raw.address) {
      address = sanitizeString(raw.address);
    }
    this.address = address;
    this.city = sanitizeString(raw.mailingDetails?.city || raw.city);
    this.state = sanitizeString(raw.mailingDetails?.state || raw.state);
    this.pincode = sanitizeString(raw.mailingDetails?.postalCode || raw.pincode);
    this.country = sanitizeString(raw.mailingDetails?.country || raw.country || 'India');

    this.gstRegType = sanitizeString(raw.statutory?.gstRegType || raw.gstRegType);
    this.gstin = sanitizeString(raw.statutory?.gstin || raw.gstin);
    this.gstStateCode = sanitizeString(raw.statutory?.gstStateCode || (this.gstin.length >= 2 ? this.gstin.slice(0, 2) : ''));
    this.gstStateName = sanitizeString(raw.statutory?.gstStateName || this.state);
    this.pan = sanitizeString(raw.statutory?.pan || raw.pan || extractPanFromGstin(this.gstin));

    this.creditDays = raw.creditPolicy?.creditDays ?? raw.creditDays ?? '';
    this.creditLimit = raw.creditPolicy?.creditLimit ?? raw.creditLimit ?? '';
    this.paymentTerms = sanitizeString(raw.creditPolicy?.paymentTerms || raw.paymentTerms || (this.creditDays ? `${this.creditDays} Days` : ''));
    this.currency = sanitizeString(raw.creditPolicy?.currency || raw.currency || 'INR');

    this.branch = sanitizeString(raw.branch || raw.organization?.branch);
    this.salesRepresentative = sanitizeString(raw.salesRepresentative || raw.organization?.salesRepresentative);

    this.bankName = sanitizeString(raw.banking?.bankName || raw.bankName);
    this.ifscCode = sanitizeString(raw.banking?.ifscCode || raw.ifscCode);
    this.accountNumber = sanitizeString(raw.banking?.accountNumber || raw.accountNumber);

    this.openingBalance = sanitizeAmount(raw.openingBalance);
    this.closingBalance = sanitizeAmount(raw.closingBalance);
    this.active = raw.active !== false;
    this.remarks = sanitizeString(raw.remarks || raw.narration);
  }
}

// ============================================================================
// 4. CANONICAL VENDOR (Vendor Master)
// ============================================================================
export class CanonicalVendor {
  constructor(raw = {}) {
    this.guid = sanitizeString(raw.guid);
    this.code = sanitizeString(raw.code || (raw.guid ? raw.guid.slice(0, 10) : ''));
    this.name = sanitizeString(raw.name);
    this.parent = sanitizeString(raw.parent);
    this.vendorType = sanitizeString(raw.vendorType || raw.parent);
    this.status = raw.status || (raw.active !== false ? 'Active' : 'Inactive');

    this.contactName = sanitizeString(raw.contact?.name || raw.contactName);
    this.contactEmail = sanitizeString(raw.contact?.email || raw.email);
    this.contactPhone = sanitizeString(raw.contact?.phone || raw.phone);

    let address = '';
    if (Array.isArray(raw.mailingDetails?.addressLines)) {
      address = raw.mailingDetails.addressLines.map(sanitizeString).filter(Boolean).join(', ');
    } else if (raw.address) {
      address = sanitizeString(raw.address);
    }
    this.address = address;
    this.city = sanitizeString(raw.mailingDetails?.city || raw.city);
    this.state = sanitizeString(raw.mailingDetails?.state || raw.state);
    this.pincode = sanitizeString(raw.mailingDetails?.postalCode || raw.pincode);
    this.country = sanitizeString(raw.mailingDetails?.country || raw.country || 'India');

    this.gstin = sanitizeString(raw.statutory?.gstin || raw.gstin);
    this.gstStateCode = sanitizeString(raw.statutory?.gstStateCode || (this.gstin.length >= 2 ? this.gstin.slice(0, 2) : ''));
    this.gstStateName = sanitizeString(raw.statutory?.stateName || this.state);
    this.pan = sanitizeString(raw.statutory?.pan || raw.pan || extractPanFromGstin(this.gstin));

    this.creditLimit = raw.creditPolicy?.creditLimit ?? raw.creditLimit ?? '';
    this.paymentTerms = sanitizeString(raw.creditPolicy?.paymentTerms || raw.paymentTerms || (raw.creditPolicy?.creditDays ? `${raw.creditPolicy.creditDays} Days` : ''));
    this.currency = sanitizeString(raw.currency || 'INR');

    this.bankName = sanitizeString(raw.banking?.bankName || raw.bankName);
    this.ifscCode = sanitizeString(raw.banking?.ifscCode || raw.ifscCode);
    this.accountNumber = sanitizeString(raw.banking?.accountNumber || raw.accountNumber);

    this.natureOfVendor = sanitizeString(raw.natureOfVendor || raw.parent);
    this.tdsCategory = sanitizeString(raw.tdsCategory);
    this.tdsSection = sanitizeString(raw.tdsSection);

    this.openingBalance = sanitizeAmount(raw.openingBalance);
    this.closingBalance = sanitizeAmount(raw.closingBalance);
    this.active = raw.active !== false;
    this.remarks = sanitizeString(raw.remarks || raw.narration);
  }
}

// ============================================================================
// 5. CANONICAL SALES TRANSACTION & LINE ITEM
// ============================================================================
export class CanonicalLineItem {
  constructor(raw = {}) {
    this.itemName = sanitizeString(raw.itemName || raw.stockItemName || raw.itemDescription);
    this.itemDescription = sanitizeString(raw.itemDescription || this.itemName);
    this.hsn = sanitizeString(raw.hsn || raw.hsnCode);
    this.quantity = sanitizeQty(raw.quantity ?? raw.qty ?? raw.billedQty, 0);
    this.unit = sanitizeString(raw.unit || raw.baseUnits);
    this.rate = sanitizeAmount(raw.rate, 0);
    this.discount = sanitizeAmount(raw.discount, 0);
    this.amount = sanitizeAmount(raw.amount, 0);
    this.taxValue = sanitizeAmount(raw.taxValue ?? raw.amount, 0);
    this.godown = sanitizeString(raw.godown || raw.godownName);

    this.cgstRate = raw.cgstRate != null && Number(raw.cgstRate) > 0 ? `${Number(raw.cgstRate)}%` : sanitizeString(raw.cgst);
    this.cgstAmount = sanitizeAmount(raw.cgstAmount, 0);
    this.sgstRate = raw.sgstRate != null && Number(raw.sgstRate) > 0 ? `${Number(raw.sgstRate)}%` : sanitizeString(raw.sgst);
    this.sgstAmount = sanitizeAmount(raw.sgstAmount, 0);
    this.igstRate = raw.igstRate != null && Number(raw.igstRate) > 0 ? `${Number(raw.igstRate)}%` : sanitizeString(raw.igst);
    this.igstAmount = sanitizeAmount(raw.igstAmount, 0);
  }
}

export class CanonicalSalesTransaction {
  constructor(raw = {}) {
    this.voucherId = sanitizeString(raw.guid || raw.id || raw.voucherKey);
    this.voucherNumber = sanitizeString(raw.voucherNumber || raw.invoiceNo);
    this.date = sanitizeDate(raw.date || raw.salesDate || raw.invoiceDate);
    this.invoiceDate = sanitizeDate(raw.invoiceDate || this.date);
    this.voucherType = sanitizeString(raw.voucherType || 'Sales');

    this.customerName = sanitizeString(raw.partyName || raw.partyLedgerName || raw.customer);
    this.customerCode = sanitizeString(raw.partyCode || (this.voucherId ? this.voucherId.slice(0, 10) : ''));
    this.gstin = sanitizeString(raw.partyGstin || raw.gstin);
    this.customerType = sanitizeString(raw.customerType);
    this.salesType = sanitizeString(raw.salesType || this.voucherType);

    this.branch = sanitizeString(raw.branchName || raw.branch);
    this.costCenter = sanitizeString(raw.costCenter);
    this.placeOfSupply = sanitizeString(raw.placeOfSupply);
    this.dueDate = sanitizeDate(raw.dueDate || raw.basicDueDate || this.date);
    this.paymentTerms = sanitizeString(raw.paymentTerms);
    this.modeOfPayment = sanitizeString(raw.modeOfPayment);

    this.otherCharges = sanitizeAmount(raw.otherCharges, 0);
    this.totalInvoice = sanitizeAmount(raw.totalInvoice ?? raw.amount, 0);
    this.narration = sanitizeString(raw.narration || raw.remarks);

    const rawItems = Array.isArray(raw.items) ? raw.items : (Array.isArray(raw.allInventoryEntries) ? raw.allInventoryEntries : []);
    this.items = rawItems.map(it => new CanonicalLineItem(it));
  }
}

// ============================================================================
// 6. CANONICAL PURCHASE TRANSACTION
// ============================================================================
export class CanonicalPurchaseTransaction {
  constructor(raw = {}) {
    this.voucherId = sanitizeString(raw.guid || raw.id || raw.voucherKey);
    this.voucherNumber = sanitizeString(raw.voucherNumber || raw.invoiceNo);
    this.date = sanitizeDate(raw.date || raw.purchaseDate || raw.invoiceDate);
    this.invoiceDate = sanitizeDate(raw.invoiceDate || this.date);
    this.voucherType = sanitizeString(raw.voucherType || 'Purchase');

    this.vendorName = sanitizeString(raw.partyName || raw.partyLedgerName || raw.vendor);
    this.vendorCode = sanitizeString(raw.partyCode || (this.voucherId ? this.voucherId.slice(0, 10) : ''));
    this.gstin = sanitizeString(raw.partyGstin || raw.gstin);
    this.vendorType = sanitizeString(raw.vendorType);
    this.purchaseType = sanitizeString(raw.purchaseType || this.voucherType);

    this.branch = sanitizeString(raw.branchName || raw.branch);
    this.costCenter = sanitizeString(raw.costCenter);
    this.placeOfSupply = sanitizeString(raw.placeOfSupply);
    this.dueDate = sanitizeDate(raw.dueDate || raw.basicDueDate || this.date);
    this.paymentTerms = sanitizeString(raw.paymentTerms);
    this.modeOfPayment = sanitizeString(raw.modeOfPayment);

    this.grnNo = sanitizeString(raw.grnNo || raw.reference);
    this.poReferenceNo = sanitizeString(raw.poReferenceNo || raw.orderRef);
    this.totalInvoice = sanitizeAmount(raw.totalInvoice ?? raw.amount, 0);
    this.narration = sanitizeString(raw.narration || raw.remarks);

    const rawItems = Array.isArray(raw.items) ? raw.items : (Array.isArray(raw.allInventoryEntries) ? raw.allInventoryEntries : []);
    this.items = rawItems.map(it => new CanonicalLineItem(it));
  }
}

// ============================================================================
// 7. CANONICAL ITEM & INVENTORY
// ============================================================================
export class CanonicalItem {
  constructor(raw = {}) {
    this.guid = sanitizeString(raw.guid);
    this.code = sanitizeString(raw.code || raw.partNo || (raw.guid ? raw.guid.slice(0, 10) : ''));
    this.name = sanitizeString(raw.name);
    this.description = sanitizeString(raw.description || this.name);
    this.parent = sanitizeString(raw.parent);
    this.category = sanitizeString(raw.category);
    this.hsn = sanitizeString(raw.hsnCode || raw.hsn);
    this.uom = sanitizeString(raw.uom || raw.baseUnits);

    this.gstApplicable = sanitizeString(raw.gstApplicable);
    this.gstRate = sanitizeAmount(raw.gstRate, 0);

    this.costingMethod = sanitizeString(raw.costingMethod);
    this.standardCost = sanitizeAmount(raw.standardCost, 0);
    this.standardPrice = sanitizeAmount(raw.standardPrice, 0);
    this.mrp = sanitizeAmount(raw.mrp, 0);

    this.reorderLevel = sanitizeQty(raw.reorderLevel ?? raw.reorderBase, 0);
    this.minStockQty = sanitizeQty(raw.minStockQty ?? raw.minOrderQty, 0);
    this.maxStockQty = sanitizeQty(raw.maxStockQty ?? raw.maxStockLevel, 0);

    this.openingQuantity = sanitizeQty(raw.openingQuantity ?? raw.openingBalance, 0);
    this.openingRate = sanitizeAmount(raw.openingRate, 0);
    this.openingValue = sanitizeAmount(raw.openingValue, 0);

    this.closingQuantity = sanitizeQty(raw.closingQuantity ?? raw.closingBalance, 0);
    this.closingRate = sanitizeAmount(raw.closingRate, 0);
    this.closingValue = sanitizeAmount(raw.closingValue, 0);

    this.status = raw.status || (raw.active !== false ? 'Active' : 'Inactive');
    this.active = raw.active !== false;
  }
}

// ============================================================================
// 8. CANONICAL COST CENTER
// ============================================================================
export class CanonicalCostCenter {
  constructor(raw = {}) {
    this.guid = sanitizeString(raw.guid);
    this.code = sanitizeString(raw.code || (raw.guid ? raw.guid.slice(0, 10) : ''));
    this.name = sanitizeString(raw.name);
    this.parent = sanitizeString(raw.parent);
    this.category = sanitizeString(raw.category);
    this.branch = sanitizeString(raw.branch || raw.category || raw.parent);
  }
}

// ============================================================================
// 9. CANONICAL GODOWN
// ============================================================================
export class CanonicalGodown {
  constructor(raw = {}) {
    this.guid = sanitizeString(raw.guid);
    this.code = sanitizeString(raw.code || (raw.guid ? raw.guid.slice(0, 10) : ''));
    this.name = sanitizeString(raw.name);
    this.parent = sanitizeString(raw.parent);
    this.address = sanitizeString(raw.address);
    this.pincode = sanitizeString(raw.pincode);
    this.active = raw.active !== false;
  }
}

// ============================================================================
// 10. CANONICAL GROUP & UNIT & ORDERS
// ============================================================================
export class CanonicalGroup {
  constructor(raw = {}) {
    this.guid = sanitizeString(raw.guid);
    this.name = sanitizeString(raw.name);
    this.parent = sanitizeString(raw.parent);
    this.isAddable = Boolean(raw.isAddable);
    this.isSubLedger = Boolean(raw.isSubLedger);
    this.isCalculate = Boolean(raw.isCalculate);
  }
}

export class CanonicalUnit {
  constructor(raw = {}) {
    this.guid = sanitizeString(raw.guid);
    this.name = sanitizeString(raw.name);
    this.originalName = sanitizeString(raw.originalName || raw.name);
    this.decimalPlaces = parseInt(sanitizeString(raw.decimalPlaces) || '0', 10) || 0;
    this.isGstExcluded = Boolean(raw.isGstExcluded);
  }
}

export class CanonicalOrder {
  constructor(raw = {}, kind = 'sales_orders') {
    this.kind = kind;
    this.guid = sanitizeString(raw.guid);
    this.orderNumber = sanitizeString(raw.orderNumber || raw.voucherNumber);
    this.date = sanitizeDate(raw.date);
    this.dueDate = sanitizeDate(raw.dueDate || this.date);
    this.partyName = sanitizeString(raw.partyName || raw.partyLedgerName);
    this.gstin = sanitizeString(raw.partyGstin || raw.gstin);
    this.placeOfSupply = sanitizeString(raw.placeOfSupply);
    this.narration = sanitizeString(raw.narration);
    this.total = sanitizeAmount(raw.totalInvoice ?? raw.amount, 0);

    const rawItems = Array.isArray(raw.items) ? raw.items : (Array.isArray(raw.allInventoryEntries) ? raw.allInventoryEntries : []);
    this.items = rawItems.map(it => new CanonicalLineItem(it));
  }
}

export class CanonicalNote {
  constructor(raw = {}, kind = 'delivery_notes') {
    this.kind = kind;
    this.guid = sanitizeString(raw.guid);
    this.noteNumber = sanitizeString(raw.voucherNumber || raw.noteNumber);
    this.date = sanitizeDate(raw.date);
    this.dueDate = sanitizeDate(raw.dueDate || this.date);
    this.partyName = sanitizeString(raw.partyName || raw.partyLedgerName);
    this.gstin = sanitizeString(raw.partyGstin || raw.gstin);
    this.placeOfSupply = sanitizeString(raw.placeOfSupply);
    this.narration = sanitizeString(raw.narration);
    this.total = sanitizeAmount(raw.totalInvoice ?? raw.amount, 0);

    const rawItems = Array.isArray(raw.items) ? raw.items : (Array.isArray(raw.allInventoryEntries) ? raw.allInventoryEntries : []);
    this.items = rawItems.map(it => new CanonicalLineItem(it));
  }
}

// ============================================================================
// CANONICAL FACTORY DISPATCHER
// ============================================================================
export function toCanonical(datasetType, rawRecord) {
  if (!rawRecord || typeof rawRecord !== 'object') return null;
  const canonicalType = String(datasetType).trim().toLowerCase().replace(/[-\s]/g, '_');

  switch (canonicalType) {
    case 'trial_balance':
    case 'trialbalance':
    case 'trial_balances':
      return new CanonicalTrialBalance(rawRecord);

    case 'ledgers':
    case 'ledger':
    case 'chart_of_accounts':
    case 'chartaccounts':
      return new CanonicalLedger(rawRecord);

    case 'customers':
    case 'customer':
      return new CanonicalCustomer(rawRecord);

    case 'vendors':
    case 'vendor':
      return new CanonicalVendor(rawRecord);

    case 'sales_register':
    case 'sales':
      return new CanonicalSalesTransaction(rawRecord);

    case 'purchase_register':
    case 'purchases':
    case 'purchase':
      return new CanonicalPurchaseTransaction(rawRecord);

    case 'stock_items':
    case 'stock_item':
    case 'items':
    case 'item_master':
    case 'inventory':
      return new CanonicalItem(rawRecord);

    case 'cost_centers':
    case 'cost_centres':
    case 'cost_center':
    case 'cost_centre':
      return new CanonicalCostCenter(rawRecord);

    case 'godowns':
    case 'godown':
      return new CanonicalGodown(rawRecord);

    case 'groups':
    case 'group':
      return new CanonicalGroup(rawRecord);

    case 'stock_groups':
    case 'stock_group':
      return new CanonicalGroup(rawRecord);

    case 'units':
    case 'unit':
      return new CanonicalUnit(rawRecord);

    case 'sales_orders':
    case 'sales_order':
      return new CanonicalOrder(rawRecord, 'sales_orders');

    case 'purchase_orders':
    case 'purchase_order':
      return new CanonicalOrder(rawRecord, 'purchase_orders');

    case 'delivery_notes':
    case 'delivery_note':
      return new CanonicalNote(rawRecord, 'delivery_notes');

    case 'receipt_notes':
    case 'receipt_note':
      return new CanonicalNote(rawRecord, 'receipt_notes');

    default:
      return rawRecord;
  }
}
