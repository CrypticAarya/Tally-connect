/**
 * Phase 11 Step 2: Critical Security Hardening & Multi-Tenant Isolation Tests
 * 
 * Verifies all 16 security test requirements using real MySQL records,
 * genuine Bearer agent tokens, authenticated developer tokens, and strict
 * tenant isolation checks.
 */

import assert from 'assert';
import { pool } from '../../server/src/db/mysql.js';
import { SaasRepository } from '../../server/src/db/saasRepository.js';
import crypto from 'crypto';

const BASE_URL = 'http://127.0.0.1:5001';

async function runSecurityHardeningTests() {
  console.log('\n================================================================');
  console.log('🔒 PHASE 11 STEP 2: CRITICAL SECURITY HARDENING & TENANT ISOLATION');
  console.log('================================================================\n');

  let passed = 0;
  let total = 16;

  // --------------------------------------------------------------------------
  // Setup: Create two distinct Developers (A & B) with real accounts
  // --------------------------------------------------------------------------
  console.log('▶ Setup: Provisioning Developer A & Developer B accounts...');
  const devAEmail = `deva_${Date.now()}@example.com`;
  const devBEmail = `devb_${Date.now()}@example.com`;

  // Register Developer A
  const regAResp = await fetch(`${BASE_URL}/api/developer/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Developer A', email: devAEmail, password: 'Password123!', company_name: 'Corp A' })
  });
  assert.strictEqual(regAResp.status, 201, 'Developer A registration failed');
  const regAData = await regAResp.json();
  const devTokenA = regAData.token;
  assert.ok(devTokenA, 'Developer A must receive token');

  // Register Developer B
  const regBResp = await fetch(`${BASE_URL}/api/developer/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Developer B', email: devBEmail, password: 'Password123!', company_name: 'Corp B' })
  });
  assert.strictEqual(regBResp.status, 201, 'Developer B registration failed');
  const regBData = await regBResp.json();
  const devTokenB = regBData.token;
  assert.ok(devTokenB, 'Developer B must receive token');

  // Developer A creates App A
  const appAResp = await fetch(`${BASE_URL}/api/developer/apps`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${devTokenA}`
    },
    body: JSON.stringify({ app_name: 'Enterprise ERP A', webhook_url: 'https://erpa.example.com/webhook' })
  });
  assert.strictEqual(appAResp.status, 201);
  const appAData = await appAResp.json();
  const appIdA = appAData.app.id;
  const apiKeyA = appAData.app.api_key;

  // Developer B creates App B
  const appBResp = await fetch(`${BASE_URL}/api/developer/apps`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${devTokenB}`
    },
    body: JSON.stringify({ app_name: 'Billing Suite B', webhook_url: 'https://suiteb.example.com/webhook' })
  });
  assert.strictEqual(appBResp.status, 201);
  const appBData = await appBResp.json();
  const appIdB = appBData.app.id;
  const apiKeyB = appBData.app.api_key;

  console.log(`  ✔ Developer A registered (App ID: ${appIdA})`);
  console.log(`  ✔ Developer B registered (App ID: ${appIdB})\n`);

  // --------------------------------------------------------------------------
  // TEST 1: Unauthenticated API key retrieval -> 401
  // --------------------------------------------------------------------------
  console.log('▶ TEST 1: Unauthenticated API key retrieval...');
  const t1Resp = await fetch(`${BASE_URL}/api/developer/apps/${appIdA}/api-key`);
  assert.strictEqual(t1Resp.status, 401, 'Unauthenticated request must return 401');
  const t1Data = await t1Resp.json();
  assert.strictEqual(t1Data.error?.code, 'UNAUTHORIZED', 'Error code must be UNAUTHORIZED');
  console.log('  ✔ Received HTTP 401 UNAUTHORIZED as expected');
  passed++;

  // --------------------------------------------------------------------------
  // TEST 2: Developer A attempts to retrieve Developer B's app key -> 403
  // --------------------------------------------------------------------------
  console.log('\n▶ TEST 2: Developer A attempts to retrieve Developer B\'s app key...');
  const t2Resp = await fetch(`${BASE_URL}/api/developer/apps/${appIdB}/api-key`, {
    headers: { 'Authorization': `Bearer ${devTokenA}` }
  });
  assert.strictEqual(t2Resp.status, 403, 'Cross-developer access must return 403');
  const t2Data = await t2Resp.json();
  assert.strictEqual(t2Data.error?.code, 'APP_ACCESS_DENIED', 'Error code must be APP_ACCESS_DENIED');
  console.log('  ✔ Received HTTP 403 APP_ACCESS_DENIED as expected');
  passed++;

  // --------------------------------------------------------------------------
  // TEST 3: Developer A attempts to regenerate Developer B's key -> 403
  // --------------------------------------------------------------------------
  console.log('\n▶ TEST 3: Developer A attempts to regenerate Developer B\'s key...');
  const t3Resp = await fetch(`${BASE_URL}/api/developer/apps/${appIdB}/regenerate-key`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${devTokenA}` }
  });
  assert.strictEqual(t3Resp.status, 403, 'Cross-developer key regeneration must return 403');
  const t3Data = await t3Resp.json();
  assert.strictEqual(t3Data.error?.code, 'APP_ACCESS_DENIED');
  console.log('  ✔ Received HTTP 403 APP_ACCESS_DENIED as expected');
  passed++;

  // --------------------------------------------------------------------------
  // TEST 4: Developer A attempts to disable Developer B's app -> 403
  // --------------------------------------------------------------------------
  console.log('\n▶ TEST 4: Developer A attempts to disable Developer B\'s app...');
  const t4Resp = await fetch(`${BASE_URL}/api/developer/apps/${appIdB}/disable`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${devTokenA}` }
  });
  assert.strictEqual(t4Resp.status, 403, 'Cross-developer app disable must return 403');
  const t4Data = await t4Resp.json();
  assert.strictEqual(t4Data.error?.code, 'APP_ACCESS_DENIED');
  console.log('  ✔ Received HTTP 403 APP_ACCESS_DENIED as expected');
  passed++;

  // --------------------------------------------------------------------------
  // Setup Connections & Agents for multi-tenant and agent tests
  // --------------------------------------------------------------------------
  console.log('\n▶ Provisioning customer connections and desktop agents...');
  
  // Create Connection A1 and Connection A2 for SaaS App A
  const connA1 = await SaasRepository.createConnection({
    saasAppId: appIdA,
    externalUserId: 'cust_A_101',
    companyName: 'Acme Traders (Customer 1)',
    status: 'ACTIVE'
  });
  const connA2 = await SaasRepository.createConnection({
    saasAppId: appIdA,
    externalUserId: 'cust_A_102',
    companyName: 'Apex Logistics (Customer 2)',
    status: 'ACTIVE'
  });

  // Create Connection B1 for SaaS App B
  const connB1 = await SaasRepository.createConnection({
    saasAppId: appIdB,
    externalUserId: 'cust_B_201',
    companyName: 'BlueSky Hardware (Customer B1)',
    status: 'ACTIVE'
  });

  // Provision Agent A for Connection A1
  const agentA = await SaasRepository.activateAgentForConnection({
    connectionId: connA1.id,
    machineName: 'WIN-CLIENT-APP-A',
    activeCompany: 'Acme Traders (Customer 1)'
  });
  const agentTokenA = agentA.agent_token;

  // Provision Agent B for Connection B1
  const agentB = await SaasRepository.activateAgentForConnection({
    connectionId: connB1.id,
    machineName: 'WIN-CLIENT-APP-B',
    activeCompany: 'BlueSky Hardware (Customer B1)'
  });
  const agentTokenB = agentB.agent_token;

  console.log(`  ✔ Connection A1 (${connA1.id}) and A2 (${connA2.id}) created for App A`);
  console.log(`  ✔ Connection B1 (${connB1.id}) created for App B`);
  console.log(`  ✔ Agent A linked to Connection A1 (token: ${agentTokenA.slice(0, 15)}...)`);
  console.log(`  ✔ Agent B linked to Connection B1 (token: ${agentTokenB.slice(0, 15)}...)`);

  // --------------------------------------------------------------------------
  // TEST 5: SaaS requests /api/v1/customers without x-connection-id -> 400
  // --------------------------------------------------------------------------
  console.log('\n▶ TEST 5: SaaS requests /api/v1/customers without x-connection-id (multiple connections exist)...');
  const t5Resp = await fetch(`${BASE_URL}/api/v1/customers`, {
    headers: { 'x-api-key': apiKeyA }
  });
  assert.strictEqual(t5Resp.status, 400, 'Omitting x-connection-id with multiple connections must return 400');
  const t5Data = await t5Resp.json();
  assert.strictEqual(t5Data.error?.code, 'CONNECTION_ID_REQUIRED', 'Error code must be CONNECTION_ID_REQUIRED');
  console.log('  ✔ Received HTTP 400 CONNECTION_ID_REQUIRED as expected');
  passed++;

  // --------------------------------------------------------------------------
  // TEST 6: SaaS requests Customer A using Connection B -> 403
  // --------------------------------------------------------------------------
  console.log('\n▶ TEST 6: SaaS App A attempts to access Connection B1 data...');
  const t6Resp = await fetch(`${BASE_URL}/api/v1/customers`, {
    headers: {
      'x-api-key': apiKeyA,
      'x-connection-id': connB1.id
    }
  });
  assert.strictEqual(t6Resp.status, 403, 'Cross-tenant data access must return 403');
  const t6Data = await t6Resp.json();
  assert.strictEqual(t6Data.error?.code, 'CONNECTION_ACCESS_DENIED', 'Error code must be CONNECTION_ACCESS_DENIED');
  console.log('  ✔ Received HTTP 403 CONNECTION_ACCESS_DENIED as expected');
  passed++;

  // --------------------------------------------------------------------------
  // TEST 7: Agent A uploads data for Connection B -> 403
  // --------------------------------------------------------------------------
  console.log('\n▶ TEST 7: Agent A attempts to upload data into Connection B1...');
  const t7Resp = await fetch(`${BASE_URL}/api/agent/sync/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${agentTokenA}`
    },
    body: JSON.stringify({
      connection_id: connB1.id,
      entity_type: 'customers',
      data: [{ id: 'fake_cust_1', name: 'Malicious Injected Customer' }]
    })
  });
  assert.strictEqual(t7Resp.status, 403, 'Agent cross-connection upload must return 403');
  const t7Data = await t7Resp.json();
  assert.strictEqual(t7Data.error?.code, 'CONNECTION_MISMATCH', 'Error code must be CONNECTION_MISMATCH');
  console.log('  ✔ Received HTTP 403 CONNECTION_MISMATCH as expected');
  passed++;

  // --------------------------------------------------------------------------
  // TEST 8: Agent A requests / uploads sync jobs belonging to Connection B -> 403
  // --------------------------------------------------------------------------
  console.log('\n▶ TEST 8: Agent A attempts to execute/upload sync job belonging to Connection B1...');
  // Create a sync job for Connection B
  const jobB = await SaasRepository.createSyncJob({
    connectionId: connB1.id,
    entityType: 'sales',
    status: 'QUEUED'
  });
  
  const t8Resp = await fetch(`${BASE_URL}/api/agent/sync/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${agentTokenA}`
    },
    body: JSON.stringify({
      job_id: jobB.id,
      entity_type: 'sales',
      data: [{ id: 'fake_sale_1', total: 50000 }]
    })
  });
  assert.strictEqual(t8Resp.status, 403, 'Agent operating on another connection\'s job must return 403');
  const t8Data = await t8Resp.json();
  assert.strictEqual(t8Data.error?.code, 'JOB_CONNECTION_MISMATCH', 'Error code must be JOB_CONNECTION_MISMATCH');
  console.log('  ✔ Received HTTP 403 JOB_CONNECTION_MISMATCH as expected');
  passed++;

  // --------------------------------------------------------------------------
  // TEST 9: Unknown agent token attempts sync upload -> 401
  // --------------------------------------------------------------------------
  console.log('\n▶ TEST 9: Unknown agent token attempts sync upload...');
  const t9Resp = await fetch(`${BASE_URL}/api/agent/sync/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer tc_ag_nonexistent_token_9999999999999'
    },
    body: JSON.stringify({
      entity_type: 'customers',
      data: []
    })
  });
  assert.strictEqual(t9Resp.status, 401, 'Unknown agent token must return 401');
  const t9Data = await t9Resp.json();
  assert.strictEqual(t9Data.error?.code, 'AGENT_AUTH_FAILED', 'Error code must be AGENT_AUTH_FAILED');
  console.log('  ✔ Received HTTP 401 AGENT_AUTH_FAILED as expected');
  passed++;

  // --------------------------------------------------------------------------
  // TEST 10: Random user attempts to change connection permissions -> 401
  // --------------------------------------------------------------------------
  console.log('\n▶ TEST 10: Unauthenticated user attempts to change connection permissions...');
  const t10Resp = await fetch(`${BASE_URL}/api/connect/${connA1.id}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissions: { customers: false, sales: false } })
  });
  assert.strictEqual(t10Resp.status, 401, 'Missing API key must return 401');
  const t10Data = await t10Resp.json();
  assert.strictEqual(t10Data.error?.code, 'UNAUTHORIZED');
  console.log('  ✔ Received HTTP 401 UNAUTHORIZED as expected');
  passed++;

  // --------------------------------------------------------------------------
  // TEST 11: SaaS A attempts to change SaaS B connection permissions -> 403
  // --------------------------------------------------------------------------
  console.log('\n▶ TEST 11: SaaS App A attempts to change SaaS App B connection permissions...');
  const t11Resp = await fetch(`${BASE_URL}/api/connect/${connB1.id}/permissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKeyA
    },
    body: JSON.stringify({ permissions: { customers: true, sales: true } })
  });
  assert.strictEqual(t11Resp.status, 403, 'Cross-tenant permission update must return 403');
  const t11Data = await t11Resp.json();
  assert.strictEqual(t11Data.error?.code, 'CONNECTION_ACCESS_DENIED');
  console.log('  ✔ Received HTTP 403 CONNECTION_ACCESS_DENIED as expected');
  passed++;

  // --------------------------------------------------------------------------
  // TEST 12: SaaS A attempts to trigger sync for SaaS B connection -> 403
  // --------------------------------------------------------------------------
  console.log('\n▶ TEST 12: SaaS App A attempts to trigger sync for SaaS App B connection...');
  const t12Resp = await fetch(`${BASE_URL}/api/connect/${connB1.id}/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKeyA
    }
  });
  assert.strictEqual(t12Resp.status, 403, 'Cross-tenant sync trigger must return 403');
  const t12Data = await t12Resp.json();
  assert.strictEqual(t12Data.error?.code, 'CONNECTION_ACCESS_DENIED');
  console.log('  ✔ Received HTTP 403 CONNECTION_ACCESS_DENIED as expected');
  passed++;

  // --------------------------------------------------------------------------
  // TEST 13: Request containing x-bypass-ratelimit: true must NOT bypass rate limiting
  // --------------------------------------------------------------------------
  console.log('\n▶ TEST 13: Request containing x-bypass-ratelimit: true must NOT bypass rate limiting...');
  // The rate limiter sets X-RateLimit-Limit, X-RateLimit-Remaining and counts requests
  const testKey = `ratelimit_probe_${Date.now()}`;
  const r1 = await fetch(`${BASE_URL}/api/connect/${connA1.id}/status`, {
    headers: {
      'x-api-key': testKey,
      'x-bypass-ratelimit': 'true'
    }
  });
  const rem1 = parseInt(r1.headers.get('x-ratelimit-remaining'), 10);
  assert.ok(!isNaN(rem1), 'X-RateLimit-Remaining must be present');

  const r2 = await fetch(`${BASE_URL}/api/connect/${connA1.id}/status`, {
    headers: {
      'x-api-key': testKey,
      'x-bypass-ratelimit': 'true'
    }
  });
  const rem2 = parseInt(r2.headers.get('x-ratelimit-remaining'), 10);
  assert.strictEqual(rem2, rem1 - 1, 'Rate limit counter must decrement even with x-bypass-ratelimit: true');
  console.log(`  ✔ Rate limit decremented (${rem1} -> ${rem2}) despite header "x-bypass-ratelimit: true"`);
  console.log('  ✔ Rate limiter bypass header successfully neutralized');
  passed++;

  // --------------------------------------------------------------------------
  // TEST 14: Valid Agent A continues to work normally
  // --------------------------------------------------------------------------
  console.log('\n▶ TEST 14: Valid Agent A operations (heartbeat, sync/start, sync/upload)...');
  
  // 14a. Heartbeat
  const hbResp = await fetch(`${BASE_URL}/api/agent/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${agentTokenA}`
    },
    body: JSON.stringify({
      agentId: agentA.id,
      connectionId: connA1.id,
      machineName: 'WIN-CLIENT-APP-A',
      tallyStatus: 'ONLINE',
      activeCompany: 'Acme Traders (Customer 1)',
      agentVersion: '1.0.0-beta'
    })
  });
  assert.strictEqual(hbResp.status, 200, 'Valid heartbeat must return 200');
  const hbData = await hbResp.json();
  assert.strictEqual(hbData.success, true);
  console.log('  ✔ Agent A heartbeat succeeded (200 OK)');

  // 14b. Sync Start
  const startResp = await fetch(`${BASE_URL}/api/agent/sync/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${agentTokenA}`
    },
    body: JSON.stringify({
      entity_type: 'customers'
    })
  });
  assert.strictEqual(startResp.status, 200, 'Valid sync/start must return 200');
  const startData = await startResp.json();
  assert.strictEqual(startData.success, true);
  assert.ok(Array.isArray(startData.jobs) && startData.jobs.length > 0, 'jobs must be an array');
  const jobIdA = startData.jobs[0].id;
  assert.strictEqual(startData.jobs[0].connection_id, connA1.id);
  console.log(`  ✔ Agent A sync/start created authorized job: ${jobIdA}`);

  // 14c. Sync Upload
  const uploadResp = await fetch(`${BASE_URL}/api/agent/sync/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${agentTokenA}`
    },
    body: JSON.stringify({
      job_id: jobIdA,
      entity_type: 'customers',
      data: [
        {
          guid: 'cust_ph11_001',
          name: 'Acme Mega Corp',
          gstin: '27AABCA1234F1Z5',
          address: '42 Nariman Point, Mumbai'
        },
        {
          guid: 'cust_ph11_002',
          name: 'Apex Wholesale Hub',
          gstin: '27AABCA5678G1Z6',
          address: '88 MIDC Andheri, Mumbai'
        }
      ]
    })
  });
  assert.strictEqual(uploadResp.status, 200, 'Valid sync/upload must return 200');
  const uploadData = await uploadResp.json();
  assert.strictEqual(uploadData.success, true);
  console.log('  ✔ Agent A upload succeeded (200 OK, records stored in database cache)');
  passed++;

  // --------------------------------------------------------------------------
  // TEST 15: Valid SaaS application continues to retrieve its own customer's data
  // --------------------------------------------------------------------------
  console.log('\n▶ TEST 15: Valid SaaS App A retrieves its customer\'s data...');
  const t15Resp = await fetch(`${BASE_URL}/api/v1/customers`, {
    headers: {
      'x-api-key': apiKeyA,
      'x-connection-id': connA1.id
    }
  });
  assert.strictEqual(t15Resp.status, 200, 'Valid customer data retrieval must return 200');
  const t15Data = await t15Resp.json();
  assert.strictEqual(t15Data.success, true);
  assert.ok(Array.isArray(t15Data.data), 'Data must be array');
  assert.strictEqual(t15Data.data.length, 2, 'Must return the 2 customers uploaded by Agent A');
  assert.strictEqual(t15Data.data[0].name, 'Acme Mega Corp');
  assert.strictEqual(t15Data.data[1].name, 'Apex Wholesale Hub');
  console.log(`  ✔ SaaS App A successfully retrieved ${t15Data.data.length} customer records for Connection A1`);
  passed++;

  // --------------------------------------------------------------------------
  // TEST 16: Existing real Tally sync flow continues to work
  // --------------------------------------------------------------------------
  console.log('\n▶ TEST 16: Full real Tally sync flow verification across sales and inventory...');
  
  // Enable inventory permission for Connection A1
  const permResp = await fetch(`${BASE_URL}/api/connect/${connA1.id}/permissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKeyA
    },
    body: JSON.stringify({
      permissions: {
        customers: true,
        sales: true,
        inventory: true
      }
    })
  });
  assert.strictEqual(permResp.status, 200);

  // Agent A uploads sales dataset
  const salesUploadResp = await fetch(`${BASE_URL}/api/agent/sync/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${agentTokenA}`
    },
    body: JSON.stringify({
      entity_type: 'sales',
      data: [
        {
          guid: 'sale_ph11_001',
          voucherNumber: 'INV/2026/088',
          date: '2026-03-31',
          partyName: 'Acme Mega Corp',
          customer: 'Acme Mega Corp',
          partyLedgerName: 'Acme Mega Corp',
          grossAmount: 125000,
          totalAmount: 125000,
          inventoryEntries: [
            { stockItemName: 'Industrial Switch 24-Port', billedQty: 10, rate: 12500, amount: 125000 }
          ]
        }
      ]
    })
  });
  assert.strictEqual(salesUploadResp.status, 200);

  // Agent A uploads inventory dataset
  const invUploadResp = await fetch(`${BASE_URL}/api/agent/sync/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${agentTokenA}`
    },
    body: JSON.stringify({
      entity_type: 'inventory',
      data: [
        {
          guid: 'item_ph11_001',
          name: 'Industrial Switch 24-Port',
          partNo: 'SW-24P-IND',
          closingBalance: 45,
          baseUnits: 'Pcs'
        }
      ]
    })
  });
  assert.strictEqual(invUploadResp.status, 200);

  // SaaS App A queries sales
  const salesGetResp = await fetch(`${BASE_URL}/api/v1/sales`, {
    headers: {
      'x-api-key': apiKeyA,
      'x-connection-id': connA1.id
    }
  });
  assert.strictEqual(salesGetResp.status, 200);
  const salesGetData = await salesGetResp.json();
  assert.strictEqual(salesGetData.success, true);
  assert.strictEqual(salesGetData.data.length, 1);
  assert.strictEqual(salesGetData.data[0].customer, 'Acme Mega Corp');

  // SaaS App A queries inventory
  const invGetResp = await fetch(`${BASE_URL}/api/v1/inventory`, {
    headers: {
      'x-api-key': apiKeyA,
      'x-connection-id': connA1.id
    }
  });
  assert.strictEqual(invGetResp.status, 200);
  const invGetData = await invGetResp.json();
  assert.strictEqual(invGetData.success, true);
  assert.strictEqual(invGetData.data.length, 1);
  assert.strictEqual(invGetData.data[0].name, 'Industrial Switch 24-Port');

  console.log('  ✔ Agent upload -> database cache -> SaaS API query completed for sales and inventory');
  console.log('  ✔ Data integrity and tenant isolation verified end-to-end');
  passed++;

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed} / ${total} SECURITY HARDENING TESTS PASSED!`);
  console.log('================================================================\n');
  
  await pool.end();
  process.exit(0);
}

runSecurityHardeningTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
