import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CanonicalTrialBalance,
  CanonicalLedger,
  CanonicalCustomer,
  CanonicalVendor,
  CanonicalSalesTransaction,
  CanonicalPurchaseTransaction,
  CanonicalItem,
  CanonicalCostCenter,
  CanonicalGodown,
  CanonicalGroup,
  CanonicalUnit,
  CanonicalOrder,
  CanonicalNote,
  CanonicalLineItem,
  sanitizeString,
  sanitizeAmount,
  sanitizeQty,
  sanitizeDate,
  extractPanFromGstin
} from '../../connector-agent/src/engine/canonicalModels.js';
import {
  getSchema,
  CANONICAL_SCHEMAS,
  AUTHORITATIVE_SCHEMAS,
  setDefaultExportProfile,
  getDefaultExportProfile
} from '../../connector-agent/src/engine/schemas.js';
import { Transformer } from '../../connector-agent/src/engine/transformer.js';
import { CsvExporter } from '../../connector-agent/src/export/csvExporter.js';
import { LocalExportStorage } from '../../connector-agent/src/storage/localExportStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempExportDir = path.resolve(__dirname, 'temp_canonical_exports');

function assert(condition, message) {
  if (!condition) {
    console.error(`✖ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✔ ${message}`);
}

async function runCanonicalExportEngineTests() {
  console.log('===============================================================');
  console.log('🚀 CANONICAL DATA MODEL & DUAL-PROFILE EXPORT ENGINE TESTS');
  console.log('===============================================================\n');

  if (fs.existsSync(tempExportDir)) {
    fs.rmSync(tempExportDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempExportDir, { recursive: true });
  const storage = new LocalExportStorage({ baseDir: tempExportDir });

  // --------------------------------------------------------------------------
  // TEST GROUP 1: Sanitizers & Zero Fabrication Verification
  // --------------------------------------------------------------------------
  console.log('▶ Test 1: Sanitizers & Zero-Fabrication Integrity');
  assert(sanitizeString(' Hello ') === 'Hello', 'sanitizeString trims strings');
  assert(sanitizeString(123) === '123', 'sanitizeString converts numbers');
  assert(sanitizeString(null) === '', 'sanitizeString converts null to empty string');
  assert(sanitizeString(undefined) === '', 'sanitizeString converts undefined to empty string');
  assert(sanitizeString({ '#text': 'Tally Node' }) === 'Tally Node', 'sanitizeString handles #text');
  assert(sanitizeString({ value: 'Val Node' }) === 'Val Node', 'sanitizeString handles value');
  assert(sanitizeString({ '@_NAME': 'Attr Name' }) === 'Attr Name', 'sanitizeString handles @_NAME');
  assert(sanitizeString(['Line 1', 'Line 2']) === 'Line 1, Line 2', 'sanitizeString handles string arrays');
  assert(sanitizeString({ random: 'unknownObj' }) === '', 'sanitizeString never emits [object Object]');

  assert(sanitizeAmount('1,25,000.50') === 125000.5, 'sanitizeAmount parses Indian comma formatted amounts');
  assert(sanitizeAmount('-500.00') === -500, 'sanitizeAmount parses negative numbers');
  assert(sanitizeAmount(null) === 0, 'sanitizeAmount handles null with default 0');

  assert(sanitizeQty('150.50 NOS') === 150.5, 'sanitizeQty parses numeric quantity from string with UOM');
  assert(sanitizeQty('100 PCS') === 100, 'sanitizeQty parses integer quantity');

  assert(sanitizeDate('20260401') === '2026-04-01', 'sanitizeDate converts YYYYMMDD to YYYY-MM-DD');
  assert(sanitizeDate('2026-04-01') === '2026-04-01', 'sanitizeDate preserves valid YYYY-MM-DD');

  assert(extractPanFromGstin('27AAAAA0000A1Z5') === 'AAAAA0000A', 'extractPanFromGstin extracts 10-char PAN');
  assert(extractPanFromGstin('SHORT') === '', 'extractPanFromGstin returns empty string for invalid GSTIN');

  // --------------------------------------------------------------------------
  // TEST GROUP 2: Canonical Domain Model Instantiation & Field Accuracy
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 2: Canonical Domain Models Accuracy');
  
  // Trial Balance
  const tb = new CanonicalTrialBalance({
    name: 'State Bank of India',
    group: 'Bank Accounts',
    opening: '50000.00',
    debit: '120000.00',
    credit: '45000.00',
    closing: '125000.00'
  });
  assert(tb.name === 'State Bank of India', 'CanonicalTrialBalance name extracted');
  assert(tb.parent === 'Bank Accounts', 'CanonicalTrialBalance group extracted');
  assert(tb.openingDebit === 50000, 'CanonicalTrialBalance opening debit calculated');
  assert(tb.openingCredit === 0, 'CanonicalTrialBalance opening credit zero for positive balance');
  assert(tb.closingBalance === 125000, 'CanonicalTrialBalance closing balance matches');

  // Customer
  const cust = new CanonicalCustomer({
    name: 'Precision Tools & Dies Corp',
    parent: 'Sundry Debtors',
    statutory: { gstin: '27AABCP1234F1Z1' },
    contact: { phone: '9876543210', email: 'sales@precisiontools.com' },
    mailingDetails: { city: 'Pune', state: 'Maharashtra', postalCode: '411018' }
  });
  assert(cust.name === 'Precision Tools & Dies Corp', 'CanonicalCustomer name matches');
  assert(cust.pan === 'AABCP1234F', 'CanonicalCustomer PAN extracted from GSTIN');
  assert(cust.city === 'Pune' && cust.state === 'Maharashtra', 'CanonicalCustomer address details mapped');
  assert(cust.branch === '', 'CanonicalCustomer branch is empty when not provided (NO FABRICATION)');
  assert(cust.salesRepresentative === '', 'CanonicalCustomer salesRepresentative is empty when not provided');

  // Vendor
  const vend = new CanonicalVendor({
    name: 'Global Metal Alloys Pvt Ltd',
    parent: 'Sundry Creditors',
    statutory: { gstin: '24AAACG9876K1Z9' },
    creditPolicy: { creditDays: 45, creditLimit: 500000 }
  });
  assert(vend.name === 'Global Metal Alloys Pvt Ltd', 'CanonicalVendor name matches');
  assert(vend.pan === 'AAACG9876K', 'CanonicalVendor PAN extracted from GSTIN');
  assert(vend.paymentTerms === '45 Days', 'CanonicalVendor paymentTerms formatted');
  assert(vend.creditLimit === 500000, 'CanonicalVendor creditLimit mapped');

  // Sales Transaction & Line Items
  const salesTx = new CanonicalSalesTransaction({
    id: 'VOUCHER-S-001',
    voucherNumber: 'INV-2026-001',
    date: '20260515',
    partyName: 'Precision Tools & Dies Corp',
    partyGstin: '27AABCP1234F1Z1',
    totalInvoice: 118000,
    items: [
      {
        stockItemName: 'Industrial Motor 5HP',
        billedQty: '10 NOS',
        rate: 10000,
        amount: 100000,
        cgstRate: 9,
        cgstAmount: 9000,
        sgstRate: 9,
        sgstAmount: 9000,
        godownName: 'Main Warehouse'
      }
    ]
  });
  assert(salesTx.voucherNumber === 'INV-2026-001', 'CanonicalSalesTransaction invoice number extracted');
  assert(salesTx.date === '2026-05-15', 'CanonicalSalesTransaction date formatted');
  assert(salesTx.items.length === 1, 'CanonicalSalesTransaction line item count matches');
  assert(salesTx.items[0].itemName === 'Industrial Motor 5HP', 'Line item name mapped');
  assert(salesTx.items[0].quantity === 10, 'Line item quantity parsed');
  assert(salesTx.items[0].cgstRate === '9%', 'Line item CGST rate formatted');
  assert(salesTx.items[0].godown === 'Main Warehouse', 'Line item godown mapped');

  // Purchase Transaction & Line Items
  const purchTx = new CanonicalPurchaseTransaction({
    id: 'VOUCHER-P-001',
    voucherNumber: 'BILL-2026-889',
    date: '20260510',
    partyName: 'Global Metal Alloys Pvt Ltd',
    partyGstin: '24AAACG9876K1Z9',
    totalInvoice: 59000,
    reference: 'GRN-0012',
    items: [
      {
        stockItemName: 'Copper Wire Spool',
        billedQty: '5 NOS',
        rate: 10000,
        amount: 50000,
        igstRate: 18,
        igstAmount: 9000,
        godownName: 'Raw Material Store'
      }
    ]
  });
  assert(purchTx.voucherNumber === 'BILL-2026-889', 'CanonicalPurchaseTransaction bill number extracted');
  assert(purchTx.grnNo === 'GRN-0012', 'CanonicalPurchaseTransaction GRN extracted');
  assert(purchTx.items[0].igstRate === '18%', 'Line item IGST rate formatted');

  // Stock Item
  const item = new CanonicalItem({
    name: 'Industrial Motor 5HP',
    parent: 'Electric Motors',
    hsnCode: '8501',
    baseUnits: 'NOS',
    standardCost: 8500,
    standardPrice: 10000,
    reorderBase: 25,
    minOrderQty: 10,
    openingBalance: '50 NOS',
    openingRate: 8500,
    openingValue: 425000
  });
  assert(item.name === 'Industrial Motor 5HP', 'CanonicalItem name mapped');
  assert(item.uom === 'NOS', 'CanonicalItem UOM mapped');
  assert(item.standardPrice === 10000, 'CanonicalItem price mapped');
  assert(item.reorderLevel === 25, 'CanonicalItem reorder level parsed');
  assert(item.openingQuantity === 50, 'CanonicalItem opening quantity parsed');

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Authoritative Schema Profiles (Exact Column Counts & Headers)
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 3: Authoritative Schema Verification');

  const authChecks = [
    { key: 'customers', expectedCols: 36, firstCol: 'Customer Code', lastCol: 'Remarks' },
    { key: 'ledgers', expectedCols: 17, firstCol: 'Account Code', lastCol: 'Remarks' },
    { key: 'sales_register', expectedCols: 32, firstCol: 'Code', lastCol: 'Remarks' },
    { key: 'purchase_register', expectedCols: 32, firstCol: 'Code', lastCol: 'Remarks' },
    { key: 'trial_balance', expectedCols: 9, firstCol: 'Month/Year', lastCol: 'Dr/Cr' },
    { key: 'stock_items', expectedCols: 27, firstCol: 'Item/SKU ID', lastCol: 'Status' },
    { key: 'inventory', expectedCols: 17, firstCol: 'Item/SKU ID', lastCol: 'Status' },
    { key: 'cost_centers', expectedCols: 3, firstCol: 'Code', lastCol: 'Branch Code/Name' },
    { key: 'godowns', expectedCols: 4, firstCol: 'Code', lastCol: 'Active' },
    { key: 'vendors', expectedCols: 33, firstCol: 'Vendor Code', lastCol: 'PAN Number' },
    { key: 'branches', expectedCols: 3, firstCol: 'Code', lastCol: 'GSTNo' },
    { key: 'sales_representatives', expectedCols: 3, firstCol: 'Code', lastCol: 'Mobile No' },
    { key: 'inventory_master', expectedCols: 20, firstCol: 'Code', lastCol: 'Remarks' }
  ];

  for (const check of authChecks) {
    const schema = getSchema(check.key, 'authoritative');
    assert(schema.columns.length === check.expectedCols, `Authoritative schema for "${check.key}" has exactly ${check.expectedCols} columns`);
    assert(schema.columns[0] === check.firstCol, `Authoritative schema "${check.key}" starts with "${check.firstCol}"`);
    assert(schema.columns[schema.columns.length - 1] === check.lastCol, `Authoritative schema "${check.key}" ends with "${check.lastCol}"`);
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 4: Full Transformation & Dual-Profile CSV Export Pipeline
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 4: Dual-Profile Transformation & CSV Quality');

  // A. Trial Balance Export in Both Profiles
  const rawTbData = [
    {
      name: 'Bank Account - SBI',
      group: 'Bank Accounts',
      opening: 50000,
      debit: 120000,
      credit: 45000,
      closing: 125000,
      monthYear: '2026-04',
      branch: 'Main Branch'
    }
  ];

  // 1. Canonical Trial Balance
  const canonicalTbRows = Transformer.transform('trial_balance', rawTbData, { profile: 'canonical' });
  assert(canonicalTbRows.length === 1, 'Transformed 1 canonical TB row');
  const canonicalTbExport = await CsvExporter.exportToStorage('trial_balance', canonicalTbRows, {
    profile: 'canonical',
    storage,
    filename: 'test_canonical_tb.csv'
  });
  const canonicalTbContent = fs.readFileSync(canonicalTbExport.filePath, 'utf-8');
  assert(canonicalTbContent.includes('Ledger Name'), 'Canonical TB contains "Ledger Name" header');
  assert(canonicalTbContent.includes('Opening Debit'), 'Canonical TB contains "Opening Debit" header');
  assert(!canonicalTbContent.includes('[object Object]'), 'Canonical TB has no [object Object]');

  // 2. Authoritative Trial Balance
  const authTbRows = Transformer.transform('trial_balance', rawTbData, { profile: 'authoritative' });
  assert(authTbRows.length === 1, 'Transformed 1 authoritative TB row');
  const authTbExport = await CsvExporter.exportToStorage('trial_balance', authTbRows, {
    profile: 'authoritative',
    storage,
    filename: 'test_authoritative_tb.csv'
  });
  const authTbContent = fs.readFileSync(authTbExport.filePath, 'utf-8');
  assert(authTbContent.includes('Month/Year'), 'Authoritative TB contains "Month/Year" header');
  assert(authTbContent.includes('Dr/Cr'), 'Authoritative TB contains "Dr/Cr" header');
  assert(!authTbContent.includes('[object Object]'), 'Authoritative TB has no [object Object]');
  // Count columns in header row
  const authTbHeaderLine = authTbContent.split('\n')[0].replace(/^\uFEFF/, '').trim();
  const authTbHeaderCount = authTbHeaderLine.split(',').length;
  assert(authTbHeaderCount === 9, `Authoritative TB CSV has exactly 9 columns (got ${authTbHeaderCount})`);

  // B. Authoritative Customer Export
  const rawCustData = [
    {
      name: 'Apex Precision Engineering Ltd',
      parent: 'Sundry Debtors',
      statutory: { gstin: '27AABCA1234B1Z5' },
      contact: { phone: '022-28899000', email: 'accounts@apexprecision.com' },
      mailingDetails: { addressLines: ['Plot 45', 'MIDC Industrial Area'], city: 'Thane', state: 'Maharashtra', postalCode: '400604' },
      creditPolicy: { creditDays: 30, creditLimit: 250000 },
      banking: { bankName: 'HDFC Bank', accountNumber: '50200012345678', ifscCode: 'HDFC0000123' },
      openingBalance: 150000,
      closingBalance: 175000
    }
  ];
  const authCustRows = Transformer.transform('customers', rawCustData, { profile: 'authoritative' });
  const authCustExport = await CsvExporter.exportToStorage('customers', authCustRows, {
    profile: 'authoritative',
    storage,
    filename: 'test_authoritative_customers.csv'
  });
  const authCustContent = fs.readFileSync(authCustExport.filePath, 'utf-8');
  const authCustHeaderLine = authCustContent.split('\n')[0].replace(/^\uFEFF/, '').trim();
  const authCustHeaderCount = authCustHeaderLine.split(',').length;
  assert(authCustHeaderCount === 36, `Authoritative Customer CSV has exactly 36 columns (got ${authCustHeaderCount})`);
  assert(authCustContent.includes('"Apex Precision Engineering Ltd"'), 'Customer name quoted cleanly');
  assert(authCustContent.includes('"AABCA1234B"'), 'PAN extracted in CSV');
  assert(!authCustContent.includes('[object Object]'), 'Customer CSV has zero [object Object]');

  // C. Authoritative Sales Register (Voucher Line Item Expansion)
  const rawSalesData = [
    {
      guid: 'V-SLS-001',
      voucherNumber: 'INV/2026/101',
      date: '2026-06-01',
      partyName: 'Apex Precision Engineering Ltd',
      partyGstin: '27AABCA1234B1Z5',
      totalInvoice: 23600,
      items: [
        {
          stockItemName: 'Bearing Unit 6205',
          hsn: '8482',
          billedQty: '10 PCS',
          rate: 1000,
          amount: 10000,
          cgstRate: 9,
          cgstAmount: 900,
          sgstRate: 9,
          sgstAmount: 900,
          godownName: 'Main Warehouse'
        },
        {
          stockItemName: 'Shaft Seal 35mm',
          hsn: '8484',
          billedQty: '20 PCS',
          rate: 500,
          amount: 10000,
          cgstRate: 9,
          cgstAmount: 900,
          sgstRate: 9,
          sgstAmount: 900,
          godownName: 'Main Warehouse'
        }
      ]
    }
  ];
  const authSalesRows = Transformer.transform('sales_register', rawSalesData, { profile: 'authoritative' });
  assert(authSalesRows.length === 2, 'Sales voucher with 2 line items expanded into exactly 2 rows');
  const authSalesExport = await CsvExporter.exportToStorage('sales_register', authSalesRows, {
    profile: 'authoritative',
    storage,
    filename: 'test_authoritative_sales.csv'
  });
  const authSalesContent = fs.readFileSync(authSalesExport.filePath, 'utf-8');
  const authSalesHeaderLine = authSalesContent.split('\n')[0].replace(/^\uFEFF/, '').trim();
  const authSalesHeaderCount = authSalesHeaderLine.split(',').length;
  assert(authSalesHeaderCount === 32, `Authoritative Sales Register CSV has exactly 32 columns (got ${authSalesHeaderCount})`);
  assert(authSalesContent.includes('Bearing Unit 6205'), 'Line item 1 present');
  assert(authSalesContent.includes('Shaft Seal 35mm'), 'Line item 2 present');
  assert(!authSalesContent.includes('[object Object]'), 'Sales Register CSV has zero [object Object]');

  // D. Authoritative Purchase Register (Voucher Line Item Expansion)
  const rawPurchData = [
    {
      guid: 'V-PUR-001',
      voucherNumber: 'BILL/992/26',
      date: '2026-06-05',
      partyName: 'Global Metal Alloys Pvt Ltd',
      partyGstin: '24AAACG9876K1Z9',
      reference: 'GRN-405',
      totalInvoice: 59000,
      items: [
        {
          stockItemName: 'Copper Wire Spool',
          hsn: '7408',
          billedQty: '5 NOS',
          rate: 10000,
          amount: 50000,
          igstRate: 18,
          igstAmount: 9000,
          godownName: 'Raw Material Store'
        }
      ]
    }
  ];
  const authPurchRows = Transformer.transform('purchase_register', rawPurchData, { profile: 'authoritative' });
  assert(authPurchRows.length === 1, 'Purchase voucher transformed to 1 row');
  const authPurchExport = await CsvExporter.exportToStorage('purchase_register', authPurchRows, {
    profile: 'authoritative',
    storage,
    filename: 'test_authoritative_purchases.csv'
  });
  const authPurchContent = fs.readFileSync(authPurchExport.filePath, 'utf-8');
  const authPurchHeaderLine = authPurchContent.split('\n')[0].replace(/^\uFEFF/, '').trim();
  const authPurchHeaderCount = authPurchHeaderLine.split(',').length;
  assert(authPurchHeaderCount === 32, `Authoritative Purchase Register CSV has exactly 32 columns (got ${authPurchHeaderCount})`);
  assert(authPurchContent.includes('Copper Wire Spool'), 'Purchase stock item mapped');
  assert(authPurchContent.includes('GRN-405'), 'GRN number mapped');

  // E. Authoritative Item Master & Inventory
  const rawItemData = [
    {
      name: 'Flange Bearing 25mm',
      category: 'Bearings',
      parent: 'Mechanical Components',
      hsnCode: '8482',
      baseUnits: 'PCS',
      standardCost: 450,
      standardPrice: 650,
      reorderBase: 100,
      minOrderQty: 50,
      openingBalance: '200 PCS',
      openingRate: 450,
      openingValue: 90000,
      closingBalance: '150 PCS',
      closingRate: 450,
      closingValue: 67500
    }
  ];
  const authItemRows = Transformer.transform('stock_items', rawItemData, { profile: 'authoritative' });
  const authItemExport = await CsvExporter.exportToStorage('stock_items', authItemRows, {
    profile: 'authoritative',
    storage,
    filename: 'test_authoritative_items.csv'
  });
  const authItemContent = fs.readFileSync(authItemExport.filePath, 'utf-8');
  const authItemHeaderLine = authItemContent.split('\n')[0].replace(/^\uFEFF/, '').trim();
  const authItemHeaderCount = authItemHeaderLine.split(',').length;
  assert(authItemHeaderCount === 27, `Authoritative Item Master CSV has exactly 27 columns (got ${authItemHeaderCount})`);

  const authInvRows = Transformer.transform('inventory', rawItemData, { profile: 'authoritative' });
  const authInvExport = await CsvExporter.exportToStorage('inventory', authInvRows, {
    profile: 'authoritative',
    storage,
    filename: 'test_authoritative_inventory.csv'
  });
  const authInvContent = fs.readFileSync(authInvExport.filePath, 'utf-8');
  const authInvHeaderLine = authInvContent.split('\n')[0].replace(/^\uFEFF/, '').trim();
  const authInvHeaderCount = authInvHeaderLine.split(',').length;
  assert(authInvHeaderCount === 17, `Authoritative Inventory CSV has exactly 17 columns (got ${authInvHeaderCount})`);

  // F. Cost Centers & Godowns
  const rawCostCenterData = [{ name: 'Production Unit 1', parent: 'Factory Overhead', category: 'Manufacturing' }];
  const authCcRows = Transformer.transform('cost_centers', rawCostCenterData, { profile: 'authoritative' });
  const authCcExport = await CsvExporter.exportToStorage('cost_centers', authCcRows, { profile: 'authoritative', storage });
  const authCcContent = fs.readFileSync(authCcExport.filePath, 'utf-8');
  const authCcHeaderCount = authCcContent.split('\n')[0].replace(/^\uFEFF/, '').trim().split(',').length;
  assert(authCcHeaderCount === 3, `Authoritative Cost Center CSV has exactly 3 columns (got ${authCcHeaderCount})`);

  const rawGodownData = [{ name: 'Central Warehouse B', parent: 'Main Location', address: 'Plot 12, Logistics Park' }];
  const authGodownRows = Transformer.transform('godowns', rawGodownData, { profile: 'authoritative' });
  const authGodownExport = await CsvExporter.exportToStorage('godowns', authGodownRows, { profile: 'authoritative', storage });
  const authGodownContent = fs.readFileSync(authGodownExport.filePath, 'utf-8');
  const authGodownHeaderCount = authGodownContent.split('\n')[0].replace(/^\uFEFF/, '').trim().split(',').length;
  assert(authGodownHeaderCount === 4, `Authoritative Godown CSV has exactly 4 columns (got ${authGodownHeaderCount})`);

  // --------------------------------------------------------------------------
  // TEST GROUP 5: Data Integrity & Reconciliation
  // --------------------------------------------------------------------------
  console.log('\n▶ Test 5: Reconciliation Tracking & Integrity');

  // Master data: 10 in -> 10 transformed -> 10 exported
  const mockMasterList = Array.from({ length: 15 }, (_, i) => ({
    name: `Ledger ${i + 1}`,
    parent: 'Current Assets',
    opening: 1000 * (i + 1),
    closing: 1200 * (i + 1)
  }));
  const transformedMasters = Transformer.transform('ledgers', mockMasterList, { profile: 'canonical' });
  assert(mockMasterList.length === transformedMasters.length, 'Master extracted count strictly matches transformed count (15 === 15)');
  
  const masterExport = await CsvExporter.exportToStorage('ledgers', transformedMasters, { profile: 'canonical', storage });
  assert(masterExport.rowCount === 15, 'Master export rowCount strictly matches transformed count');

  // Transaction data: 3 vouchers with 2 items each -> 6 rows generated
  const mockVouchers = [
    { guid: 'V1', voucherNumber: 'INV-1', date: '2026-04-01', totalInvoice: 2000, items: [{ stockItemName: 'Item A', billedQty: 1 }, { stockItemName: 'Item B', billedQty: 1 }] },
    { guid: 'V2', voucherNumber: 'INV-2', date: '2026-04-02', totalInvoice: 4000, items: [{ stockItemName: 'Item C', billedQty: 2 }, { stockItemName: 'Item D', billedQty: 2 }] },
    { guid: 'V3', voucherNumber: 'INV-3', date: '2026-04-03', totalInvoice: 1000, items: [{ stockItemName: 'Item E', billedQty: 1 }, { stockItemName: 'Item F', billedQty: 1 }] }
  ];
  const transformedVouchers = Transformer.transform('sales_register', mockVouchers, { profile: 'canonical' });
  assert(mockVouchers.length === 3, 'Vouchers extracted = 3');
  assert(transformedVouchers.length === 6, 'Rows generated = 6 (line-item expansion)');
  const voucherExport = await CsvExporter.exportToStorage('sales_register', transformedVouchers, { profile: 'canonical', storage });
  assert(voucherExport.rowCount === 6, 'Rows exported = 6');

  // Clean up temp test directory
  fs.rmSync(tempExportDir, { recursive: true, force: true });

  console.log('\n===============================================================');
  console.log('✔ ALL CANONICAL DATA MODEL & DUAL-PROFILE TESTS PASSED (5/5)');
  console.log('===============================================================');
}

runCanonicalExportEngineTests().catch(err => {
  console.error('\n✖ CANONICAL EXPORT ENGINE TEST SUITE FAILED:', err);
  process.exit(1);
});
