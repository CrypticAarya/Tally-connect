import { initMySqlDb, pool } from '../server/src/db/mysql.js';
import { SaasRepository } from '../server/src/db/saasRepository.js';
import { startServer } from '../server/src/index.js';

async function runPhase2Validation() {
  console.log('================================================================');
  console.log('🚀 PHASE 2: MYSQL DATABASE & SAAS APPLICATION MANAGEMENT TEST');
  console.log('Testing: MySQL Schema | App Registration | Key Regeneration | Auth Middleware | Connections');
  console.log('================================================================\n');

  let passed = 0;
  const total = 5;
  let server = null;
  const testPort = 5098;

  try {
    // -------------------------------------------------------------
    // Test 1: MySQL Schema & Table Verification
    // -------------------------------------------------------------
    console.log('▶ TEST 1: Verifying MySQL Schema & Required Tables...');
    await initMySqlDb();

    const [tableRows] = await pool.query('SHOW TABLES');
    const tableNames = tableRows.map(r => Object.values(r)[0]);
    const expectedTables = ['saas_apps', 'connections', 'agents', 'permissions', 'sync_jobs', 'entity_cache'];

    for (const t of expectedTables) {
      if (!tableNames.includes(t)) {
        throw new Error(`Required MySQL table "${t}" is missing.`);
      }
    }

    console.log('  ✔ All 6 expected MySQL tables verified:');
    console.log(`    [${expectedTables.join(', ')}]`);
    passed++;

    // Start server for API endpoint testing
    server = await startServer(testPort);

    // -------------------------------------------------------------
    // Test 2: Create SaaS Application via API
    // -------------------------------------------------------------
    console.log('\n▶ TEST 2: Testing POST /api/internal/apps (Create SaaS Application)...');
    const createRes = await fetch(`http://localhost:${testPort}/api/internal/apps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Acme Cloud Invoicing Platform',
        redirect_url: 'https://acme-invoicing.io/tally/oauth/callback'
      })
    });

    const createData = await createRes.json();
    if (!createRes.ok || !createData.success || !createData.app) {
      throw new Error(`Failed to create SaaS app: ${JSON.stringify(createData)}`);
    }

    const createdApp = createData.app;
    if (!createdApp.id || !createdApp.api_key || !createdApp.api_secret) {
      throw new Error('Created app missing ID, API key or secret');
    }

    console.log('  ✔ SaaS application created successfully:');
    console.log(`    - App ID: ${createdApp.id}`);
    console.log(`    - Name: "${createdApp.name}"`);
    console.log(`    - API Key: ${createdApp.api_key}`);
    console.log(`    - Secret: ${createdApp.api_secret.slice(0, 12)}...`);
    passed++;

    // -------------------------------------------------------------
    // Test 3: Regenerate API Key via API
    // -------------------------------------------------------------
    console.log('\n▶ TEST 3: Testing POST /api/internal/apps/:id/regenerate-key...');
    const regenRes = await fetch(`http://localhost:${testPort}/api/internal/apps/${createdApp.id}/regenerate-key`, {
      method: 'POST'
    });

    const regenData = await regenRes.json();
    if (!regenRes.ok || !regenData.success || !regenData.app) {
      throw new Error(`Failed to regenerate API key: ${JSON.stringify(regenData)}`);
    }

    const updatedApp = regenData.app;
    if (updatedApp.api_key === createdApp.api_key) {
      throw new Error('Regenerated API key must not equal previous key');
    }

    console.log('  ✔ API Key regenerated successfully:');
    console.log(`    - Old API Key: ${createdApp.api_key}`);
    console.log(`    - New API Key: ${updatedApp.api_key}`);
    passed++;

    // -------------------------------------------------------------
    // Test 4: Authenticate Request with 'x-api-key' Header
    // -------------------------------------------------------------
    console.log('\n▶ TEST 4: Testing SaaS Authentication Middleware (x-api-key)...');

    // Case A: Missing header -> 401
    const unauthRes = await fetch(`http://localhost:${testPort}/api/v1/customers`);
    if (unauthRes.status !== 401) {
      throw new Error(`Expected 401 for missing x-api-key, got ${unauthRes.status}`);
    }
    console.log('  ✔ Rejected unauthenticated request without x-api-key (HTTP 401)');

    // Case B: Invalid key -> 403
    const badKeyRes = await fetch(`http://localhost:${testPort}/api/v1/customers`, {
      headers: { 'x-api-key': 'tc_live_bogus_invalid_key_123' }
    });
    if (badKeyRes.status !== 403) {
      throw new Error(`Expected 403 for invalid key, got ${badKeyRes.status}`);
    }
    console.log('  ✔ Rejected request with invalid x-api-key (HTTP 403)');

    // -------------------------------------------------------------
    // Test 5: Customer Connection Creation & MySQL Record Verification
    // -------------------------------------------------------------
    console.log('\n▶ TEST 5: Creating Customer Connection & Verifying MySQL Records...');
    const conn = await SaasRepository.createConnection({
      saasAppId: updatedApp.id,
      externalUserId: 'usr_external_992',
      companyName: 'Shree Ganesh Mills Pvt Ltd',
      status: 'ACTIVE'
    });

    if (!conn.id) throw new Error('Connection creation failed to return an ID');

    // Query MySQL directly to verify persistence
    const [connDbRows] = await pool.query('SELECT * FROM connections WHERE id = ?', [conn.id]);
    if (connDbRows.length === 0) throw new Error('Connection record not found in MySQL');

    const [permDbRows] = await pool.query('SELECT * FROM permissions WHERE connection_id = ?', [conn.id]);
    if (permDbRows.length === 0) throw new Error('Permission record not found in MySQL');

    console.log('  ✔ Connection persisted in MySQL:');
    console.log(`    - Connection ID: ${connDbRows[0].id}`);
    console.log(`    - External User ID: ${connDbRows[0].external_user_id}`);
    console.log(`    - Company Name: "${connDbRows[0].company_name}"`);
    console.log(`    - Status: ${connDbRows[0].status}`);
    console.log('  ✔ Permissions initialized in MySQL:');
    console.log(`    - allow_customers: ${Boolean(permDbRows[0].allow_customers)}`);
    console.log(`    - allow_sales: ${Boolean(permDbRows[0].allow_sales)}`);
    console.log(`    - allow_inventory: ${Boolean(permDbRows[0].allow_inventory)}`);
    console.log(`    - allow_ledgers: ${Boolean(permDbRows[0].allow_ledgers)}`);
    console.log(`    - allow_trial_balance: ${Boolean(permDbRows[0].allow_trial_balance)}`);
    passed++;

    // Seed customer entity cache for connection
    await SaasRepository.saveEntityCache({
      connectionId: conn.id,
      entityType: 'customers',
      dataJson: [
        { id: 'cust_ph2_01', name: 'Shree Ganesh Retailers', gstin: '27AABC1234D1Z5' }
      ]
    });

    // Case C: Valid new key -> 200
    const validRes = await fetch(`http://localhost:${testPort}/api/v1/customers`, {
      headers: {
        'x-api-key': updatedApp.api_key,
        'x-connection-id': conn.id
      }
    });
    const validData = await validRes.json();
    if (validRes.status !== 200 || !validData.success) {
      throw new Error(`Expected 200 for valid key, got ${validRes.status}: ${JSON.stringify(validData)}`);
    }
    console.log(`  ✔ Authenticated successfully with valid x-api-key and x-connection-id (HTTP 200, count: ${validData.count || validData.data?.length})`);
    passed++;

  } catch (err) {
    console.error('\n✖ Validation failed:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
    await pool.end();
  }

  console.log('\n================================================================');
  console.log(`🎉 PHASE 2 VALIDATION COMPLETE: ${passed}/${total} TESTS PASSED`);
  console.log('MySQL Database, SaaS App Management & x-api-key Auth Fully Validated.');
  console.log('================================================================\n');

  process.exit(0);
}

runPhase2Validation().catch(e => {
  console.error(e);
  process.exit(1);
});
