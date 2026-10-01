import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { pool } from '../../server/src/db/mysql.js';
import { CloudClient } from '../../connector-agent/src/cloudClient.js';
import { SyncWorker } from '../../connector-agent/src/syncWorker.js';
import { TallyXmlHttpAdapter } from '../../connector-agent/src/adapters/tallyXmlHttpAdapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_URL = 'http://127.0.0.1:5001';

function createTallyXmlServer(port = 9000) {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      res.writeHead(200, {
        'Content-Type': 'text/xml;charset=utf-8',
        'Server': 'TallyPrime/4.1 (Windows)'
      });

      if (body.includes('ActiveCompaniesCollection') || body.includes('ActiveCompanyProbe')) {
        res.end(`<ENVELOPE><HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER><BODY><DATA><COLLECTION><COMPANY NAME="Apex Industrial Technologies Pvt Ltd"><NAME>Apex Industrial Technologies Pvt Ltd</NAME><GUID>apex-ind-tech-9988</GUID><STARTINGFROM>20260401</STARTINGFROM><ENDINGAT>20270331</ENDINGAT></COMPANY></COLLECTION></DATA></BODY></ENVELOPE>`);
        return;
      }

      if (body.includes('CustomerMasterCollection')) {
        res.end(`<ENVELOPE><HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER><BODY><DATA><COLLECTION><LEDGER NAME="Apex Engineering Works"><NAME>Apex Engineering Works</NAME><PARENT>Sundry Debtors</PARENT><GUID>cust-apex-eng-001</GUID><STATENAME>Maharashtra</STATENAME><COUNTRYNAME>India</COUNTRYNAME><PARTYGSTIN>27AAACA1234A1Z5</PARTYGSTIN><ADDRESS>77 Industrial Estate, Pune</ADDRESS><PINCODE>411018</PINCODE><OPENINGBALANCE>125000.00</OPENINGBALANCE><CLOSINGBALANCE>345000.00</CLOSINGBALANCE></LEDGER></COLLECTION></DATA></BODY></ENVELOPE>`);
        return;
      }

      if (body.includes('SalesRegisterVouchersCollection')) {
        res.end(`<ENVELOPE><HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER><BODY><DATA><COLLECTION><VOUCHER VOUCHERTYPE="Sales" DATE="20260415"><VOUCHERNUMBER>INV/2026/001</VOUCHERNUMBER><DATE>20260415</DATE><PARTYLEDGERNAME>Apex Engineering Works</PARTYLEDGERNAME><PARTYGSTIN>27AAACA1234A1Z5</PARTYGSTIN><AMOUNT>-118000.00</AMOUNT><ALLINVENTORYENTRIES.LIST><STOCKITEMNAME>Heavy Duty Hydraulic Pump</STOCKITEMNAME><ACTUALQTY>2 NOS</ACTUALQTY><BILLEDQTY>2 NOS</BILLEDQTY><RATE>50000.00/NOS</RATE><AMOUNT>-100000.00</AMOUNT></ALLINVENTORYENTRIES.LIST></VOUCHER></COLLECTION></DATA></BODY></ENVELOPE>`);
        return;
      }

      if (body.includes('StockItemMasterCollection')) {
        res.end(`<ENVELOPE><HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER><BODY><DATA><COLLECTION><STOCKITEM NAME="Heavy Duty Hydraulic Pump"><NAME>Heavy Duty Hydraulic Pump</NAME><GUID>stock-heavy-duty-pump</GUID><PARENT>Hydraulic Components</PARENT><BASEUNITS>NOS</BASEUNITS><OPENINGBALANCE>10 NOS</OPENINGBALANCE><OPENINGVALUE>500000.00</OPENINGVALUE><CLOSINGBALANCE>8 NOS</CLOSINGBALANCE><CLOSINGVALUE>400000.00</CLOSINGVALUE><CLOSINGRATE>50000.00</CLOSINGRATE></STOCKITEM></COLLECTION></DATA></BODY></ENVELOPE>`);
        return;
      }

      res.end(`<ENVELOPE><HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER><BODY><DATA><COLLECTION></COLLECTION></DATA></BODY></ENVELOPE>`);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

function logStep(title) {
  console.log(`\n======================================================`);
  console.log(`▶ ${title}`);
  console.log(`======================================================`);
}

function assert(condition, message) {
  if (!condition) {
    console.error(`✖ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✔ ${message}`);
}

async function runTest() {
  console.log('===============================================================');
  console.log('🧪 PHASE 5: PERMISSION-BASED TALLY EXTRACTION & SYNC ENGINE');
  console.log('===============================================================');

  // Pre-check: Verify server
  logStep('Pre-Check: Verify Cloud Server is Online');
  const healthRes = await fetch(`${SERVER_URL}/api/health`);
  const health = await healthRes.json();
  assert(health.status === 'OK', `Cloud server is online (${health.service})`);

  // -------------------------------------------------------------------
  // Setup: Create SaaS App, Connection, and Agent
  // -------------------------------------------------------------------
  logStep('Setup: Register SaaS App, Initiate Connection & Activate Agent');
  const appRes = await fetch(`${SERVER_URL}/api/internal/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Fintech Cloud Invoicing Ltd',
      redirect_url: 'https://fintechcloud.io/oauth/callback'
    })
  });
  const appData = await appRes.json();
  const saasApp = appData.app || appData;
  assert(saasApp.api_key, `Created SaaS App: "${saasApp.name}" (ID: ${saasApp.id})`);

  // Initiate connection
  const initRes = await fetch(`${SERVER_URL}/api/connect/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': saasApp.api_key
    },
    body: JSON.stringify({
      saas_app_id: saasApp.id,
      external_user_id: 'usr_phase5_customer',
      company_name: 'Phase 5 Global Manufacturing Corp'
    })
  });
  const init = await initRes.json();
  const connectionId = init.connection_id;
  const activationCode = init.activation_code;
  assert(activationCode && activationCode.startsWith('TC-'), `Generated code: ${activationCode}`);

  // Agent activates
  const activateRes = await fetch(`${SERVER_URL}/api/agent/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      activation_code: activationCode,
      machine_name: 'PHASE5-WIN-NODE',
      active_company: 'Phase 5 Global Manufacturing Corp'
    })
  });
  const act = await activateRes.json();
  assert(act.success, `Agent activated successfully (Agent ID: ${act.agent_id})`);
  const agentToken = act.agent_token;
  const agentId = act.agent_id;

  // Initialize agent clients
  const cloudClient = new CloudClient({
    cloudUrl: SERVER_URL,
    connectionId,
    agentId,
    agentToken
  });

  let tallyServer = null;
  try {
    tallyServer = await createTallyXmlServer(9000);
    console.log('  ✔ Tally XML Server listening on http://127.0.0.1:9000');
  } catch (err) {
    console.log('  ℹ Note: Port 9000 already in use, reusing active instance');
  }

  const syncWorker = new SyncWorker({
    cloudClient,
    tallyAdapter: new TallyXmlHttpAdapter({ host: '127.0.0.1', port: 9000 }),
    config: {
      connectionId,
      agentId,
      agentToken,
      cloudUrl: SERVER_URL
    }
  });

  // -------------------------------------------------------------------
  // 1. Agent reads permissions
  // -------------------------------------------------------------------
  logStep('1. Verification: Agent reads permissions');
  const permissions = await cloudClient.getPermissions(connectionId);
  assert(permissions !== null, 'Agent successfully retrieved connection permissions from cloud');
  assert(permissions.customers === true, 'Permission allow_customers is true');
  assert(permissions.sales === true, 'Permission allow_sales is true');
  assert(permissions.inventory === false, 'Permission allow_inventory is false (default disabled)');
  console.log('✓ Agent reads permissions');

  // -------------------------------------------------------------------
  // 2. Customer sync works & JSON cache updated
  // -------------------------------------------------------------------
  logStep('2. Verification: Customer sync works & JSON cache updated');
  const custSyncRes = await syncWorker.syncEntity('customers');
  assert(custSyncRes.success, `Customer sync succeeded: extracted and uploaded ${custSyncRes.count} records`);
  assert(custSyncRes.count > 0, 'Customer sync extracted positive count');

  // Verify in MySQL entity_cache table
  const [custCacheRows] = await pool.query(
    'SELECT * FROM entity_cache WHERE connection_id = ? AND entity_type = "customers"',
    [connectionId]
  );
  const rawCustData = custCacheRows[0].data_json;
  const cachedCustData = typeof rawCustData === 'string' ? JSON.parse(rawCustData) : rawCustData;
  assert(Array.isArray(cachedCustData) && cachedCustData.length > 0, `Cached customer records in MySQL: ${cachedCustData.length}`);
  console.log('✓ Customer sync works');
  console.log('✓ JSON cache updated');

  // -------------------------------------------------------------------
  // 3. Sales sync works
  // -------------------------------------------------------------------
  logStep('3. Verification: Sales sync works');
  const salesSyncRes = await syncWorker.syncEntity('sales');
  assert(salesSyncRes.success, `Sales sync succeeded: extracted and uploaded ${salesSyncRes.count} records`);

  // Verify in MySQL entity_cache table
  const [salesCacheRows] = await pool.query(
    'SELECT * FROM entity_cache WHERE connection_id = ? AND entity_type = "sales"',
    [connectionId]
  );
  assert(salesCacheRows.length > 0, 'MySQL entity_cache table contains "sales" record');
  const rawSalesData = salesCacheRows[0].data_json;
  const cachedSalesData = typeof rawSalesData === 'string' ? JSON.parse(rawSalesData) : rawSalesData;
  assert(Array.isArray(cachedSalesData) && cachedSalesData.length > 0, `Cached sales records in MySQL: ${cachedSalesData.length}`);
  console.log('✓ Sales sync works');

  // -------------------------------------------------------------------
  // 4. Inventory blocked when disabled
  // -------------------------------------------------------------------
  logStep('4. Verification: Inventory blocked when disabled');
  // Attempt to start sync for inventory
  const invStartRes = await cloudClient.startSync({
    connectionId,
    agentId,
    entityType: 'inventory'
  });
  assert(invStartRes.status === 403 || invStartRes.error?.includes('Permission denied'), 'Cloud /sync/start rejects inventory with 403 Permission denied.');

  // Attempt to upload sync payload for inventory directly
  const invUploadRes = await cloudClient.uploadSyncPayload({
    connectionId,
    entityType: 'inventory',
    data: [{ id: 'inv-1', name: 'Raw Material' }]
  });
  assert(invUploadRes.status === 403 || invUploadRes.error?.includes('Permission denied'), 'Cloud /sync/upload rejects inventory with 403 Permission denied.');
  console.log('✓ Inventory blocked when disabled');

  // -------------------------------------------------------------------
  // 5. SaaS API returns data in exact requested schema
  // -------------------------------------------------------------------
  logStep('5. Verification: SaaS API returns data with clean JSON structure');

  // GET /api/v1/customers
  const saasCustRes = await fetch(`${SERVER_URL}/api/v1/customers`, {
    headers: {
      'x-api-key': saasApp.api_key,
      'x-connection-id': connectionId
    }
  });
  assert(saasCustRes.status === 200, `GET /api/v1/customers returned HTTP 200 OK`);
  const saasCustBody = await saasCustRes.json();
  assert(saasCustBody.success === true, 'SaaS customers response success: true');
  assert(Array.isArray(saasCustBody.data) && saasCustBody.data.length > 0, `SaaS customers response has data array (${saasCustBody.data.length} records)`);

  const sampleCust = saasCustBody.data[0];
  assert('id' in sampleCust, 'Customer has "id" field');
  assert('name' in sampleCust, 'Customer has "name" field');
  assert('gstin' in sampleCust, 'Customer has "gstin" field');
  assert('address' in sampleCust, 'Customer has "address" field');
  console.log('Sample Customer response record:');
  console.log(JSON.stringify(sampleCust, null, 2));

  // GET /api/v1/sales
  const saasSalesRes = await fetch(`${SERVER_URL}/api/v1/sales`, {
    headers: {
      'x-api-key': saasApp.api_key,
      'x-connection-id': connectionId
    }
  });
  assert(saasSalesRes.status === 200, `GET /api/v1/sales returned HTTP 200 OK`);
  const saasSalesBody = await saasSalesRes.json();
  assert(saasSalesBody.success === true, 'SaaS sales response success: true');
  assert(Array.isArray(saasSalesBody.data) && saasSalesBody.data.length > 0, `SaaS sales response has data array (${saasSalesBody.data.length} records)`);

  const sampleSale = saasSalesBody.data[0];
  assert('invoice' in sampleSale, 'Sale has "invoice" field');
  assert('customer' in sampleSale, 'Sale has "customer" field');
  assert('amount' in sampleSale, 'Sale has "amount" field');
  assert('items' in sampleSale && Array.isArray(sampleSale.items), 'Sale has "items" array');
  console.log('Sample Sale response record:');
  console.log(JSON.stringify(sampleSale, null, 2));
  console.log('✓ SaaS API returns data');

  // -------------------------------------------------------------------
  // 6. Permission restrictions enforced (403 Permission denied.)
  // -------------------------------------------------------------------
  logStep('6. Verification: Permission restrictions enforced');

  // 6a. GET /api/v1/inventory when allow_inventory=false
  const invApiRes = await fetch(`${SERVER_URL}/api/v1/inventory`, {
    headers: {
      'x-api-key': saasApp.api_key,
      'x-connection-id': connectionId
    }
  });
  assert(invApiRes.status === 403, `GET /api/v1/inventory returned HTTP 403`);
  const invApiBody = await invApiRes.json();
  assert(invApiBody.error === 'Permission denied.', 'Error body contains "Permission denied."');

  // 6b. Dynamically disable allow_sales: allow_sales = false
  console.log('\nDynamically updating permissions: allow_sales = false...');
  const updatePermsRes = await fetch(`${SERVER_URL}/api/connect/${connectionId}/permissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': saasApp.api_key
    },
    body: JSON.stringify({ sales: false })
  });
  assert(updatePermsRes.status === 200, 'Permissions updated via API');

  // Now GET /api/v1/sales MUST return 403 Permission denied.
  const salesBlockedRes = await fetch(`${SERVER_URL}/api/v1/sales`, {
    headers: {
      'x-api-key': saasApp.api_key,
      'x-connection-id': connectionId
    }
  });
  assert(salesBlockedRes.status === 403, 'GET /api/v1/sales returns HTTP 403 when allow_sales=false');
  const salesBlockedBody = await salesBlockedRes.json();
  assert(salesBlockedBody.error === 'Permission denied.', 'Response body is "Permission denied."');

  // 6c. Dynamically re-enable allow_sales and allow_inventory
  console.log('\nDynamically re-enabling allow_sales=true and allow_inventory=true...');
  await fetch(`${SERVER_URL}/api/connect/${connectionId}/permissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': saasApp.api_key
    },
    body: JSON.stringify({ sales: true, inventory: true })
  });

  // Now GET /api/v1/sales works again (HTTP 200)
  const salesAllowedRes = await fetch(`${SERVER_URL}/api/v1/sales`, {
    headers: {
      'x-api-key': saasApp.api_key,
      'x-connection-id': connectionId
    }
  });
  assert(salesAllowedRes.status === 200, 'GET /api/v1/sales returns HTTP 200 after allow_sales=true re-enabled');

  // Now sync inventory
  const invSyncRes = await syncWorker.syncEntity('inventory');
  assert(invSyncRes.success, 'Inventory sync now succeeds when allow_inventory=true');

  // GET /api/v1/inventory now returns HTTP 200
  const invAllowedRes = await fetch(`${SERVER_URL}/api/v1/inventory`, {
    headers: {
      'x-api-key': saasApp.api_key,
      'x-connection-id': connectionId
    }
  });
  assert(invAllowedRes.status === 200, 'GET /api/v1/inventory returns HTTP 200 after allow_inventory=true');
  console.log('✓ Permission restrictions enforced');

  // -------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('🎉 ALL PHASE 5 VALIDATION CHECKS PASSED:');
  console.log('  ✓ Agent reads permissions');
  console.log('  ✓ Customer sync works');
  console.log('  ✓ Sales sync works');
  console.log('  ✓ Inventory blocked when disabled');
  console.log('  ✓ JSON cache updated');
  console.log('  ✓ SaaS API returns data');
  console.log('  ✓ Permission restrictions enforced');
  console.log('===============================================================\n');

  if (tallyServer) {
    tallyServer.close();
  }

  process.exit(0);
}

runTest().catch(err => {
  console.error('\n✖ Phase 5 Simulation Failed:', err);
  process.exit(1);
});
