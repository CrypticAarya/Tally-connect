import assert from 'assert';
import { connectTally, TallyConnect } from './sdk/tallyConnect.js';
import { CUSTOMER_ERRORS } from './server/src/errors/customerErrors.js';

const BASE_URL = process.env.CLOUD_URL || 'http://127.0.0.1:5001';

async function runTest() {
  console.log('===============================================================');
  console.log('🧪 PHASE 7: PRODUCTION CUSTOMER CONNECTION EXPERIENCE TEST');
  console.log('===============================================================\n');

  // Pre-Check: Server Health
  console.log('======================================================');
  console.log('▶ Pre-Check: Verify Cloud Server is Online');
  console.log('======================================================');
  const healthResp = await fetch(`${BASE_URL}/api/health`);
  assert.strictEqual(healthResp.status, 200, 'Server should be online');
  console.log('  ✔ Cloud server is online and responding\n');

  // Setup: Register SaaS App for Customer Connection Testing
  console.log('======================================================');
  console.log('▶ Setup: Register SaaS Application');
  console.log('======================================================');
  const appResp = await fetch(`${BASE_URL}/api/developer/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_name: 'OmniLedger Cloud ERP',
      webhook_url: 'http://127.0.0.1:5096/webhook'
    })
  });
  assert.strictEqual(appResp.status, 201);
  const appData = await appResp.json();
  const appId = appData.app.id;
  const apiKey = appData.app.api_key;
  console.log(`  ✔ SaaS App registered: "${appData.app.app_name}" (ID: ${appId})\n`);

  // 1 & 2. SaaS creates connection session & activation code generated
  console.log('======================================================');
  console.log('▶ 1 & 2. Verification: Connection Session & Activation Code');
  console.log('======================================================');
  
  // Test direct HTTP POST /api/connect/session
  const sessionResp = await fetch(`${BASE_URL}/api/connect/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: appId,
      external_user_id: 'cust_retail_1001',
      callback_url: 'https://omniledger.io/app/settings/tally/success'
    })
  });

  assert.strictEqual(sessionResp.status, 201, 'Session creation should return 201');
  const sessionData = await sessionResp.json();
  assert.strictEqual(sessionData.success, true);
  assert.ok(sessionData.session_id, 'Response must include session_id');
  assert.ok(sessionData.activation_code, 'Response must include activation_code');
  assert.ok(sessionData.expires_at, 'Response must include expires_at');

  const connectionId = sessionData.session_id;
  const activationCode = sessionData.activation_code;

  assert.match(activationCode, /^TC-\d{4}$/, 'Activation code must be 6-character TC-XXXX');
  console.log(`  ✔ Connection session created: Session ID = ${connectionId}`);
  console.log(`  ✔ 6-character activation code generated: "${activationCode}"`);
  console.log(`  ✔ Session expiry timestamp: ${sessionData.expires_at}`);

  // Test SDK helper connectTally({ appId, userId })
  const sdkSession = await connectTally({
    appId,
    userId: 'cust_retail_1002',
    baseUrl: BASE_URL
  });
  assert.ok(sdkSession.activationCode, 'SDK connectTally must return activationCode');
  assert.match(sdkSession.activationCode, /^TC-\d{4}$/, 'SDK activation code format valid');
  console.log(`  ✔ SDK connectTally({ appId, userId }) generated code: "${sdkSession.activationCode}"`);

  console.log('✓ SaaS creates connection session');
  console.log('✓ Activation code generated\n');

  // 3. Customer agent connects
  console.log('======================================================');
  console.log('▶ 3. Verification: Customer Agent Connects & Heartbeat');
  console.log('======================================================');
  const activateResp = await fetch(`${BASE_URL}/api/agent/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      activation_code: activationCode,
      machine_name: 'STORE-POS-WIN11'
    })
  });

  assert.strictEqual(activateResp.status, 200, 'Agent activation must return 200');
  const activateData = await activateResp.json();
  assert.strictEqual(activateData.success, true);
  const agentToken = activateData.agent_token;
  const agentId = activateData.agent_id;
  console.log(`  ✔ Customer desktop agent activated: Agent ID = ${agentId}`);

  // Send agent telemetry heartbeat with online Tally
  const heartbeatResp = await fetch(`${BASE_URL}/api/agent/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${agentToken}`
    },
    body: JSON.stringify({
      agentId,
      connectionId,
      machineName: 'STORE-POS-WIN11',
      tallyStatus: 'ONLINE',
      activeCompany: 'Sunrise Supermarkets Pvt Ltd',
      tallyVersion: 'TallyPrime 4.1'
    })
  });
  assert.strictEqual(heartbeatResp.status, 200);
  console.log('  ✔ Agent heartbeat sent: Tally ONLINE | Company: "Sunrise Supermarkets Pvt Ltd"');
  console.log('✓ Customer agent connects\n');

  // 4. Status API works
  console.log('======================================================');
  console.log('▶ 4. Verification: Connection Status API');
  console.log('======================================================');
  const statusResp = await fetch(`${BASE_URL}/api/connect/${connectionId}/status`);
  assert.strictEqual(statusResp.status, 200, 'Status API must return 200');
  const statusData = await statusResp.json();

  assert.strictEqual(statusData.success, true);
  assert.strictEqual(statusData.status, 'ACTIVE', 'Connection status must be ACTIVE');
  assert.strictEqual(statusData.company_name, 'Sunrise Supermarkets Pvt Ltd');
  assert.strictEqual(statusData.agent_status, 'ONLINE');
  assert.strictEqual(statusData.tally_status, 'ONLINE');
  assert.strictEqual(typeof statusData.permissions, 'object');
  assert.strictEqual(statusData.permissions.customers, true);
  assert.strictEqual(statusData.permissions.sales, true);

  console.log('  ✔ GET /api/connect/:connectionId/status response verified:');
  console.log(`    - Status: ${statusData.status}`);
  console.log(`    - Company Name: "${statusData.company_name}"`);
  console.log(`    - Agent Status: ${statusData.agent_status}`);
  console.log(`    - Tally Status: ${statusData.tally_status}`);
  console.log(`    - Permissions: ${JSON.stringify(statusData.permissions)}`);

  // Also test SDK getStatus method
  const client = new TallyConnect({ baseUrl: BASE_URL, apiKey });
  const sdkStatus = await client.getStatus(connectionId);
  assert.strictEqual(sdkStatus.status, 'ACTIVE');
  console.log('  ✔ SDK client.getStatus(connectionId) succeeded');
  console.log('✓ Status API works\n');

  // 5. Sync Now works
  console.log('======================================================');
  console.log('▶ 5. Verification: Sync Now API');
  console.log('======================================================');
  const syncResp = await fetch(`${BASE_URL}/api/connect/${connectionId}/sync`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey
    }
  });

  assert.strictEqual(syncResp.status, 200, 'Trigger sync must return 200');
  const syncData = await syncResp.json();
  assert.strictEqual(syncData.success, true);
  assert.strictEqual(syncData.message, 'Immediate sync triggered');
  assert.ok(Array.isArray(syncData.jobs), 'Must return created jobs');
  assert.ok(syncData.jobs.length >= 2, 'Should create jobs for permitted entities (customers, sales, etc.)');

  console.log(`  ✔ POST /api/connect/:connectionId/sync triggered: ${syncData.jobs.length} jobs created`);
  console.log(`  ✔ Permitted entities queued for immediate sync: ${syncData.entities.join(', ')}`);

  // Simulate agent uploading customer & sales datasets
  const uploadResp = await fetch(`${BASE_URL}/api/agent/sync/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${agentToken}`
    },
    body: JSON.stringify({
      connection_id: connectionId,
      entity_type: 'customers',
      data: [
        {
          guid: 'cust-ph7-001',
          name: 'Greenfield Retail Pvt Ltd',
          gstin: '27AABCG1234D1Z8',
          address: 'Shop 14, High Street Mall, Pune, 411001'
        },
        {
          guid: 'cust-ph7-002',
          name: 'Silverline Traders',
          gstin: '27AABCS5678E1Z9',
          address: 'Plot 44, Market Yard, Pune, 411037'
        }
      ]
    })
  });
  assert.strictEqual(uploadResp.status, 200);

  const uploadSalesResp = await fetch(`${BASE_URL}/api/agent/sync/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${agentToken}`
    },
    body: JSON.stringify({
      connection_id: connectionId,
      entity_type: 'sales',
      data: [
        {
          guid: 'inv-ph7-001',
          voucherNumber: 'INV/2026/099',
          partyName: 'Greenfield Retail Pvt Ltd',
          grossAmount: 85000,
          totalAmount: 85000,
          inventoryEntries: [
            { stockItemName: 'Basmati Rice 25kg Bag', billedQty: 50, rate: 1700, amount: 85000 }
          ]
        }
      ]
    })
  });
  assert.strictEqual(uploadSalesResp.status, 200);
  console.log('  ✔ Agent uploaded synchronized records for customers (2) and sales (1)');
  console.log('✓ Sync Now works\n');

  // 6. Sync history returned
  console.log('======================================================');
  console.log('▶ 6. Verification: Sync History API');
  console.log('======================================================');
  const historyResp = await fetch(`${BASE_URL}/api/connect/${connectionId}/sync-history`);
  assert.strictEqual(historyResp.status, 200, 'Sync history must return 200');
  const historyData = await historyResp.json();

  assert.strictEqual(historyData.success, true);
  assert.ok(historyData.last_sync, 'Must have last_sync timestamp');
  assert.strictEqual(historyData.status, 'ACTIVE');
  assert.ok(historyData.records_synced >= 3, `Records synced should be at least 3, got: ${historyData.records_synced}`);
  assert.ok(Array.isArray(historyData.errors), 'errors should be an array');
  assert.ok(Array.isArray(historyData.history), 'history should be an array');

  console.log('  ✔ GET /api/connect/:connectionId/sync-history response:');
  console.log(`    - Last Sync: ${historyData.last_sync}`);
  console.log(`    - Status: ${historyData.status}`);
  console.log(`    - Records Synced: ${historyData.records_synced}`);
  console.log(`    - Error Count: ${historyData.errors.length}`);
  console.log(`    - Historical Jobs Logged: ${historyData.history.length}`);

  // Test SDK client.getSyncHistory
  const sdkHistory = await client.getSyncHistory(connectionId);
  assert.strictEqual(sdkHistory.success, true);
  console.log('  ✔ SDK client.getSyncHistory(connectionId) succeeded');
  console.log('✓ Sync history returned\n');

  // 7. Friendly errors returned
  console.log('======================================================');
  console.log('▶ 7. Verification: Customer Friendly Error Layer');
  console.log('======================================================');

  // Verify errors catalog endpoint
  const errorsResp = await fetch(`${BASE_URL}/api/connect/errors`);
  assert.strictEqual(errorsResp.status, 200);
  const catalog = (await errorsResp.json()).errors;

  const requiredCodes = [
    'TALLY_NOT_RUNNING',
    'AGENT_OFFLINE',
    'INVALID_PERMISSION',
    'SYNC_FAILED',
    'NETWORK_ERROR'
  ];

  for (const code of requiredCodes) {
    const errObj = catalog[code];
    assert.ok(errObj, `Catalog must contain error definition for: ${code}`);
    assert.strictEqual(errObj.code, code);
    assert.ok(errObj.message, `Error ${code} must have a message`);
    assert.ok(errObj.solution, `Error ${code} must have an actionable solution`);
    console.log(`  ✔ Standardized error verified [${code}]:`);
    console.log(`    Message:  "${errObj.message}"`);
    console.log(`    Solution: "${errObj.solution}"`);
  }

  // Verify single error lookup endpoint
  const singleErrResp = await fetch(`${BASE_URL}/api/connect/errors/TALLY_NOT_RUNNING`);
  assert.strictEqual(singleErrResp.status, 200);
  const singleErr = (await singleErrResp.json()).error;
  assert.strictEqual(singleErr.code, 'TALLY_NOT_RUNNING');

  // Test friendly error on invalid/offline sync
  const fakeConnId = 'conn_offline_simulated';
  const offlineSyncResp = await fetch(`${BASE_URL}/api/connect/${fakeConnId}/sync`, { method: 'POST' });
  const offlineBody = await offlineSyncResp.json();
  assert.ok(offlineBody.error?.code, 'Must return error code');
  assert.ok(offlineBody.error?.solution, 'Must return actionable solution');
  console.log(`  ✔ Offline sync attempt returned friendly error: [${offlineBody.error.code}] ${offlineBody.error.solution}`);

  // Test friendly error when Tally reports OFFLINE in status
  const pendingConnResp = await fetch(`${BASE_URL}/api/connect/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, external_user_id: 'user_tally_offline' })
  });
  const pendingSession = await pendingConnResp.json();
  const actOffline = await fetch(`${BASE_URL}/api/agent/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activation_code: pendingSession.activation_code, machine_name: 'OFFLINE-PC' })
  });
  const offlineToken = (await actOffline.json()).agent_token;

  // Send heartbeat reporting Tally OFFLINE
  await fetch(`${BASE_URL}/api/agent/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${offlineToken}` },
    body: JSON.stringify({
      connectionId: pendingSession.session_id,
      machineName: 'OFFLINE-PC',
      tallyStatus: 'OFFLINE',
      activeCompany: null
    })
  });

  const offlineStatusResp = await fetch(`${BASE_URL}/api/connect/${pendingSession.session_id}/status`);
  const offlineStatusData = await offlineStatusResp.json();
  assert.strictEqual(offlineStatusData.tally_status, 'OFFLINE');
  assert.ok(offlineStatusData.error, 'Status should attach customer friendly error when Tally is offline');
  assert.strictEqual(offlineStatusData.error.code, 'TALLY_NOT_RUNNING');
  assert.ok(offlineStatusData.error.solution.includes('port 9000'));
  console.log(`  ✔ Status API attached friendly error when Tally is offline: [${offlineStatusData.error.code}] "${offlineStatusData.error.solution}"`);

  console.log('✓ Friendly errors returned\n');

  console.log('===============================================================');
  console.log('🎉 ALL PHASE 7 VALIDATION CHECKS PASSED:');
  console.log('  ✓ SaaS creates connection session');
  console.log('  ✓ Activation code generated');
  console.log('  ✓ Customer agent connects');
  console.log('  ✓ Status API works');
  console.log('  ✓ Sync Now works');
  console.log('  ✓ Sync history returned');
  console.log('  ✓ Friendly errors returned');
  console.log('===============================================================\n');
}

runTest().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('\n✖ Phase 7 Test Failed:', err);
  process.exit(1);
});
