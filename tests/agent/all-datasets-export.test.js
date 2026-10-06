/**
 * Comprehensive Acceptance Test for ALL 20 Supported Datasets
 * 
 * Verifies end-to-end architecture for:
 * 1. Ledgers / Chart of Accounts
 * 2. Groups
 * 3. Cost Centers
 * 4. Customers
 * 5. Vendors
 * 6. Stock Items / Item Master
 * 7. Inventory Policies
 * 8. Stock Groups
 * 9. Units
 * 10. Godowns
 * 11. Sales Orders
 * 12. Purchase Orders
 * 13. Delivery Notes
 * 14. Receipt Notes
 * 15. Trial Balance
 * 16. Sales Register
 * 17. Purchase Register
 * 18. Inventory Master / Stock Movement
 * 19. Branch
 * 20. Sales Representative
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getAllEntities, getEntityById } from '../../connector-agent/src/extraction/entityRegistry.js';
import { getSchema } from '../../connector-agent/src/engine/schemas.js';
import { Transformer } from '../../connector-agent/src/engine/transformer.js';
import { DataValidator } from '../../connector-agent/src/engine/dataValidator.js';
import { MappingEngine } from '../../connector-agent/src/engine/mappingEngine.js';
import { CsvExporter } from '../../connector-agent/src/export/csvExporter.js';
import { XmlExporter } from '../../connector-agent/src/export/xmlExporter.js';
import { LocalExportStorage } from '../../connector-agent/src/storage/localExportStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testExportDir = path.join(__dirname, 'temp_all_datasets_exports');

if (!fs.existsSync(testExportDir)) {
  fs.mkdirSync(testExportDir, { recursive: true });
}
const testStorage = new LocalExportStorage({ baseDir: testExportDir });

console.log('===============================================================');
console.log('🧪 VERIFYING ALL 20 SUPPORTED DATASETS IN TALLY CONNECT');
console.log('===============================================================\n');

// Mock data fixtures representing real parsed Tally XML canonical structures
const FIXTURES = {
  ledgers: [
    {
      name: 'State Bank of India',
      parent: 'Bank Accounts',
      openingBalance: 125000.50,
      closingBalance: 145000.50,
      isCostCentresOn: false,
      gstApplicable: 'Applicable',
      mailingName: 'SBI Corporate Account',
      state: 'Maharashtra',
      pincode: '400001',
      country: 'India',
      gstin: '27AAACS1234A1Z1',
      pan: 'AAACS1234A',
      phone: '022-22820000',
      email: 'corporate@sbi.co.in',
      narration: 'Primary Current Account'
    }
  ],
  groups: [
    {
      name: 'Current Assets',
      parent: 'Primary',
      isAddable: true,
      isSubLedger: false,
      isCalculate: false
    }
  ],
  cost_centers: [
    {
      name: 'Mumbai Regional Office',
      parent: 'Western Division',
      category: 'Branches',
      code: 'CC-MUM-01',
      branch: 'Mumbai West'
    }
  ],
  customers: [
    {
      name: 'Tata Consultancy Services Ltd',
      parent: 'Sundry Debtors',
      code: 'CUST-TCS-01',
      gstin: '27AAACT2727Q1ZW',
      contact: { phone: '022-67789999', email: 'billing@tcs.com', person: 'Natarajan C' },
      mailingDetails: { address: 'TCS House, Raveline Street', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', country: 'India' },
      statutory: { gstRegType: 'Regular', stateCode: '27', stateName: 'Maharashtra' },
      creditPolicy: { creditLimit: 5000000, creditPeriod: '45 Days' },
      banking: { bankName: 'Standard Chartered', ifscCode: 'SCBL0036001', accountNumber: '22205012345' },
      openingBalance: 250000,
      closingBalance: 450000,
      active: true
    }
  ],
  vendors: [
    {
      name: 'Larsen & Toubro Ltd',
      parent: 'Sundry Creditors',
      code: 'VEND-LT-01',
      gstin: '27AAACL0123K1ZT',
      contact: { phone: '022-67525656', email: 'accounts@larsentoubro.com', person: 'Suresh Iyer' },
      mailingDetails: { address: 'L&T House, Ballard Estate', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', country: 'India' },
      statutory: { gstRegType: 'Regular', stateCode: '27', stateName: 'Maharashtra' },
      creditPolicy: { creditLimit: 10000000, creditPeriod: '60 Days' },
      banking: { bankName: 'State Bank of India', ifscCode: 'SBIN0000300', accountNumber: '10012345678' },
      openingBalance: 1200000,
      closingBalance: 800000,
      active: true
    }
  ],
  stock_items: [
    {
      name: 'Industrial AC Motor 5HP',
      code: 'ITM-MOT-05HP',
      parent: 'Electric Motors',
      category: 'Three Phase',
      uom: 'NOS',
      hsn: '85015210',
      gstRate: 18,
      standardCost: 15000,
      standardPrice: 22000,
      mrp: 25000,
      reorderLevel: 10,
      minStockQty: 5,
      maxStockQty: 50,
      openingQuantity: 12,
      openingRate: 15000,
      openingValue: 180000,
      closingQuantity: 20,
      closingRate: 15000,
      closingValue: 300000,
      costingMethod: 'Avg Cost',
      gstApplicable: 'Applicable',
      status: 'Active'
    }
  ],
  inventory: [
    {
      name: 'Industrial AC Motor 5HP',
      code: 'ITM-MOT-05HP',
      parent: 'Electric Motors',
      category: 'Three Phase',
      uom: 'NOS',
      hsn: '85015210',
      reorderLevel: 10,
      minStockQty: 5,
      maxStockQty: 50,
      status: 'Active'
    }
  ],
  stock_groups: [
    {
      name: 'Electric Motors',
      parent: 'Primary',
      isAddable: true
    }
  ],
  units: [
    {
      name: 'NOS',
      originalName: 'Numbers',
      decimalPlaces: 0,
      isGstExcluded: false
    }
  ],
  godowns: [
    {
      name: 'Bhiwandi Central Warehouse',
      code: 'GDN-BHI-01',
      parent: 'Maharashtra Zone',
      address: 'Plot 45, Logistics Park, Bhiwandi',
      pincode: '421302',
      active: true
    }
  ],
  sales_orders: [
    {
      orderNumber: 'SO-2026-001',
      date: '2026-05-10',
      dueDate: '2026-05-25',
      partyName: 'Tata Consultancy Services Ltd',
      gstin: '27AAACT2727Q1ZW',
      placeOfSupply: 'Maharashtra',
      total: 118000,
      items: [
        { itemName: 'Industrial AC Motor 5HP', quantity: 5, rate: 20000, amount: 100000, godown: 'Bhiwandi Central Warehouse' }
      ],
      narration: 'Annual facility maintenance order'
    }
  ],
  purchase_orders: [
    {
      orderNumber: 'PO-2026-001',
      date: '2026-04-15',
      dueDate: '2026-04-30',
      partyName: 'Larsen & Toubro Ltd',
      gstin: '27AAACL0123K1ZT',
      placeOfSupply: 'Maharashtra',
      total: 88500,
      items: [
        { itemName: 'Copper Winding Wire 1.2mm', quantity: 100, rate: 750, amount: 75000, godown: 'Bhiwandi Central Warehouse' }
      ],
      narration: 'Raw material procurement'
    }
  ],
  delivery_notes: [
    {
      noteNumber: 'DN-2026-001',
      date: '2026-05-12',
      partyName: 'Tata Consultancy Services Ltd',
      gstin: '27AAACT2727Q1ZW',
      placeOfSupply: 'Maharashtra',
      total: 100000,
      items: [
        { itemName: 'Industrial AC Motor 5HP', quantity: 5, rate: 20000, amount: 100000, godown: 'Bhiwandi Central Warehouse' }
      ],
      narration: 'Dispatched via Express Logistics'
    }
  ],
  receipt_notes: [
    {
      noteNumber: 'RN-2026-001',
      date: '2026-04-20',
      partyName: 'Larsen & Toubro Ltd',
      gstin: '27AAACL0123K1ZT',
      placeOfSupply: 'Maharashtra',
      total: 75000,
      items: [
        { itemName: 'Copper Winding Wire 1.2mm', quantity: 100, rate: 750, amount: 75000, godown: 'Bhiwandi Central Warehouse' }
      ],
      narration: 'Received in good condition'
    }
  ],
  trial_balance: [
    {
      name: 'State Bank of India',
      parent: 'Bank Accounts',
      openingBalance: 125000.50,
      openingDebit: 125000.50,
      openingCredit: 0,
      debitTotals: 75000.00,
      creditTotals: 55000.00,
      closingBalance: 145000.50,
      closingDebit: 145000.50,
      closingCredit: 0,
      monthYear: '2026-04',
      branch: 'Head Office',
      drCr: 'Dr'
    }
  ],
  sales_register: [
    {
      voucherId: 'VCH-SALES-001',
      voucherNumber: 'INV-2026-001',
      date: '2026-05-15',
      partyName: 'Tata Consultancy Services Ltd',
      gstin: '27AAACT2727Q1ZW',
      placeOfSupply: 'Maharashtra',
      voucherType: 'Sales',
      narration: 'Supply of electric motors',
      amount: 118000,
      items: [
        {
          itemName: 'Industrial AC Motor 5HP',
          itemDescription: 'Industrial AC Motor 5HP 3Phase',
          hsn: '85015210',
          quantity: 5,
          rate: 20000,
          discount: 0,
          amount: 100000,
          taxValue: 100000,
          cgstRate: '9%',
          cgstAmount: 9000,
          sgstRate: '9%',
          sgstAmount: 9000,
          igstRate: '',
          igstAmount: 0,
          godown: 'Bhiwandi Central Warehouse'
        }
      ]
    }
  ],
  purchase_register: [
    {
      voucherId: 'VCH-PURCH-001',
      voucherNumber: 'BILL-LT-9988',
      date: '2026-04-25',
      vendorName: 'Larsen & Toubro Ltd',
      gstin: '27AAACL0123K1ZT',
      placeOfSupply: 'Maharashtra',
      purchaseType: 'Purchase',
      narration: 'Procurement of copper wires',
      amount: 88500,
      grnNo: 'GRN-2026-042',
      poReferenceNo: 'PO-2026-001',
      items: [
        {
          itemName: 'Copper Winding Wire 1.2mm',
          itemDescription: 'Copper Winding Wire 1.2mm Grade A',
          hsn: '74081190',
          quantity: 100,
          rate: 750,
          discount: 0,
          amount: 75000,
          taxValue: 75000,
          cgstRate: '9%',
          cgstAmount: 6750,
          sgstRate: '9%',
          sgstAmount: 6750,
          igstRate: '',
          igstAmount: 0,
          godown: 'Bhiwandi Central Warehouse'
        }
      ]
    }
  ],
  inventory_master: [
    {
      code: 'STK-MOV-001',
      date: '2026-05-15',
      voucherType: 'Sales',
      voucherNumber: 'INV-2026-001',
      reference: 'DC-2026-01',
      partyName: 'Tata Consultancy Services Ltd',
      narration: 'Stock movement outward for delivery',
      items: [
        {
          itemName: 'Industrial AC Motor 5HP',
          godown: 'Bhiwandi Central Warehouse',
          quantity: 5,
          rate: 20000,
          amount: 100000,
          batchNo: 'BAT-2026-05',
          mfgDate: '2026-01-01',
          expiryDate: '2028-12-31'
        }
      ]
    }
  ],
  branch: [
    {
      code: 'BR-MUM-01',
      name: 'Mumbai Head Office',
      gstNo: '27AAACS1234A1Z1'
    }
  ],
  sales_representative: [
    {
      code: 'REP-001',
      name: 'Karan Mehra',
      mobileNo: '9820098200'
    }
  ]
};

async function runAllDatasetsTest() {
  const allEntities = getAllEntities();
  console.log(`Discovered ${allEntities.length} entities in ENTITY_REGISTRY.\n`);

  let passedCount = 0;

  for (const entity of allEntities) {
    const datasetKey = entity.id;
    console.log(`─────────────────────────────────────────────────────────────`);
    console.log(`▶ Testing Dataset: ${entity.name} (${datasetKey})`);

    // 1. Schema check
    const schema = getSchema(datasetKey);
    assert(schema, `Schema for "${datasetKey}" must exist`);
    assert(Array.isArray(schema.columns) && schema.columns.length > 0, `Schema columns must be non-empty`);
    console.log(`  1. Schema verified: ${schema.columns.length} columns (Prefix: "${schema.fileNamePrefix}")`);

    // 2. Mapping Catalog check
    const mappingSummary = MappingEngine.getMappingSummary(datasetKey);
    assert(mappingSummary, `MappingEngine summary for "${datasetKey}" must exist`);
    assert.strictEqual(
      mappingSummary.totalColumns,
      schema.columns.length,
      `Mapping column count (${mappingSummary.totalColumns}) matches target schema (${schema.columns.length})`
    );
    console.log(`  2. MappingEngine verified: ${mappingSummary.totalColumns} target fields classified`);

    // 3. Transformation check
    const fixture = FIXTURES[datasetKey] || [{}];
    const transformedRows = Transformer.transform(datasetKey, fixture);
    assert(Array.isArray(transformedRows) && transformedRows.length > 0, `Transformed rows must be non-empty`);
    console.log(`  3. Transformer verified: Produced ${transformedRows.length} normalized row(s)`);

    // 4. DataValidator check
    const validation = DataValidator.validate(datasetKey, transformedRows, {
      recordsExtracted: fixture.length
    });
    assert.strictEqual(validation.isValid, true, `DataValidator must pass: ${validation.errors.join(', ')}`);
    assert.strictEqual(validation.recordsExported, transformedRows.length);
    console.log(`  4. DataValidator verified: Passed with 0 errors`);

    // 5. CSV Export check
    const csvExport = await CsvExporter.exportToStorage(datasetKey, transformedRows, {
      storage: testStorage
    });
    assert(fs.existsSync(csvExport.filePath), `CSV file must exist on disk`);
    assert(csvExport.sizeBytes > 0, `CSV size must be > 0 bytes`);
    const csvContent = fs.readFileSync(csvExport.filePath, 'utf-8');
    assert(!csvContent.includes('[object Object]'), `CSV must contain zero [object Object] leaks`);
    const csvHeaders = csvContent.split('\n')[0].trim().split(',');
    assert.strictEqual(
      csvHeaders.length,
      schema.columns.length,
      `CSV header count (${csvHeaders.length}) strictly matches target schema (${schema.columns.length})`
    );
    console.log(`  5. CSV Exporter verified: ${path.basename(csvExport.filePath)} (${csvExport.sizeBytes} bytes, ${csvHeaders.length} cols)`);

    // 6. XML Export check
    const xmlExport = await XmlExporter.exportToStorage(datasetKey, transformedRows, {
      storage: testStorage
    });
    assert(fs.existsSync(xmlExport.filePath), `XML file must exist on disk`);
    assert(xmlExport.sizeBytes > 0, `XML size must be > 0 bytes`);
    const xmlContent = fs.readFileSync(xmlExport.filePath, 'utf-8');
    assert(!xmlContent.includes('[object Object]'), `XML must contain zero [object Object] leaks`);
    assert(xmlContent.includes(`<DATASET id="${schema.id}"`), `XML contains dataset root tag`);
    assert(xmlContent.includes('<RECORD index="1">'), `XML contains record tag`);
    console.log(`  6. XML Exporter verified: ${path.basename(xmlExport.filePath)} (${xmlExport.sizeBytes} bytes)`);

    passedCount++;
  }

  // Also test empty export zero records reporting
  console.log(`─────────────────────────────────────────────────────────────`);
  console.log(`▶ Testing 0-Record Export Integrity`);
  const zeroRows = [];
  const zeroValidation = DataValidator.validate('ledgers', zeroRows, { recordsExtracted: 0 });
  assert.strictEqual(zeroValidation.isValid, true, 'Zero rows pass structural validation');
  assert.strictEqual(zeroValidation.recordsExtracted, 0);
  assert.strictEqual(zeroValidation.recordsExported, 0);
  console.log('  ✔ Zero records validated cleanly with 0 records exported');

  // Clean up test exports
  try {
    fs.rmSync(testExportDir, { recursive: true, force: true });
  } catch (e) {
    // ignore
  }

  console.log('\n===============================================================');
  console.log(`🎉 ALL ${passedCount} DATASETS SUCCESSFULLY VERIFIED END-TO-END!`);
  console.log('===============================================================\n');
}

runAllDatasetsTest();
