/**
 * Tally Connect — Phase 12 Step 2: True External SaaS Integration Test
 * 
 * STRICT RULES:
 * 1. ZERO internal repository or database imports (no mysql.js, no saasRepository.js).
 * 2. ONLY standard HTTP API calls and the public @tallyconnect/sdk client.
 * 3. NO mock/demo data dependencies.
 * 4. Genuine developer authentication, app creation, customer onboarding,
 *    agent activation, permission governance, multi-tenant isolation,
 *    webhook delivery & signature verification.
 */

import http from 'http';
import assert from 'assert';
import { TallyConnect } from '../../sdk/tallyConnect.js';

const BASE_URL = process.env.CLOUD_URL || 'http://127.0.0.1:5001';
const WEBHOOK_PORT = 5098;

let webhookServer;
let receivedWebhooks = [];

function startWebhookServer(port = WEBHOOK_PORT) {
  return new Promise((resolve, reject) => {
    receivedWebhooks = [];
    webhookServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch { parsed = body; }
        receivedWebhooks.push({
          method: req.method,
          url: req.url,
          headers: req.headers,
          rawBody: body,
          body: parsed
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received: true }));
      });
    });

    webhookServer.listen(port, '127.0.0.1', () => resolve(webhookServer));
    webhookServer.on('error', reject);
  });
}

function stopWebhookServer() {
  if (webhookServer) {
    webhookServer.close();
  }
}

async function runExternalSaasIntegrationTest() {
  console.log('===============================================================');
  console.log('🌐 PHASE 12: EXTERNAL SAAS INTEGRATION READINESS TEST');
  console.log('===============================================================\n');

  let passed = 0;
  const total = 25;

  try {
    await startWebhookServer(WEBHOOK_PORT);
    const webhookUrl = `http://127.0.0.1:${WEBHOOK_PORT}/webhooks/tally`;

    // -------------------------------------------------------------------------
    // TEST 1: Developer Registration & Login
    // -------------------------------------------------------------------------
    console.log('▶ TEST 1: Developer Registration & Login...');
    const testEmail = `external_saas_${Date.now()}@acmeplatform.io`;
    const regResp = await fetch(`${BASE_URL}/api/developer/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Jordan Bell',
        email: testEmail,
        password: 'SaasSecurePassword@2026'
      })
    });
    assert.strictEqual(regResp.status, 201, 'Developer registration must return 201');
    const regData = await regResp.json();
    assert.strictEqual(regData.success, true);
    assert.ok(regData.token, 'Must return developer authentication token');
    const devToken = regData.token;

    const loginResp = await fetch(`${BASE_URL}/api/developer/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'SaasSecurePassword@2026'
      })
    });
    assert.strictEqual(loginResp.status, 200, 'Developer login must return 200');
    console.log('  ✔ Developer registered and logged in successfully via public API');
    passed++;

    // -------------------------------------------------------------------------
    // TEST 2: App Creation
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 2: App Creation...');
    const appResp = await fetch(`${BASE_URL}/api/developer/apps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${devToken}`
      },
      body: JSON.stringify({
        app_name: 'Acme Automated Billing',
        webhook_url: webhookUrl
      })
    });
    assert.strictEqual(appResp.status, 201, 'App creation must return 201');
    const appData = await appResp.json();
    assert.strictEqual(appData.success, true);
    const appId = appData.app.id;
    let apiKey = appData.app.api_key;
    const apiSecret = appData.app.api_secret;
    assert.ok(appId && apiKey && apiSecret, 'App must receive ID, apiKey, and apiSecret');
    console.log(`  ✔ Application created: ID=${appId}, apiKey=${apiKey.slice(0, 15)}...`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 3: API Key Retrieval
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 3: API Key Retrieval via Developer Portal API...');
    const keyResp = await fetch(`${BASE_URL}/api/developer/apps/${appId}/api-key`, {
      headers: { 'Authorization': `Bearer ${devToken}` }
    });
    assert.strictEqual(keyResp.status, 200);
    const keyData = await keyResp.json();
    assert.strictEqual(keyData.api_key, apiKey);
    assert.strictEqual(keyData.api_secret, apiSecret);
    console.log('  ✔ API credentials verified via GET /api/developer/apps/:id/api-key');
    passed++;

    // Initialize Public SDK Client
    const sdk = new TallyConnect({
      baseUrl: BASE_URL,
      apiKey: apiKey
    });

    // -------------------------------------------------------------------------
    // TEST 4 & 5: Customer Connection Creation & Activation Code Generation
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 4 & 5: Customer Connection Creation & Activation Code Generation...');
    const session = await sdk.createConnection({
      appId: appId,
      externalUserId: 'cust_tenant_1001',
      companyName: 'Apex Machinery & Hardware Ltd'
    });
    assert.ok(session.connectionId, 'Must return connectionId');
    assert.ok(session.activationCode, 'Must return activationCode');
    assert.ok(session.activationCode.startsWith('TC-'), 'Activation code must start with TC-');
    assert.strictEqual(session.activationCode.length, 7, 'Activation code must be 7 chars (e.g. TC-4829)');
    assert.ok(session.expiresAt, 'Must have expiresAt timestamp');
    const connectionId = session.connectionId;
    const activationCode = session.activationCode;
    console.log(`  ✔ Connection created via SDK: ${connectionId}`);
    console.log(`  ✔ Activation code generated: ${activationCode} (Expires: ${session.expiresAt})`);
    passed += 2;

    // -------------------------------------------------------------------------
    // TEST 6: Desktop Agent Activation
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 6: Desktop Agent Activation with Code...');
    const actResp = await fetch(`${BASE_URL}/api/agent/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activation_code: activationCode,
        machine_name: 'WIN-FINANCE-SRV01',
        active_company: 'Apex Machinery & Hardware Ltd'
      })
    });
    assert.strictEqual(actResp.status, 200, 'Agent activation must return 200');
    const actData = await actResp.json();
    assert.strictEqual(actData.success, true);
    assert.ok(actData.agent_token, 'Must issue agent_token');
    assert.strictEqual(actData.status, 'ACTIVE');
    const agentToken = actData.agent_token;
    console.log(`  ✔ Desktop agent activated: Agent ID=${actData.agent_id}`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 7: Verify Connection Status
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 7: Verify Connection Status via SDK...');
    const status = await sdk.getConnectionStatus(connectionId);
    assert.strictEqual(status.status, 'ACTIVE');
    assert.strictEqual(status.company_name, 'Apex Machinery & Hardware Ltd');
    assert.strictEqual(status.agent_status, 'ONLINE');
    console.log(`  ✔ Connection status ACTIVE, Tally company: "${status.company_name}"`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 8: Set & Verify Permissions
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 8: Set & Verify Customer Data Permissions...');
    await sdk.updatePermissions(connectionId, {
      customers: true,
      vendors: true,
      sales: true,
      inventory: false,
      ledgers: true,
      orders: false,
      trial_balance: false
    });

    const permsResult = await sdk.getPermissions(connectionId);
    const perms = permsResult.permissions || permsResult;
    assert.strictEqual(Boolean(perms.allow_customers ?? perms.customers), true);
    assert.strictEqual(Boolean(perms.allow_vendors ?? perms.vendors), true);
    assert.strictEqual(Boolean(perms.allow_sales ?? perms.sales), true);
    assert.strictEqual(Boolean(perms.allow_inventory ?? perms.inventory), false);
    assert.strictEqual(Boolean(perms.allow_ledgers ?? perms.ledgers), true);
    console.log('  ✔ Permissions verified: Customers=TRUE, Vendors=TRUE, Sales=TRUE, Inventory=FALSE');
    passed++;

    // -------------------------------------------------------------------------
    // TEST 9 & 10: Trigger Sync & Agent Upload
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 9 & 10: Trigger Sync & Agent Upload...');
    const syncTrigger = await sdk.sync(connectionId);
    assert.strictEqual(syncTrigger.success, true);
    assert.ok(Array.isArray(syncTrigger.jobs), 'Must return created sync jobs');
    console.log(`  ✔ Immediate sync triggered: ${syncTrigger.jobs.length} jobs created`);

    // Desktop agent uploads real entity datasets
    const uploadEntities = [
      {
        entity_type: 'customers',
        data: [
          {
            guid: 'cust-ph12-001',
            name: 'Delta Engineering Solutions Pvt Ltd',
            gstin: '27AABCD1234E1Z6',
            address: 'Plot 44, TTC Industrial Area, MIDC, Navi Mumbai, Maharashtra, 400705'
          }
        ]
      },
      {
        entity_type: 'vendors',
        data: [
          {
            guid: 'ven-ph12-001',
            name: 'Universal Steel & Tubes Corp',
            gstin: '27AAACU1234D1Z2',
            address: 'Gala 10, Iron Market, Carnac Bunder, Mumbai, Maharashtra, 400009'
          }
        ]
      },
      {
        entity_type: 'sales',
        data: [
          {
            voucherNumber: 'INV-2026-9001',
            partyName: 'Delta Engineering Solutions Pvt Ltd',
            totalAmount: '245000',
            inventoryEntries: [
              { itemName: 'High Pressure Flange 100mm', quantity: 50, rate: 3500, amount: 175000 },
              { itemName: 'Industrial Sealing Gasket', quantity: 100, rate: 700, amount: 70000 }
            ]
          }
        ]
      },
      {
        entity_type: 'ledgers',
        data: [
          {
            guid: 'led-ph12-001',
            name: 'State Bank of India Current A/c',
            parent: 'Bank Accounts',
            openingBalance: 450000,
            closingBalance: 695000
          }
        ]
      }
    ];

    for (const item of uploadEntities) {
      const upResp = await fetch(`${BASE_URL}/api/agent/sync/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${agentToken}`
        },
        body: JSON.stringify({
          connection_id: connectionId,
          entity_type: item.entity_type,
          data: item.data
        })
      });
      assert.strictEqual(upResp.status, 200, `Upload for ${item.entity_type} must succeed`);
    }
    console.log('  ✔ Agent uploaded synchronized datasets to Cloud cache');
    passed += 2;

    // -------------------------------------------------------------------------
    // TEST 11: Retrieve Permitted Entities via Public SDK
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 11: Retrieve Permitted Accounting Data via Public SDK...');
    const customers = await sdk.getCustomers(connectionId);
    assert.ok(Array.isArray(customers) && customers.length > 0, 'Customers must be returned');
    assert.strictEqual(customers[0].name, 'Delta Engineering Solutions Pvt Ltd');

    const vendors = await sdk.getVendors(connectionId);
    assert.ok(Array.isArray(vendors) && vendors.length > 0, 'Vendors must be returned');
    assert.strictEqual(vendors[0].name, 'Universal Steel & Tubes Corp');

    const sales = await sdk.getSales(connectionId);
    assert.ok(Array.isArray(sales) && sales.length > 0, 'Sales invoices must be returned');
    assert.strictEqual(sales[0].invoice, 'INV-2026-9001');

    const ledgers = await sdk.getLedgers(connectionId);
    assert.ok(Array.isArray(ledgers) && ledgers.length > 0, 'Ledgers must be returned');
    assert.strictEqual(ledgers[0].name, 'State Bank of India Current A/c');

    console.log(`  ✔ Retrieved ${customers.length} customer(s), ${vendors.length} vendor(s), ${sales.length} invoice(s), ${ledgers.length} ledger(s)`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 12: Verify Denied Entities Return 403
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 12: Verify Denied Entities Return 403...');
    let deniedCaught = false;
    try {
      await sdk.getInventory(connectionId);
    } catch (err) {
      deniedCaught = true;
      assert.strictEqual(err.status, 403, 'Inventory must return HTTP 403 when permission disabled');
    }
    assert.strictEqual(deniedCaught, true, 'getInventory must throw 403');
    console.log('  ✔ Non-permitted entity (inventory) correctly rejected with HTTP 403');
    passed++;

    // -------------------------------------------------------------------------
    // TEST 13 & 14: Disable a Permission & Verify Immediate API Rejection
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 13 & 14: Disable a Permission & Verify Immediate API Rejection...');
    await sdk.updatePermissions(connectionId, { customers: false });

    let custBlocked = false;
    try {
      await sdk.getCustomers(connectionId);
    } catch (err) {
      custBlocked = true;
      assert.strictEqual(err.status, 403);
    }
    assert.strictEqual(custBlocked, true, 'getCustomers must immediately throw 403 once permission is revoked');
    console.log('  ✔ Disabled permission immediately blocked cached customer data with HTTP 403');
    passed += 2;

    // -------------------------------------------------------------------------
    // TEST 15 & 16: Re-Enable Permission & Verify Access Restored
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 15 & 16: Re-Enable Permission & Verify Access Restored...');
    await sdk.updatePermissions(connectionId, { customers: true });

    const custRestored = await sdk.getCustomers(connectionId);
    assert.ok(Array.isArray(custRestored) && custRestored.length > 0);
    console.log('  ✔ Access successfully restored upon re-enabling customer permission');
    passed += 2;

    // -------------------------------------------------------------------------
    // TEST 17 & 18: Webhook Delivery & Cryptographic Signature Verification
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 17 & 18: Webhook Delivery & Signature Verification...');
    await new Promise(r => setTimeout(r, 600));

    assert.ok(receivedWebhooks.length > 0, 'Webhook receiver must receive at least 1 event');
    const syncWebhook = receivedWebhooks.find(w => w.body?.event === 'sync.completed');
    assert.ok(syncWebhook, 'Must receive sync.completed webhook event');
    assert.strictEqual(syncWebhook.headers['x-tally-event'], 'sync.completed');

    const sigHeader = syncWebhook.headers['x-tally-signature'];
    assert.ok(sigHeader, 'X-Tally-Signature header must be present');

    const isSigValid = TallyConnect.verifyWebhookSignature(
      syncWebhook.rawBody,
      sigHeader,
      apiSecret
    );
    assert.strictEqual(isSigValid, true, 'Webhook HMAC-SHA256 signature must be cryptographically valid');
    console.log('  ✔ Webhook received: event="sync.completed"');
    console.log(`  ✔ Webhook signature cryptographically verified using TallyConnect.verifyWebhookSignature: ${sigHeader.slice(0, 25)}...`);
    passed += 2;

    // -------------------------------------------------------------------------
    // TEST 19: Sync History Retrieval
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 19: Sync History Retrieval...');
    const history = await sdk.getSyncHistory(connectionId);
    assert.strictEqual(history.success, true);
    assert.ok(history.records_synced >= 0);
    assert.ok(Array.isArray(history.history));
    console.log(`  ✔ Sync history retrieved: ${history.records_synced} total record(s) synced`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 20: Connection Offline Status Handling
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 20: Connection Offline Status Handling...');
    await fetch(`${BASE_URL}/api/agent/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${agentToken}`
      },
      body: JSON.stringify({
        connectionId: connectionId,
        tallyStatus: 'OFFLINE',
        machineName: 'WIN-FINANCE-SRV01'
      })
    });

    const offlineStatus = await sdk.getConnectionStatus(connectionId);
    assert.strictEqual(offlineStatus.tally_status, 'OFFLINE');
    assert.ok(offlineStatus.error?.code === 'TALLY_NOT_RUNNING', 'Should flag TALLY_NOT_RUNNING error');
    console.log('  ✔ Offline status and customer error accurately reported: TALLY_NOT_RUNNING');

    // Restore to ONLINE
    await fetch(`${BASE_URL}/api/agent/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${agentToken}`
      },
      body: JSON.stringify({
        connectionId: connectionId,
        tallyStatus: 'ONLINE',
        machineName: 'WIN-FINANCE-SRV01'
      })
    });
    passed++;

    // -------------------------------------------------------------------------
    // TEST 21: Invalid API Key Rejection
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 21: Invalid API Key Rejection...');
    const badSdk = new TallyConnect({
      baseUrl: BASE_URL,
      apiKey: 'tc_live_fraudulent_key_999999'
    });
    let badKeyCaught = false;
    try {
      await badSdk.getCustomers(connectionId);
    } catch (err) {
      badKeyCaught = true;
      assert.strictEqual(err.status, 403);
    }
    assert.strictEqual(badKeyCaught, true, 'Invalid API key must be rejected with 403');
    console.log('  ✔ Invalid API key rejected with HTTP 403');
    passed++;

    // -------------------------------------------------------------------------
    // TEST 22: Unauthorized Connection Access (Cross-Tenant Rejection)
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 22: Unauthorized Connection Access (Cross-Tenant Protection)...');
    // Provision Developer B and App B
    const devBResp = await fetch(`${BASE_URL}/api/developer/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Developer B',
        email: `dev_b_${Date.now()}@competitor.io`,
        password: 'PasswordB@2026'
      })
    });
    const devBToken = (await devBResp.json()).token;

    const appBResp = await fetch(`${BASE_URL}/api/developer/apps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${devBToken}`
      },
      body: JSON.stringify({ app_name: 'App B Isolated' })
    });
    const appBData = await appBResp.json();
    const sdkB = new TallyConnect({ baseUrl: BASE_URL, apiKey: appBData.app.api_key });

    // App B attempts to query App A's customer connection
    let crossTenantCaught = false;
    try {
      await sdkB.getCustomers(connectionId);
    } catch (err) {
      crossTenantCaught = true;
      assert.strictEqual(err.status, 403);
    }
    assert.strictEqual(crossTenantCaught, true, 'Cross-tenant access must be rejected with 403');
    console.log('  ✔ Cross-tenant access attempt strictly rejected with HTTP 403');
    passed++;

    // -------------------------------------------------------------------------
    // TEST 23: Expired / Invalid Activation Code Rejection
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 23: Invalid Activation Code Rejection...');
    const fakeActResp = await fetch(`${BASE_URL}/api/agent/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activation_code: 'TC-9999',
        machine_name: 'FAKE-MACHINE'
      })
    });
    assert.strictEqual(fakeActResp.status, 404, 'Invalid activation code must return 404');
    console.log('  ✔ Non-existent activation code rejected with HTTP 404');
    passed++;

    // -------------------------------------------------------------------------
    // TEST 24: Regenerated API Key Invalidation
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 24: Regenerated API Key Invalidation...');
    const regenResp = await fetch(`${BASE_URL}/api/developer/apps/${appId}/regenerate-key`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${devToken}` }
    });
    assert.strictEqual(regenResp.status, 200);
    const newApiKey = (await regenResp.json()).app.api_key;
    assert.notStrictEqual(newApiKey, apiKey);

    // Old key must now fail
    let oldKeyFailed = false;
    try {
      await sdk.getCustomers(connectionId);
    } catch (err) {
      oldKeyFailed = true;
      assert.strictEqual(err.status, 403);
    }
    assert.strictEqual(oldKeyFailed, true, 'Old API key must fail after regeneration');

    // New key must succeed
    const newSdk = new TallyConnect({ baseUrl: BASE_URL, apiKey: newApiKey });
    const custWithNewKey = await newSdk.getCustomers(connectionId);
    assert.ok(Array.isArray(custWithNewKey) && custWithNewKey.length > 0);
    console.log('  ✔ Old API key invalidated, new API key works seamlessly');
    passed++;

    // -------------------------------------------------------------------------
    // TEST 25: Disabled App Enforcement
    // -------------------------------------------------------------------------
    console.log('\n▶ TEST 25: Disabled App Enforcement...');
    await fetch(`${BASE_URL}/api/developer/apps/${appId}/disable`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${devToken}` }
    });

    let disabledBlocked = false;
    try {
      await newSdk.getCustomers(connectionId);
    } catch (err) {
      disabledBlocked = true;
      assert.strictEqual(err.status, 403);
    }
    assert.strictEqual(disabledBlocked, true, 'Disabled application must be rejected with 403');

    // Re-enable
    await fetch(`${BASE_URL}/api/developer/apps/${appId}/enable`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${devToken}` }
    });
    const reEnabledData = await newSdk.getCustomers(connectionId);
    assert.ok(Array.isArray(reEnabledData) && reEnabledData.length > 0);
    console.log('  ✔ Disabled app rejected with HTTP 403, restored upon re-enabling');
    passed++;

    console.log('\n===============================================================');
    console.log(`🎉 ALL ${passed} / ${total} EXTERNAL SAAS INTEGRATION CHECKS PASSED`);
    console.log('===============================================================\n');

  } finally {
    stopWebhookServer();
  }
}

runExternalSaasIntegrationTest().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('\n✖ Phase 12 Integration Test Failed:', err);
  stopWebhookServer();
  process.exit(1);
});
