import { initMySqlDb, pool } from '../server/src/db/mysql.js';
import { SaasRepository } from '../server/src/db/saasRepository.js';
import { startServer } from '../server/src/index.js';
import { ConnectorAgent } from '../connector-agent/src/agent.js';
import fs from 'fs';
import path from 'path';

async function runPhase3Validation() {
  console.log('================================================================');
  console.log('🚀 PHASE 3: CUSTOMER CONNECTION & ACTIVATION FLOW TEST');
  console.log('Testing: Activation Code | Agent Activation | Permissions | Heartbeat | Connection State');
  console.log('================================================================\n');

  let passed = 0;
  const total = 7;
  let server = null;
  const testPort = 5097;

  try {
    // 0. Ensure MySQL is initialized
    await initMySqlDb();
    server = await startServer(testPort);

    // -------------------------------------------------------------
    // Step 1: Create a test SaaS Application
    // -------------------------------------------------------------
    console.log('▶ STEP 1: Creating SaaS Application ("CloudAccounting Pro")...');
    const app = await SaasRepository.createSaasApp({
      name: 'CloudAccounting Pro',
      redirectUrl: 'https://cloudaccounting.io/tally/auth'
    });
    console.log(`  ✔ SaaS Application created: ID=${app.id}, Key=${app.api_key}`);

    // -------------------------------------------------------------
    // Step 2: SaaS creates connection & Activation Code generated
    // -------------------------------------------------------------
    console.log('\n▶ STEP 2: SaaS initiates connection (POST /api/connect/initiate)...');
    const initRes = await fetch(`http://localhost:${testPort}/api/connect/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        saas_app_id: app.id,
        external_user_id: 'cust_retail_551',
        company_name: 'Bharat Electronics & Hardware'
      })
    });

    const initData = await initRes.json();
    if (!initRes.ok || !initData.success || !initData.activation_code) {
      throw new Error(`Failed to initiate connection: ${JSON.stringify(initData)}`);
    }

    if (!initData.activation_code.startsWith('TC-')) {
      throw new Error(`Activation code "${initData.activation_code}" should start with TC-`);
    }
    if (initData.status !== 'PENDING') {
      throw new Error(`Initial connection status should be PENDING, got ${initData.status}`);
    }

    console.log('  ✔ Connection initiated successfully:');
    console.log(`    - Connection ID: ${initData.connection_id}`);
    console.log(`    - Activation Code Generated: "${initData.activation_code}"`);
    console.log(`    - Expiry: ${initData.expiry_time}`);
    console.log(`    - Initial Status: ${initData.status}`);
    passed += 2; // ✓ SaaS creates connection, ✓ Activation code generated

    // -------------------------------------------------------------
    // Step 3: Agent activates with 6-character code
    // -------------------------------------------------------------
    console.log('\n▶ STEP 3: Agent activates with activation code (POST /api/agent/activate)...');
    const activateRes = await fetch(`http://localhost:${testPort}/api/agent/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activation_code: initData.activation_code,
        machine_name: 'BHARAT-DESKTOP-POS',
        active_company: 'Bharat Electronics & Hardware Pvt Ltd'
      })
    });

    const activateData = await activateRes.json();
    if (!activateRes.ok || !activateData.success || !activateData.agent_token) {
      throw new Error(`Agent activation failed: ${JSON.stringify(activateData)}`);
    }

    if (activateData.status !== 'ACTIVE') {
      throw new Error(`Expected status ACTIVE after activation, got ${activateData.status}`);
    }

    console.log('  ✔ Agent activation succeeded:');
    console.log(`    - Agent ID: ${activateData.agent_id}`);
    console.log(`    - Agent Token: ${activateData.agent_token.slice(0, 16)}...`);
    console.log(`    - Connection Status: ${activateData.status}`);
    console.log(`    - Connected Company: "${activateData.company_name}"`);
    passed++; // ✓ Agent activates

    // -------------------------------------------------------------
    // Step 4: Verify Agent linked correctly in MySQL
    // -------------------------------------------------------------
    console.log('\n▶ STEP 4: Verifying database records & linkage...');
    const [connRows] = await pool.query('SELECT * FROM connections WHERE id = ?', [initData.connection_id]);
    if (connRows.length === 0) throw new Error('Connection record missing in database');

    const connRecord = connRows[0];
    if (connRecord.status !== 'ACTIVE') {
      throw new Error(`Expected MySQL status ACTIVE, got ${connRecord.status}`);
    }
    if (connRecord.agent_id !== activateData.agent_id) {
      throw new Error(`Connection agent_id mismatch: expected ${activateData.agent_id}, got ${connRecord.agent_id}`);
    }

    const [agentRows] = await pool.query('SELECT * FROM agents WHERE id = ?', [activateData.agent_id]);
    if (agentRows.length === 0) throw new Error('Agent record missing in database');
    const agentRecord = agentRows[0];

    if (agentRecord.connection_id !== initData.connection_id) {
      throw new Error(`Agent connection_id mismatch: expected ${initData.connection_id}, got ${agentRecord.connection_id}`);
    }

    console.log('  ✔ Agent correctly linked in MySQL:');
    console.log(`    - connections.status = ${connRecord.status}`);
    console.log(`    - connections.agent_id = ${connRecord.agent_id}`);
    console.log(`    - agents.machine_name = ${agentRecord.machine_name}`);
    console.log(`    - agents.status = ${agentRecord.status}`);
    passed++; // ✓ Agent linked correctly

    // -------------------------------------------------------------
    // Step 5: Permission Selection (GET & POST)
    // -------------------------------------------------------------
    console.log('\n▶ STEP 5: Testing Customer Permission Selection APIs...');
    const getPermRes = await fetch(`http://localhost:${testPort}/api/connect/${initData.connection_id}/permissions`, {
      headers: { 'x-api-key': app.api_key }
    });
    const getPermData = await getPermRes.json();
    if (!getPermRes.ok || !getPermData.success) {
      throw new Error(`Failed to get permissions: ${JSON.stringify(getPermData)}`);
    }

    console.log('  ✔ Default permissions fetched:');
    console.log(`    - customers: ${getPermData.permissions.customers}`);
    console.log(`    - sales: ${getPermData.permissions.sales}`);
    console.log(`    - inventory: ${getPermData.permissions.inventory}`);

    // Update permissions: enable inventory and trial_balance
    const postPermRes = await fetch(`http://localhost:${testPort}/api/connect/${initData.connection_id}/permissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': app.api_key
      },
      body: JSON.stringify({
        permissions: {
          customers: true,
          sales: true,
          inventory: true,
          ledgers: true,
          trial_balance: true
        }
      })
    });

    const postPermData = await postPermRes.json();
    if (!postPermRes.ok || !postPermData.success) {
      throw new Error(`Failed to update permissions: ${JSON.stringify(postPermData)}`);
    }

    // Verify updated in MySQL directly
    const [permDb] = await pool.query('SELECT * FROM permissions WHERE connection_id = ?', [initData.connection_id]);
    if (!permDb[0].allow_inventory || !permDb[0].allow_trial_balance) {
      throw new Error('Permissions failed to update in MySQL');
    }

    console.log('  ✔ Permissions updated and verified in MySQL:');
    console.log(`    - allow_customers: ${Boolean(permDb[0].allow_customers)}`);
    console.log(`    - allow_inventory: ${Boolean(permDb[0].allow_inventory)}`);
    console.log(`    - allow_trial_balance: ${Boolean(permDb[0].allow_trial_balance)}`);
    passed++; // ✓ Permissions saved

    // -------------------------------------------------------------
    // Step 6: Heartbeat Received & Recorded
    // -------------------------------------------------------------
    console.log('\n▶ STEP 6: Testing Agent Heartbeat (POST /api/agent/heartbeat)...');
    const hbRes = await fetch(`http://localhost:${testPort}/api/agent/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activateData.agent_token}`
      },
      body: JSON.stringify({
        agent_id: activateData.agent_id,
        connection_id: initData.connection_id,
        machine_name: 'BHARAT-DESKTOP-POS',
        tally_status: 'ONLINE',
        active_company: 'Bharat Electronics & Hardware Pvt Ltd',
        port: 9000
      })
    });

    const hbData = await hbRes.json();
    if (!hbRes.ok || !hbData.success || !hbData.acknowledged) {
      throw new Error(`Heartbeat failed: ${JSON.stringify(hbData)}`);
    }

    console.log('  ✔ Heartbeat acknowledged by server (status: ONLINE)');
    passed++; // ✓ Heartbeat received

    // -------------------------------------------------------------
    // Step 7: Connection Status Becomes ACTIVE
    // -------------------------------------------------------------
    console.log('\n▶ STEP 7: Verifying Final Connection Status...');
    const statusRes = await fetch(`http://localhost:${testPort}/api/connect/status/${initData.activation_code}`);
    const statusData = await statusRes.json();

    if (!statusRes.ok || !statusData.paired) {
      throw new Error(`Status check failed: ${JSON.stringify(statusData)}`);
    }

    console.log('  ✔ Connection polling status verified:');
    console.log(`    - Code: ${statusData.code}`);
    console.log(`    - Paired: ${statusData.paired}`);
    console.log(`    - Agent Status: ${statusData.agentStatus}`);
    console.log(`    - Active Company: "${statusData.activeCompany}"`);
    passed++; // ✓ Connection status becomes ACTIVE

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
  console.log(`🎉 PHASE 3 VALIDATION COMPLETE: ${passed}/${total} CRITERIA PASSED`);
  console.log('Customer Connection & Activation Flow is fully operational.');
  console.log('================================================================\n');

  process.exit(0);
}

runPhase3Validation().catch(e => {
  console.error(e);
  process.exit(1);
});
