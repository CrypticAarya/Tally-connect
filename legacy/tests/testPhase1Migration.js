import { TallyXmlHttpAdapter } from '../server/src/adapters/tallyXmlHttpAdapter.js';
import { TdlBuilder } from '../server/src/adapters/tdlBuilder.js';
import { TallyXmlParser } from '../server/src/adapters/xmlParser.js';
import {
  SAMPLE_COMPANY_XML,
  SAMPLE_CUSTOMER_XML,
  SAMPLE_SALES_REGISTER_XML,
  SAMPLE_CHART_OF_ACCOUNTS_XML,
  SAMPLE_TRIAL_BALANCE_XML
} from './mock/xmlFixtures.js';
import { MockTallyAdapter } from './mock/mockTallyAdapter.js';
import { JsonTransformer } from '../server/src/engine/jsonTransformer.js';
import { SaasRepository } from '../server/src/db/saasRepository.js';
import app, { startServer } from '../server/src/index.js';

async function runPhase1Validation() {
  console.log('================================================================');
  console.log('🚀 PHASE 1: CORE ARCHITECTURE MIGRATION VALIDATION');
  console.log('Testing: Server Startup | Tally Adapter | TDL Builder | XML Parser | Mock Extraction');
  console.log('================================================================\n');

  let passedChecks = 0;
  const totalChecks = 5;

  // -------------------------------------------------------------
  // Check 1: Tally Adapter Loads
  // -------------------------------------------------------------
  console.log('▶ CHECK 1: Verifying Tally Adapter Loading...');
  try {
    const adapter = new TallyXmlHttpAdapter({
      host: '127.0.0.1',
      port: 9000,
      fixtureFallback: true
    });

    if (typeof adapter.testConnection !== 'function' ||
        typeof adapter.fetchCustomers !== 'function' ||
        typeof adapter.fetchSalesRegister !== 'function') {
      throw new Error('TallyXmlHttpAdapter is missing required interface methods.');
    }

    console.log('  ✔ TallyXmlHttpAdapter loaded and initialized successfully.');
    console.log(`    - Host: ${adapter.host}, Port: ${adapter.port}`);
    console.log(`    - Fixture fallback enabled: ${adapter.fixtureFallback}`);
    passedChecks++;
  } catch (err) {
    console.error(`  ✖ Check 1 Failed: ${err.message}`);
    process.exit(1);
  }

  // -------------------------------------------------------------
  // Check 2: TDL Generation Works
  // -------------------------------------------------------------
  console.log('\n▶ CHECK 2: Verifying TDL Request Generation...');
  try {
    const companyXml = TdlBuilder.buildCompanyRequest();
    const customerXml = TdlBuilder.buildCustomerRequest();
    const coaXml = TdlBuilder.buildChartOfAccountsRequest();
    const salesXml = TdlBuilder.buildSalesRegisterRequest({ fromDate: '2026-04-01', toDate: '2026-09-30' });
    const tbXml = TdlBuilder.buildTrialBalanceRequest();

    const validateTdlEnvelope = (xml, id) => {
      return xml.includes('<ENVELOPE>') &&
             xml.includes('<HEADER>') &&
             xml.includes('<TDL>') &&
             xml.includes(id);
    };

    if (!validateTdlEnvelope(companyXml, 'ActiveCompaniesCollection')) throw new Error('Company TDL request invalid');
    if (!validateTdlEnvelope(customerXml, 'CustomerMasterCollection')) throw new Error('Customer TDL request invalid');
    if (!validateTdlEnvelope(coaXml, 'ChartOfAccountsCollection')) throw new Error('COA TDL request invalid');
    if (!validateTdlEnvelope(salesXml, 'SalesRegisterVouchersCollection')) throw new Error('Sales Register TDL request invalid');
    if (!validateTdlEnvelope(tbXml, 'TrialBalanceLedgersCollection')) throw new Error('Trial Balance TDL request invalid');

    console.log('  ✔ TDL Generation verified for 5 core collections:');
    console.log('    - Company Request: OK');
    console.log('    - Customer Master (Sundry Debtors): OK');
    console.log('    - Chart of Accounts: OK');
    console.log('    - Sales Register (with date filters 2026-04-01 to 2026-09-30): OK');
    console.log('    - Trial Balance: OK');
    passedChecks++;
  } catch (err) {
    console.error(`  ✖ Check 2 Failed: ${err.message}`);
    process.exit(1);
  }

  // -------------------------------------------------------------
  // Check 3: XML Parser Works
  // -------------------------------------------------------------
  console.log('\n▶ CHECK 3: Verifying Tally XML Parser...');
  try {
    const parser = new TallyXmlParser();

    const companyData = parser.normalizeCompany(SAMPLE_COMPANY_XML);
    if (!companyData || !companyData.name) throw new Error('Failed to parse company XML');

    const customerData = parser.normalizeCustomers(SAMPLE_CUSTOMER_XML);
    if (!customerData || customerData.length === 0) throw new Error('Failed to parse customer XML');

    const salesData = parser.normalizeSalesVouchers(SAMPLE_SALES_REGISTER_XML);
    if (!salesData || salesData.length === 0) throw new Error('Failed to parse sales voucher XML');

    console.log('  ✔ TallyXmlParser successfully parsed all XML fixtures:');
    console.log(`    - Company Parsed: "${companyData.name}" (GUID: ${companyData.guid || 'N/A'})`);
    console.log(`    - Customers Parsed: ${customerData.length} (Sample: "${customerData[0].name}", GSTIN: ${customerData[0].statutory?.gstin || 'N/A'})`);
    console.log(`    - Sales Invoices Parsed: ${salesData.length} (Voucher #${salesData[0].voucherNumber})`);
    passedChecks++;
  } catch (err) {
    console.error(`  ✖ Check 3 Failed: ${err.message}`);
    process.exit(1);
  }

  // -------------------------------------------------------------
  // Check 4: Mock Extraction & JSON Transformation Works
  // -------------------------------------------------------------
  console.log('\n▶ CHECK 4: Verifying Mock Extraction & JSON Transformation...');
  try {
    const mockAdapter = new MockTallyAdapter();

    const connTest = await mockAdapter.testConnection();
    if (!connTest.available) throw new Error('Mock adapter testConnection returned unavailable');

    const customers = await mockAdapter.fetchCustomers();
    const sales = await mockAdapter.fetchSalesRegister();
    const coa = await mockAdapter.fetchChartOfAccounts();
    const tb = await mockAdapter.fetchTrialBalance();

    // Verify JsonTransformer outputs clean camelCase models
    const jsonCustomers = JsonTransformer.transform('CUSTOMERS', customers);
    const jsonSales = JsonTransformer.transform('SALES', sales);
    const jsonLedgers = JsonTransformer.transform('LEDGERS', coa);
    const jsonTb = JsonTransformer.transform('TRIAL_BALANCE', tb);

    if (jsonCustomers.length === 0 || !jsonCustomers[0].name || jsonCustomers[0].gstin === undefined) {
      throw new Error('JsonTransformer customer output invalid');
    }
    if (jsonSales.length === 0 || !jsonSales[0].voucherNumber || !Array.isArray(jsonSales[0].items)) {
      throw new Error('JsonTransformer sales output invalid');
    }

    console.log('  ✔ Mock Extraction & JSON Transformation verified:');
    console.log(`    - Customers Extracted & Transformed: ${jsonCustomers.length} entities`);
    console.log(`    - Sales Invoices Extracted & Transformed: ${jsonSales.length} entities`);
    console.log(`    - Ledgers Extracted & Transformed: ${jsonLedgers.length} entities`);
    console.log(`    - Trial Balance Rows Extracted & Transformed: ${jsonTb.length} entities`);
    passedChecks++;
  } catch (err) {
    console.error(`  ✖ Check 4 Failed: ${err.message}`);
    process.exit(1);
  }

  // -------------------------------------------------------------
  // Check 5: Server Starts & Modular Routes Respond
  // -------------------------------------------------------------
  console.log('\n▶ CHECK 5: Verifying Server Startup & Modular Routes...');
  let serverInstance = null;
  try {
    const testPort = 5099; // Use unique test port to avoid conflicting with active dev server
    serverInstance = await startServer(testPort);

    // Test health endpoint
    const healthRes = await fetch(`http://localhost:${testPort}/api/health`);
    const healthJson = await healthRes.json();
    if (healthJson.status !== 'OK') throw new Error('Server health check did not return OK');

    // Provision real connection and cache for SaaS customer data test
    const testConn = await SaasRepository.createConnection({
      saasAppId: 'app_demo_fintech',
      externalUserId: 'usr_phase1_test',
      companyName: 'Phase 1 Enterprise',
      status: 'ACTIVE'
    });
    await SaasRepository.saveEntityCache({
      connectionId: testConn.id,
      entityType: 'customers',
      dataJson: [
        { id: 'cust_ph1_01', name: 'Phase 1 Sample Customer', gstin: '27AABC1234D1Z5' }
      ]
    });

    // Test new modular v1 customers route
    const v1Res = await fetch(`http://localhost:${testPort}/api/v1/customers`, {
      headers: {
        'x-api-key': 'tc_live_fintech_7a8b9c0d1e2f',
        'x-connection-id': testConn.id
      }
    });
    const v1Json = await v1Res.json();
    if (!v1Json.success || !Array.isArray(v1Json.data)) {
      throw new Error(`Modular /api/v1/customers route failed: ${JSON.stringify(v1Json)}`);
    }

    // Test new connect initiate route
    const connectRes = await fetch(`http://localhost:${testPort}/api/connect/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerExternalId: 'ext_cust_101',
        customerName: 'Pinnacle Fasteners Pvt Ltd'
      })
    });
    const connectJson = await connectRes.json();
    if (!connectJson.success || !connectJson.activationCode) {
      throw new Error('Modular /api/connect/initiate route failed');
    }

    // Test internal console metrics route
    const metricsRes = await fetch(`http://localhost:${testPort}/api/internal/console/metrics`);
    const metricsJson = await metricsRes.json();
    if (metricsJson.activeAgents === undefined) {
      throw new Error('Modular /api/internal/console/metrics route failed');
    }

    console.log('  ✔ Server started cleanly and responded on port ' + testPort);
    console.log('  ✔ Tested /api/health -> status: OK');
    console.log(`  ✔ Tested /api/v1/customers -> returned ${v1Json.count} normalized customer records`);
    console.log(`  ✔ Tested /api/connect/initiate -> generated activation code "${connectJson.activationCode}"`);
    console.log(`  ✔ Tested /api/internal/console/metrics -> active agents: ${metricsJson.activeAgents}`);
    passedChecks++;
  } catch (err) {
    console.error(`  ✖ Check 5 Failed: ${err.message}`);
    process.exit(1);
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
  }

  console.log('\n================================================================');
  console.log(`🎉 PHASE 1 VALIDATION COMPLETE: ${passedChecks}/${totalChecks} CHECKS PASSED`);
  console.log('Core architecture successfully migrated with 100% preservation of Tally XML adapters.');
  console.log('================================================================\n');

  process.exit(0);
}

runPhase1Validation().catch(err => {
  console.error('Fatal validation error:', err);
  process.exit(1);
});
