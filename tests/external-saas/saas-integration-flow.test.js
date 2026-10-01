/**
 * Tally Connect — External SaaS Developer Integration Contract Test
 * 
 * Demonstrates the exact 10-step integration flow an external SaaS developer builds:
 * 1. Import SDK
 * 2. Create TallyConnect client
 * 3. Create connection session
 * 4. Receive activation code
 * 5. Query connection status
 * 6. Query available data
 * 7. Verify permission enforcement (403 when disabled)
 * 8. Trigger sync
 * 9. Receive webhook
 * 10. Verify webhook signature
 */

import http from 'http';
import assert from 'assert';
import { TallyConnect, connectTally } from '../../sdk/index.js';

const BASE_URL = process.env.CLOUD_URL || 'http://127.0.0.1:5001';
const WEBHOOK_PORT = 5096;

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

async function runExternalSaasIntegrationFlowTest() {
  console.log('===============================================================');
  console.log('🌐 EXTERNAL SAAS DEVELOPER INTEGRATION CONTRACT TEST');
  console.log('===============================================================\n');

  try {
    await startWebhookServer(WEBHOOK_PORT);

    // Setup: Provision a real SaaS Developer Account & Application via Cloud API
    const devEmail = `saas_dev_${Date.now()}@example.com`;
    const regRes = await fetch(`${BASE_URL}/api/developer/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Apex Fintech Corp',
        email: devEmail,
        password: 'SecurePassword123!'
      })
    });
    const regData = await regRes.json();
    assert(regData.success && regData.token, 'Developer account registered via public API');

    const appRes = await fetch(`${BASE_URL}/api/developer/apps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${regData.token}`
      },
      body: JSON.stringify({
        name: 'InvoiceFlow ERP',
        webhook_url: `http://127.0.0.1:${WEBHOOK_PORT}/webhook`
      })
    });
    const appData = await appRes.json();
    assert(appData.app && appData.app.api_key, 'SaaS App created with credentials');

    const appId = appData.app.id;
    const apiKey = appData.app.api_key;
    const apiSecret = appData.app.api_secret;

    // -------------------------------------------------------------
    // STEP 1: Import SDK
    // -------------------------------------------------------------
    console.log('▶ STEP 1: Verify SDK Exports...');
    assert.strictEqual(typeof TallyConnect, 'function', 'TallyConnect class imported');
    assert.strictEqual(typeof connectTally, 'function', 'connectTally helper imported');
    console.log('  ✔ import { TallyConnect, connectTally } from "@tallyconnect/sdk" verified');

    // -------------------------------------------------------------
    // STEP 2: Create TallyConnect client
    // -------------------------------------------------------------
    console.log('\n▶ STEP 2: Instantiate TallyConnect Client...');
    const client = new TallyConnect({
      apiKey,
      baseUrl: BASE_URL
    });
    assert(client && client.apiKey === apiKey, 'TallyConnect client initialized with apiKey');
    console.log('  ✔ TallyConnect client configured with live API key');

    // -------------------------------------------------------------
    // STEP 3: Create connection session
    // -------------------------------------------------------------
    console.log('\n▶ STEP 3: Create Customer Connection Session...');
    const session = await connectTally({
      appId,
      userId: 'customer_tenant_4091',
      companyName: 'Apex Machinery & Hardware Ltd',
      baseUrl: BASE_URL
    });
    assert(session && session.connectionId, 'Connection session created');
    console.log(`  ✔ Session created: Connection ID = ${session.connectionId}`);

    // -------------------------------------------------------------
    // STEP 4: Receive activation code
    // -------------------------------------------------------------
    console.log('\n▶ STEP 4: Receive Activation Code...');
    assert(typeof session.activationCode === 'string', 'Activation code returned');
    assert(/^TC-[A-Z0-9]{4,6}$/.test(session.activationCode), `Code format valid: ${session.activationCode}`);
    console.log(`  ✔ Activation Code generated for customer: ${session.activationCode} (Expires: ${session.expiresAt})`);

    // Simulate customer entering activation code on Windows Agent
    const activateRes = await fetch(`${BASE_URL}/api/agent/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activationCode: session.activationCode,
        machineName: 'ACCOUNTS-DESKTOP-01',
        agentVersion: '1.0.0-beta'
      })
    });
    const activateData = await activateRes.json();
    assert(activateData.success && (activateData.agentToken || activateData.agent_token), 'Agent activated with token');
    const agentToken = activateData.agentToken || activateData.agent_token;

    // Send agent heartbeat marking company online
    await fetch(`${BASE_URL}/api/agent/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${agentToken}`
      },
      body: JSON.stringify({
        tallyStatus: 'ONLINE',
        companyName: 'Apex Machinery & Hardware Ltd',
        version: 'TallyPrime 4.1',
        port: 9000
      })
    });

    // -------------------------------------------------------------
    // STEP 5: Query connection status
    // -------------------------------------------------------------
    console.log('\n▶ STEP 5: Query Connection Status via SDK...');
    const status = await client.getStatus(session.connectionId);
    assert.strictEqual(status.status, 'ACTIVE', 'Connection status is ACTIVE');
    assert.strictEqual(status.company_name, 'Apex Machinery & Hardware Ltd', 'Active company matches');
    assert.strictEqual(status.agent_status, 'ONLINE', 'Agent status is ONLINE');
    console.log(`  ✔ Connection active: Status=${status.status}, Company="${status.company_name}", Agent=${status.agent_status}`);

    // -------------------------------------------------------------
    // STEP 6: Query available data
    // -------------------------------------------------------------
    console.log('\n▶ STEP 6: Query Available Data via SDK...');
    // Agent uploads sample dataset
    await fetch(`${BASE_URL}/api/agent/sync/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${agentToken}`
      },
      body: JSON.stringify({
        entity: 'customers',
        records: [
          {
            name: 'Pioneer Engineering Solutions',
            guid: 'cust-pioneer-1001',
            parent: 'Sundry Debtors',
            gstin: '27AABCP1234A1Z5',
            closing_balance: -45000.00
          }
        ]
      })
    });

    const customers = await client.getCustomers(session.connectionId);
    assert(Array.isArray(customers), 'Customers response is an array');
    assert.strictEqual(customers.length, 1, 'Returned 1 customer');
    assert.strictEqual(customers[0].name, 'Pioneer Engineering Solutions', 'Customer name matches');
    console.log(`  ✔ Retrieved permitted data: ${customers.length} customer records (Party: "${customers[0].name}")`);

    // -------------------------------------------------------------
    // STEP 7: Verify permission enforcement (403 when disabled)
    // -------------------------------------------------------------
    console.log('\n▶ STEP 7: Verify Permission Enforcement (403 Forbidden)...');
    // Disable customer permission for this connection
    await client.updatePermissions(session.connectionId, {
      customers: false,
      sales: true,
      inventory: false
    });

    let forbiddenCaught = false;
    try {
      await client.getCustomers(session.connectionId);
    } catch (err) {
      forbiddenCaught = true;
      assert(err.message.includes('403') || err.message.includes('Permission denied'), `Error message indicates permission denial: ${err.message}`);
    }
    assert(forbiddenCaught, 'Querying disabled entity was blocked with 403 Forbidden');
    console.log('  ✔ Disabled permission successfully rejected with 403 Forbidden (Server-side guard active)');

    // Re-enable customer permission for remainder of test
    await client.updatePermissions(session.connectionId, {
      customers: true,
      sales: true,
      inventory: false
    });

    // -------------------------------------------------------------
    // STEP 8: Trigger sync
    // -------------------------------------------------------------
    console.log('\n▶ STEP 8: Trigger Sync via SDK...');
    const syncRes = await client.syncNow(session.connectionId);
    assert(syncRes.success === true, 'Sync job triggered successfully');
    assert(Array.isArray(syncRes.jobs), 'Sync jobs array returned');
    console.log(`  ✔ Sync triggered: ${syncRes.jobs.length} jobs queued for permitted entities: ${syncRes.entities.join(', ')}`);

    // -------------------------------------------------------------
    // STEP 9: Receive webhook
    // -------------------------------------------------------------
    console.log('\n▶ STEP 9: Receive Webhook Notification...');
    // Trigger cloud webhook dispatch for completed sync
    await fetch(`${BASE_URL}/api/internal/dispatch-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: appId,
        event: 'sync.completed',
        data: {
          connection_id: session.connectionId,
          company_name: 'Apex Machinery & Hardware Ltd',
          status: 'COMPLETED',
          records_synced: 1
        }
      })
    });

    // Wait briefly for webhook delivery
    await new Promise(r => setTimeout(r, 500));

    assert(receivedWebhooks.length > 0, 'Webhook received by SaaS webhook server');
    const incomingWebhook = receivedWebhooks[receivedWebhooks.length - 1];
    assert.strictEqual(incomingWebhook.body.event, 'sync.completed', 'Webhook event matches sync.completed');
    assert.strictEqual(incomingWebhook.body.data.connection_id, session.connectionId, 'Webhook connection ID matches');
    console.log(`  ✔ Webhook received: Event="${incomingWebhook.body.event}", Connection="${incomingWebhook.body.data.connection_id}"`);

    // -------------------------------------------------------------
    // STEP 10: Verify webhook signature
    // -------------------------------------------------------------
    console.log('\n▶ STEP 10: Verify HMAC-SHA256 Webhook Signature...');
    const sigHeader = incomingWebhook.headers['x-tally-signature'];
    assert(sigHeader, 'X-Tally-Signature header present on webhook');

    const isValid = TallyConnect.verifyWebhookSignature(
      incomingWebhook.rawBody,
      sigHeader,
      apiSecret
    );
    assert.strictEqual(isValid, true, 'Webhook HMAC-SHA256 signature verified with API secret');

    const isTampered = TallyConnect.verifyWebhookSignature(
      incomingWebhook.rawBody,
      'bad_tampered_signature',
      apiSecret
    );
    assert.strictEqual(isTampered, false, 'Tampered signature rejected');
    console.log(`  ✔ Webhook signature cryptographically verified using TallyConnect.verifyWebhookSignature()`);

    console.log('\n===============================================================');
    console.log('✅ ALL 10 SAAS DEVELOPER INTEGRATION CONTRACT CHECKS PASSED');
    console.log('===============================================================\n');
  } finally {
    stopWebhookServer();
  }
}

runExternalSaasIntegrationFlowTest().catch(err => {
  console.error('\n❌ External SaaS Integration Flow Test Failed:', err);
  process.exit(1);
});
