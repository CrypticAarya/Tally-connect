import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAllEntities, getEntityById, MASTER_DATA_IDS, DATE_FILTERED_IDS, isDateFilteredEntity } from '../../connector-agent/src/extraction/entityRegistry.js';
import { DATASET_SCHEMAS, getSchema } from '../../connector-agent/src/engine/schemas.js';
import { Transformer } from '../../connector-agent/src/engine/transformer.js';
import { TallyXmlParser, extractTextValue, computeFinancialYear } from '../../connector-agent/src/adapters/xmlParser.js';
import { LocalExportStorage } from '../../connector-agent/src/storage/localExportStorage.js';
import { CsvExporter } from '../../connector-agent/src/export/csvExporter.js';
import { ExtractionService } from '../../connector-agent/src/extraction/extractionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_EXPORTS_DIR = path.join(__dirname, 'temp_exports');

function assert(condition, message) {
  if (!condition) {
    console.error(`✖ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✔ ${message}`);
}

async function run() {
  console.log('===============================================================');
  console.log('🧪 TALLY CONNECT — EXTRACTION & ZERO-MOCK ENGINE TEST SUITE');
  console.log('===============================================================\n');

  // Clean test directory
  if (fs.existsSync(TEST_EXPORTS_DIR)) {
    fs.rmSync(TEST_EXPORTS_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_EXPORTS_DIR, { recursive: true });

  const testStorage = new LocalExportStorage({ baseDir: TEST_EXPORTS_DIR });

  // -----------------------------------------------------------------
  // 1. Entity Registry Tests
  // -----------------------------------------------------------------
  console.log('▶ Test 1: Central Entity Registry Completeness');
  const allEntities = getAllEntities();
  assert(allEntities.length >= 15, `All scoped datasets registered (got ${allEntities.length})`);

  const expectedIds = [
    'ledgers', 'groups', 'cost_centers', 'customers', 'vendors',
    'stock_items', 'stock_groups', 'units', 'godowns',
    'sales_orders', 'purchase_orders', 'delivery_notes', 'receipt_notes',
    'trial_balance', 'sales_register', 'purchase_register'
  ];

  for (const id of expectedIds) {
    const ent = getEntityById(id);
    assert(Boolean(ent), `Entity "${id}" found in registry`);
    assert(typeof ent.fetchMethod === 'string', `Entity "${id}" defines fetchMethod: ${ent.fetchMethod}`);
  }

  const tbEnt = getEntityById('trial_balance');
  assert(tbEnt.parameters.some(p => p.name === 'fromDate'), 'Trial Balance requires fromDate');
  assert(tbEnt.parameters.some(p => p.name === 'toDate'), 'Trial Balance requires toDate');

  const ledgEnt = getEntityById('ledgers');
  assert(ledgEnt.parameters.length === 0, 'Ledgers does not require unneeded date parameters');

  // -----------------------------------------------------------------
  // 2. Strict Company Detection & No-Fake Fallback
  // -----------------------------------------------------------------
  console.log('\n▶ Test 2: Strict Company Detection & No-Fake Fallback');
  const parser = new TallyXmlParser();

  // Test 2a: Empty XML or missing company node must throw NO_ACTIVE_COMPANY
  const emptyCompanyXml = `
<ENVELOPE>
  <BODY>
    <DATA>
      <COLLECTION></COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>`;
  let threwNoCompany = false;
  try {
    parser.normalizeCompany(emptyCompanyXml);
  } catch (err) {
    threwNoCompany = true;
    assert(err.code === 'NO_ACTIVE_COMPANY', 'Throws NO_ACTIVE_COMPANY when no company node exists');
    assert(err.message.includes('Please open a company in TallyPrime'), 'Returns human-friendly error message');
  }
  assert(threwNoCompany, 'Parser failed when no company was loaded (never fakes company)');

  // Test 2b: Real company node returns real data without synthetic defaults
  const realCompanyXml = `
<ENVELOPE>
  <BODY>
    <DATA>
      <COLLECTION>
        <COMPANY NAME="Apex Industrial Motors Ltd">
          <NAME>Apex Industrial Motors Ltd</NAME>
          <GUID>apex-guid-999</GUID>
          <STARTINGFROM>20260401</STARTINGFROM>
          <ENDINGAT>20270331</ENDINGAT>
        </COMPANY>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>`;
  const comp = parser.normalizeCompany(realCompanyXml);
  assert(comp.name === 'Apex Industrial Motors Ltd', `Real company name parsed: "${comp.name}"`);
  assert(comp.financialYearFrom === '2026-04-01', 'Real financial year parsed');

  // -----------------------------------------------------------------
  // 3. Zero-Mock Parser Verification (No Fake Data Injected)
  // -----------------------------------------------------------------
  console.log('\n▶ Test 3: Zero-Mock Parser Verification (No Fake Fallbacks)');
  const customerWithoutExtrasXml = `
<ENVELOPE>
  <BODY>
    <DATA>
      <COLLECTION>
        <LEDGER NAME="Precision Works Pvt Ltd">
          <NAME>Precision Works Pvt Ltd</NAME>
          <PARENT>Sundry Debtors</PARENT>
          <PARTYGSTIN>27AAACA1234D1Z5</PARTYGSTIN>
          <OPENINGBALANCE>-50000.00</OPENINGBALANCE>
          <CLOSINGBALANCE>-75000.00</CLOSINGBALANCE>
        </LEDGER>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>`;
  const parsedCustomers = parser.normalizeCustomers(customerWithoutExtrasXml);
  assert(parsedCustomers.length === 1, 'Parsed 1 customer record');
  const cust = parsedCustomers[0];
  assert(cust.name === 'Precision Works Pvt Ltd', 'Customer name matches');
  assert(cust.guid === '', 'GUID is empty string when not provided by Tally (no fake cust-guid-101)');
  assert(cust.customerType === '', 'customerType is empty when not in Tally (no fake B2B Corporate)');
  assert(cust.creditPolicy.paymentTerms === '', 'paymentTerms empty when not in Tally (no fake Net 30 Days)');
  assert(cust.openingBalance === 50000, 'Opening balance parsed as positive magnitude');
  assert(cust.statutory.pan === 'AAACA1234D', 'PAN extracted from GSTIN');

  // -----------------------------------------------------------------
  // 4. CSV Schemas & Transformation for All 15 Datasets
  // -----------------------------------------------------------------
  console.log('\n▶ Test 4: CSV Schemas & Transformer');
  for (const id of expectedIds) {
    const schema = getSchema(id);
    assert(Boolean(schema), `Schema for "${id}" exists with ${schema.columns.length} columns`);
    assert(schema.columns.length > 0, `Schema "${id}" has non-empty column definitions`);
  }

  // Test Trial Balance transformation with Debit / Credit splitting
  const rawTrialBalance = [
    {
      name: 'Cash-in-Hand',
      parent: 'Cash-in-hand',
      openingBalance: 12500, // Debit
      debitTotals: 45000,
      creditTotals: 30000,
      closingBalance: 27500 // Debit
    },
    {
      name: 'HDFC Bank Overdraft',
      parent: 'Bank OD A/c',
      openingBalance: -80000, // Credit
      debitTotals: 20000,
      creditTotals: 50000,
      closingBalance: -110000 // Credit
    }
  ];

  const tbRows = Transformer.transform('trial_balance', rawTrialBalance);
  assert(tbRows.length === 2, 'Transformed 2 Trial Balance rows');

  assert(tbRows[0]['Ledger Name'] === 'Cash-in-Hand', 'Row 1 ledger name matches');
  assert(tbRows[0]['Opening Debit'] === '12500.00', 'Positive opening balance maps to Opening Debit');
  assert(tbRows[0]['Opening Credit'] === '0.00', 'Opening Credit is 0.00 for Debit balance');
  assert(tbRows[0]['Debit'] === '45000.00', 'Debit totals match');
  assert(tbRows[0]['Credit'] === '30000.00', 'Credit totals match');
  assert(tbRows[0]['Closing Debit'] === '27500.00', 'Positive closing maps to Closing Debit');
  assert(tbRows[0]['Closing Credit'] === '0.00', 'Closing Credit is 0.00');

  assert(tbRows[1]['Ledger Name'] === 'HDFC Bank Overdraft', 'Row 2 ledger name matches');
  assert(tbRows[1]['Opening Debit'] === '0.00', 'Opening Debit is 0.00 for Credit balance');
  assert(tbRows[1]['Opening Credit'] === '80000.00', 'Negative opening balance maps to Opening Credit');
  assert(tbRows[1]['Closing Debit'] === '0.00', 'Closing Debit is 0.00 for Credit closing');
  assert(tbRows[1]['Closing Credit'] === '110000.00', 'Closing Credit reflects Credit balance');

  // -----------------------------------------------------------------
  // 5. CSV Exporter & Collision-Proof Local Storage
  // -----------------------------------------------------------------
  console.log('\n▶ Test 5: CSV Exporter & Collision-Proof Local Storage');
  const exportRes1 = await CsvExporter.exportToStorage('trial_balance', tbRows, {
    storage: testStorage,
    fromDate: '2026-04-01',
    toDate: '2026-09-30'
  });

  assert(fs.existsSync(exportRes1.filePath), `CSV file created at: ${exportRes1.filePath}`);
  assert(exportRes1.rowCount === 2, 'Row count is 2');
  assert(exportRes1.filename === 'trial_balance_2026-04-01_to_2026-09-30.csv', 'Filename follows date naming');

  const fileContent = fs.readFileSync(exportRes1.filePath, 'utf-8');
  assert(fileContent.includes('"Cash-in-Hand"'), 'CSV contains quoted ledger name');
  assert(fileContent.includes('Opening'), 'CSV contains proper header row');
  assert(!fileContent.includes('[object Object]'), 'CSV contains zero [object Object]');

  // Test collision prevention (writing same file must not overwrite)
  const exportRes2 = await CsvExporter.exportToStorage('trial_balance', tbRows, {
    storage: testStorage,
    fromDate: '2026-04-01',
    toDate: '2026-09-30'
  });
  assert(exportRes2.filename === 'trial_balance_2026-04-01_to_2026-09-30_1.csv', 'Generated unique filename on collision');
  assert(fs.existsSync(exportRes2.filePath), 'Second file exists independently');

  // -----------------------------------------------------------------
  // 6. Full ExtractionService Pipeline Test
  // -----------------------------------------------------------------
  console.log('\n▶ Test 6: Full ExtractionService Pipeline');
  // Mock adapter providing real-shaped XML payloads directly without network
  class DirectXmlAdapter {
    async testConnection() {
      return {
        available: true,
        companyName: 'Apex Industrial Motors Ltd',
        version: 'TallyPrime 4.1',
        port: 9000,
        financialYear: '2026-04-01 to 2027-03-31'
      };
    }

    async fetchLedgers() {
      return [
        {
          name: 'Sales Account',
          parent: 'Sales Accounts',
          openingBalance: 0,
          closingBalance: 1500000,
          gstApplicable: 'Applicable',
          isCostCentresOn: true,
          state: 'Maharashtra',
          pincode: '400001',
          country: 'India',
          gstin: '27AAACA1234D1Z5',
          pan: 'AAACA1234D'
        },
        {
          name: 'Purchase Account',
          parent: 'Purchase Accounts',
          openingBalance: 0,
          closingBalance: 950000,
          gstApplicable: 'Applicable',
          isCostCentresOn: false,
          state: 'Maharashtra',
          pincode: '400001',
          country: 'India',
          gstin: '27AAACA1234D1Z5',
          pan: 'AAACA1234D'
        }
      ];
    }

    async fetchCustomers() {
      return [
        {
          name: 'Zenith Heavy Engineering Ltd',
          parent: 'Sundry Debtors',
          gstin: '27AAACZ9999K1Z2',
          pan: 'AAACZ9999K',
          contact: { name: 'Rajesh Sharma', email: 'rajesh@zenith.com', phone: '9820011223' },
          mailingDetails: { addressLines: ['Plot 12', 'MIDC Industrial Area'], state: 'Maharashtra', postalCode: '400072', country: 'India' },
          creditPolicy: { creditDays: 45, creditLimit: 2000000 },
          banking: { bankName: 'State Bank of India', accountNumber: '12345678901', ifscCode: 'SBIN0001234' },
          openingBalance: 150000,
          closingBalance: 320000
        }
      ];
    }

    async fetchTrialBalance() {
      return rawTrialBalance;
    }
  }

  const extractionService = new ExtractionService({
    tallyAdapter: new DirectXmlAdapter(),
    exportStorage: testStorage
  });

  const extractSummary = await extractionService.extractSelected(['ledgers', 'customers', 'trial_balance'], {
    fromDate: '2026-04-01',
    toDate: '2026-09-30'
  });

  assert(extractSummary.company === 'Apex Industrial Motors Ltd', 'Detected real company name in extraction summary');
  assert(extractSummary.datasetsCount === 3, 'Extracted exactly 3 datasets');
  assert(extractSummary.totalRecords === 5, 'Total record count matches (2 ledgers + 1 customer + 2 trial balance = 5)');
  assert(extractSummary.files.length === 3, '3 CSV files produced');

  for (const f of extractSummary.files) {
    assert(fs.existsSync(f.filePath), `File "${f.filename}" verified on disk (${f.sizeBytes} bytes)`);
  }

  // -----------------------------------------------------------------
  // 7. Bug 1: Object-vs-String Normalization (Company Name & Fields)
  // -----------------------------------------------------------------
  console.log('\n▶ Test 7: Bug 1 — Object-vs-String Normalization (Company Name & Fields)');
  const companyXmlWithAttributes = `
<ENVELOPE>
  <BODY>
    <DATA>
      <COLLECTION>
        <COMPANY NAME="Real Test Company Pvt Ltd">
          <NAME TYPE="String">Real Test Company Pvt Ltd</NAME>
          <GUID TYPE="String">comp-guid-777</GUID>
          <STARTINGFROM TYPE="Date">20260401</STARTINGFROM>
        </COMPANY>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>`;
  const compAttr = parser.normalizeCompany(companyXmlWithAttributes);
  assert(typeof compAttr.name === 'string', 'Company name is a string type');
  assert(compAttr.name === 'Real Test Company Pvt Ltd', `Parsed company name is exact string: "${compAttr.name}"`);
  assert(compAttr.name !== '[object Object]', 'Company name is NOT [object Object]');
  assert(compAttr.guid === 'comp-guid-777', 'GUID is clean string');

  // Verify extractTextValue handles various structures
  assert(extractTextValue('Simple String') === 'Simple String', 'extractTextValue on string');
  assert(extractTextValue({ '#text': 'Text Inside Node' }) === 'Text Inside Node', 'extractTextValue on #text');
  assert(extractTextValue({ value: 'Value Inside Node' }) === 'Value Inside Node', 'extractTextValue on value');
  assert(extractTextValue({ '@_NAME': 'Attr Name' }) === 'Attr Name', 'extractTextValue on @_NAME');
  assert(extractTextValue(null) === '', 'extractTextValue on null is empty string');
  assert(extractTextValue(undefined) === '', 'extractTextValue on undefined is empty string');

  // -----------------------------------------------------------------
  // 8. Bug 2: Financial Year Dynamic Range Calculation
  // -----------------------------------------------------------------
  console.log('\n▶ Test 8: Bug 2 — Financial Year Dynamic Range Calculation');
  // When Tally returns equal STARTINGFROM and ENDINGAT (or missing ENDINGAT)
  const fy1 = computeFinancialYear('20260401', '20260401');
  assert(fy1.from === '2026-04-01', 'FY from is 2026-04-01');
  assert(fy1.to === '2027-03-31', `FY to is calculated as 2027-03-31 (12 months minus 1 day), got "${fy1.to}"`);
  assert(fy1.to !== '2026-04-01', 'FY to is NOT equal to FY from');

  // When Tally provides only STARTINGFROM
  const fy2 = computeFinancialYear('20250401', '');
  assert(fy2.from === '2025-04-01', 'FY from is 2025-04-01');
  assert(fy2.to === '2026-03-31', 'FY to is 2026-03-31');

  // When Tally provides valid distinct range
  const fy3 = computeFinancialYear('20240401', '20250331');
  assert(fy3.from === '2024-04-01' && fy3.to === '2025-03-31', 'FY preserves valid full range');

  // When no dates provided, fallback to current calendar financial year
  const fy4 = computeFinancialYear('', '');
  assert(/^\d{4}-04-01$/.test(fy4.from), `FY fallback from matches YYYY-04-01: ${fy4.from}`);
  assert(/^\d{4}-03-31$/.test(fy4.to), `FY fallback to matches YYYY-03-31: ${fy4.to}`);

  // -----------------------------------------------------------------
  // 9. Bug 3: Dataset-Aware Date Filtering Logic
  // -----------------------------------------------------------------
  console.log('\n▶ Test 9: Bug 3 — Dataset-Aware Date Filtering Logic');
  const masterList = [
    'ledgers', 'groups', 'cost_centers', 'customers', 'vendors',
    'stock_items', 'stock_groups', 'units', 'godowns'
  ];
  for (const mId of masterList) {
    assert(isDateFilteredEntity(mId) === false, `Master dataset "${mId}" does NOT require date filter`);
  }

  const dateFilteredList = [
    'sales_orders', 'purchase_orders', 'delivery_notes', 'receipt_notes',
    'trial_balance', 'sales_register'
  ];
  for (const dId of dateFilteredList) {
    assert(isDateFilteredEntity(dId) === true, `Date-filtered dataset "${dId}" requires date filter`);
  }

  // -----------------------------------------------------------------
  // 10. Bug 4: 0-Record Valid CSV Generation & Error Reporting
  // -----------------------------------------------------------------
  console.log('\n▶ Test 10: Bug 4 — 0-Record Valid CSV Generation & Error Reporting');
  // 10a: Exporting empty dataset generates valid CSV with headers (size > 0)
  const emptyGodownsResult = await CsvExporter.exportToStorage('godowns', [], {
    storage: testStorage
  });
  assert(emptyGodownsResult.rowCount === 0, 'Empty export reports rowCount = 0');
  assert(fs.existsSync(emptyGodownsResult.filePath), 'Empty export CSV file was created');
  const emptyCsvContent = fs.readFileSync(emptyGodownsResult.filePath, 'utf-8');
  const godownSchema = getSchema('godowns');
  assert(emptyCsvContent.includes(godownSchema.columns[0]), 'Empty CSV contains schema headers');

  // 10b: Tally error XML must throw and never be treated as empty success
  const tallyLineErrorXml = `
<ENVELOPE>
  <HEADER><STATUS>1</STATUS></HEADER>
  <BODY>
    <DATA>
      <LINEERROR>Voucher type 'Sales' not found in active company</LINEERROR>
    </DATA>
  </BODY>
</ENVELOPE>`;
  let caughtLineError = false;
  try {
    parser.parseRawXml(tallyLineErrorXml);
  } catch (err) {
    caughtLineError = true;
    assert(err.code === 'TALLY_LINE_ERROR', `Throws TALLY_LINE_ERROR: ${err.message}`);
    assert(err.message.includes('Voucher type'), 'Error message contains line error detail');
  }
  assert(caughtLineError, 'Tally LINEERROR triggers thrown exception');

  const tallyStatusZeroXml = `
<ENVELOPE>
  <HEADER>
    <STATUS>0</STATUS>
    <ERROR>Action failed due to invalid company state</ERROR>
  </HEADER>
  <BODY></BODY>
</ENVELOPE>`;
  let caughtStatusZero = false;
  try {
    parser.parseRawXml(tallyStatusZeroXml);
  } catch (err) {
    caughtStatusZero = true;
    assert(err.code === 'TALLY_ERROR', `Throws TALLY_ERROR on STATUS=0: ${err.message}`);
  }
  assert(caughtStatusZero, 'STATUS=0 triggers thrown exception');

  // Cleanup test directory
  fs.rmSync(TEST_EXPORTS_DIR, { recursive: true, force: true });

  console.log('\n===============================================================');
  console.log('✔ ALL EXTRACTION & ZERO-MOCK PIPELINE TESTS PASSED (10/10)');
  console.log('===============================================================\n');
}

run().catch(err => {
  console.error('\n✖ TEST SUITE RUNTIME FAILURE:', err);
  process.exit(1);
});
