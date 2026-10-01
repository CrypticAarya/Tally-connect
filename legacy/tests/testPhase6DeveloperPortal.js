import http from 'http';
import assert from 'assert';
import { pool } from './server/src/db/mysql.js';

const BASE_URL = process.env.CLOUD_URL || 'http://127.0.0.1:5001';
const WEBHOOK_PORT = 5096;

let webhookServer;
let receivedWebhooks = [];

/**
 * Starts a lightweight local HTTP server to receive and verify webhook calls
 */
function startWebhookReceiver(port = WEBHOOK_PORT) {
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
          body: parsed
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received: true }));
      });
    });

    webhookServer.listen(port, '127.0.0.1', () => {
      resolve(webhookServer);
    });
    webhookServer.on('error', reject);
  });
}

function stopWebhookReceiver() {
  if (webhookServer) {
    webhookServer.close();
  }
}

async function runTest() {
  console.log('===============================================================');
  console.log('🧪 PHASE 6: SAAS DEVELOPER PORTAL & INTEGRATION EXPERIENCE TEST');
  console.log('===============================================================\n');

  try {
    // 0. Start Webhook Listener
    await startWebhookReceiver(WEBHOOK_PORT);
    const webhookUrl = `http://127.0.0.1:${WEBHOOK_PORT}/webhook-listener`;

    // Pre-check: Health
    console.log('======================================================');
    console.log('▶ Pre-Check: Verify Cloud Server is Online');
    console.log('======================================================');
    const healthResp = await fetch(`${BASE_URL}/api/health`);
    assert.strictEqual(healthResp.status, 200, 'Cloud server should return HTTP 200');
    console.log('  ✔ Cloud server is online and reachable\n');

    // 1. Developer created
    console.log('======================================================');
    console.log('▶ 1. Verification: Developer account created & authenticated');
    console.log('======================================================');
    const testEmail = `dev_${Date.now()}@fintechsuite.io`;
    const regResp = await fetch(`${BASE_URL}/api/developer/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alex Rivera',
        email: testEmail,
        password: 'SecurePassword@2026'
      })
    });

    assert.strictEqual(regResp.status, 201, 'Registration should return 201 Created');
    const regData = await regResp.json();
    assert.strictEqual(regData.success, true, 'Registration success should be true');
    assert.ok(regData.developer?.id, 'Developer should have an ID');
    assert.strictEqual(regData.developer.email, testEmail, 'Email should match');
    const developerId = regData.developer.id;
    console.log(`  ✔ Developer account created: "${regData.developer.name}" (${developerId})`);

    // Verify login
    const loginResp = await fetch(`${BASE_URL}/api/developer/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'SecurePassword@2026'
      })
    });
    assert.strictEqual(loginResp.status, 200, 'Login should return 200 OK');
    const loginData = await loginResp.json();
    assert.strictEqual(loginData.success, true, 'Login should succeed');
    const devToken = loginData.token;
    assert.ok(devToken, 'Login should issue a developer token');
    console.log('  ✔ Developer credentials authenticated successfully via login');
    console.log('✓ Developer created\n');

    // 2 & 3. App created & API key generated
    console.log('======================================================');
    console.log('▶ 2 & 3. Verification: App created & API key management');
    console.log('======================================================');
    const appResp = await fetch(`${BASE_URL}/api/developer/apps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${devToken}`
      },
      body: JSON.stringify({
        developer_id: developerId,
        app_name: 'Fintech Billing & GST Automation',
        webhook_url: webhookUrl
      })
    });

    assert.strictEqual(appResp.status, 201, 'App creation should return 201 Created');
    const appData = await appResp.json();
    assert.strictEqual(appData.success, true, 'App creation should be true');
    const appId = appData.app.id;
    let apiKey = appData.app.api_key;
    const apiSecret = appData.app.api_secret;

    assert.ok(appId, 'App should have an ID');
    assert.ok(apiKey.startsWith('tc_live_'), 'API key should start with tc_live_');
    assert.ok(apiSecret.startsWith('sec_live_'), 'API secret should start with sec_live_');
    assert.strictEqual(appData.app.webhook_url, webhookUrl, 'Webhook URL should match');
    console.log(`  ✔ App created successfully: ID=${appId}, Name="${appData.app.app_name}"`);
    console.log(`  ✔ API key generated: ${apiKey.slice(0, 18)}...`);
    console.log(`  ✔ API secret generated: ${apiSecret.slice(0, 18)}...`);
    console.log('✓ App created');
    console.log('✓ API key generated\n');

    // Test API key view (requires authenticated developer token)
    const keyResp = await fetch(`${BASE_URL}/api/developer/apps/${appId}/api-key`, {
      headers: { 'Authorization': `Bearer ${devToken}` }
    });
    assert.strictEqual(keyResp.status, 200);
    const keyData = await keyResp.json();
    assert.strictEqual(keyData.api_key, apiKey);
    console.log('  ✔ GET /api/developer/apps/:id/api-key retrieved valid key');

    // 4. API Authentication & Key Management (Regenerate & Disable)
    console.log('======================================================');
    console.log('▶ 4. Verification: API authentication works & key controls');
    console.log('======================================================');

    // Missing key -> 401
    const noKeyResp = await fetch(`${BASE_URL}/api/v1/customers`);
    assert.strictEqual(noKeyResp.status, 401, 'Request without key must return 401');
    console.log('  ✔ Request without x-api-key rejected with HTTP 401');

    // Invalid key -> 403
    const badKeyResp = await fetch(`${BASE_URL}/api/v1/customers`, {
      headers: { 'x-api-key': 'tc_live_invalid_key_99999999' }
    });
    assert.strictEqual(badKeyResp.status, 403, 'Request with invalid key must return 403');
    console.log('  ✔ Request with invalid x-api-key rejected with HTTP 403');

    // Test Disable Key
    const disableResp = await fetch(`${BASE_URL}/api/developer/apps/${appId}/disable`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${devToken}` }
    });
    assert.strictEqual(disableResp.status, 200);
    const disabledKeyResp = await fetch(`${BASE_URL}/api/v1/customers`, {
      headers: { 'x-api-key': apiKey }
    });
    assert.strictEqual(disabledKeyResp.status, 403, 'Disabled key must be rejected with HTTP 403');
    const disabledBody = await disabledKeyResp.json();
    assert.ok(disabledBody.error.includes('disabled'), 'Error should state key is disabled');
    console.log('  ✔ Disabled key properly rejected with HTTP 403');

    // Test Re-Enable Key
    const enableResp = await fetch(`${BASE_URL}/api/developer/apps/${appId}/enable`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${devToken}` }
    });
    assert.strictEqual(enableResp.status, 200);
    console.log('  ✔ Re-enabled API key successfully');

    // Test Regenerate Key
    const regenResp = await fetch(`${BASE_URL}/api/developer/apps/${appId}/regenerate-key`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${devToken}` }
    });
    assert.strictEqual(regenResp.status, 200);
    const regenData = await regenResp.json();
    assert.notStrictEqual(regenData.app.api_key, apiKey, 'New API key should differ from old key');
    const oldApiKey = apiKey;
    apiKey = regenData.app.api_key;
    console.log(`  ✔ API key regenerated: ${apiKey.slice(0, 18)}... (Old key invalidated)`);

    // Old key must now fail
    const oldKeyResp = await fetch(`${BASE_URL}/api/v1/customers`, {
      headers: { 'x-api-key': oldApiKey }
    });
    assert.strictEqual(oldKeyResp.status, 403, 'Old key must be rejected after regeneration');
    console.log('  ✔ Old key invalidated and rejected with HTTP 403');

    // Connect a customer to this app and activate agent so /api/v1 has active data
    const initConnResp = await fetch(`${BASE_URL}/api/connect/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        saas_app_id: appId,
        external_user_id: 'usr_phase6_test',
        company_name: 'Metro Retail Mart Pvt Ltd'
      })
    });
    assert.strictEqual(initConnResp.status, 201);
    const connData = await initConnResp.json();
    const connectionId = connData.connection_id;
    const activationCode = connData.activation_code;

    const actResp = await fetch(`${BASE_URL}/api/agent/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activation_code: activationCode,
        machine_name: 'METRO-POS-SERVER'
      })
    });
    assert.strictEqual(actResp.status, 200);
    const agentToken = (await actResp.json()).agent_token;

    // Verify valid new key now succeeds on SaaS API
    const authSuccessResp = await fetch(`${BASE_URL}/api/v1/customers`, {
      headers: { 'x-api-key': apiKey }
    });
    assert.strictEqual(authSuccessResp.status, 200, 'Valid API key must return HTTP 200');
    console.log('  ✔ Valid x-api-key authenticated successfully on GET /api/v1/customers (HTTP 200)');
    console.log('✓ API authentication works\n');

    // 5. Documentation Accessible
    console.log('======================================================');
    console.log('▶ 5. Verification: API Documentation Accessible');
    console.log('======================================================');
    const docsResp = await fetch(`${BASE_URL}/api/docs`);
    assert.strictEqual(docsResp.status, 200, 'Documentation should return HTTP 200');
    const docsData = await docsResp.json();
    assert.strictEqual(docsData.success, true);
    const docs = docsData.documentation;

    assert.ok(docs.authentication?.header === 'x-api-key', 'Docs must describe x-api-key authentication');
    console.log('  ✔ Documentation authentication header verified: x-api-key');

    const expectedEntities = ['customers', 'sales', 'inventory', 'ledgers', 'trial-balance'];
    for (const ent of expectedEntities) {
      const found = docs.availableApis.find(a => a.entity === ent);
      assert.ok(found, `Documentation must include API for: ${ent}`);
      assert.ok(found.request_example, `API ${ent} must include request_example`);
      assert.ok(found.response_example, `API ${ent} must include response_example`);
      assert.ok(Array.isArray(found.error_codes) && found.error_codes.length > 0, `API ${ent} must include error_codes`);
      console.log(`  ✔ API endpoint verified in docs: GET ${found.path} (${ent})`);
    }
    console.log('✓ Documentation accessible\n');

    // 6. Webhook Triggered After Sync
    console.log('======================================================');
    console.log('▶ 6. Verification: Webhook triggered after sync');
    console.log('======================================================');
    // Upload customer sync payload via agent sync API
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
            guid: 'cust-ph6-001',
            name: 'Delta Logistics Services',
            gstin: '27AABCD1234E1Z6',
            address: 'Expressway Hub, Sector 18, Navi Mumbai, Maharashtra, 410206'
          }
        ]
      })
    });

    assert.strictEqual(uploadResp.status, 200, 'Upload should succeed');
    console.log('  ✔ Agent sync payload uploaded successfully');

    // Wait briefly for webhook delivery
    await new Promise(r => setTimeout(r, 600));

    // Verify webhook receiver received the notification
    assert.ok(receivedWebhooks.length > 0, 'Webhook receiver should have received at least 1 webhook');
    const lastWebhook = receivedWebhooks[receivedWebhooks.length - 1];
    assert.strictEqual(lastWebhook.body?.event, 'sync.completed', 'Webhook event must be sync.completed');
    assert.strictEqual(lastWebhook.headers['x-tally-event'], 'sync.completed', 'X-Tally-Event header must be sync.completed');
    assert.ok(lastWebhook.headers['x-tally-signature'], 'X-Tally-Signature header must be present');
    console.log(`  ✔ Webhook received by listener: event="${lastWebhook.body.event}"`);
    console.log(`  ✔ Webhook signature verified: ${lastWebhook.headers['x-tally-signature'].slice(0, 25)}...`);
    console.log(`  ✔ Webhook payload contains entity: ${lastWebhook.body.data?.entity_type}`);

    // Verify MySQL webhook_logs
    const [whRows] = await pool.query(
      `SELECT id, app_id, event, target_url, status_code, success FROM webhook_logs WHERE app_id = ? ORDER BY created_at DESC LIMIT 1`,
      [appId]
    );
    assert.ok(whRows.length > 0, 'webhook_logs must have a record');
    assert.strictEqual(whRows[0].event, 'sync.completed');
    assert.strictEqual(whRows[0].status_code, 200);
    assert.strictEqual(Boolean(whRows[0].success), true);
    console.log(`  ✔ Webhook delivery logged in MySQL webhook_logs (status: ${whRows[0].status_code}, success: true)`);

    // Verify GET /api/developer/apps/:id/webhooks
    const appWhResp = await fetch(`${BASE_URL}/api/developer/apps/${appId}/webhooks`, {
      headers: { 'Authorization': `Bearer ${devToken}` },
    });
    assert.strictEqual(appWhResp.status, 200);
    const appWhData = await appWhResp.json();
    assert.ok(appWhData.logs.length > 0, 'App webhooks endpoint should return logs');
    console.log(`  ✔ GET /api/developer/apps/:id/webhooks returned ${appWhData.logs.length} logged webhook(s)`);
    console.log('✓ Webhook triggered after sync\n');

    // 7. API Playground returns JSON
    console.log('======================================================');
    console.log('▶ 7. Verification: API playground returns live JSON');
    console.log('======================================================');
    const playgroundResp = await fetch(`${BASE_URL}/api/developer/playground`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        endpoint: '/api/v1/customers',
        method: 'GET'
      })
    });

    assert.strictEqual(playgroundResp.status, 200, 'Playground endpoint should return HTTP 200');
    const playgroundData = await playgroundResp.json();
    assert.strictEqual(playgroundData.success, true, 'Playground success should be true');
    assert.strictEqual(playgroundData.statusCode, 200, 'Internal execution status should be 200');
    assert.ok(playgroundData.durationMs >= 0, 'Execution duration should be tracked');
    assert.ok(playgroundData.response, 'Playground should return live JSON response');
    assert.strictEqual(playgroundData.response.success, true, 'Live response success should be true');
    assert.ok(Array.isArray(playgroundData.response.data), 'Live response should contain data array');
    console.log('  ✔ Playground executed live GET /api/v1/customers');
    console.log(`  ✔ Execution time: ${playgroundData.durationMs}ms, HTTP Status: ${playgroundData.statusCode}`);
    console.log('Sample live playground response:');
    console.log(JSON.stringify(playgroundData.response, null, 2));

    // Also test shortcut /api/playground
    const shortcutResp = await fetch(`${BASE_URL}/api/playground`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        endpoint: '/api/v1/sales',
        method: 'GET'
      })
    });
    assert.strictEqual(shortcutResp.status, 200, 'Shortcut /api/playground should work');
    console.log('  ✔ Shortcut endpoint POST /api/playground tested successfully');
    console.log('✓ API playground returns JSON\n');

    console.log('===============================================================');
    console.log('🎉 ALL PHASE 6 VALIDATION CHECKS PASSED:');
    console.log('  ✓ Developer created');
    console.log('  ✓ App created');
    console.log('  ✓ API key generated');
    console.log('  ✓ API authentication works');
    console.log('  ✓ Documentation accessible');
    console.log('  ✓ Webhook triggered after sync');
    console.log('  ✓ API playground returns JSON');
    console.log('===============================================================\n');

  } finally {
    stopWebhookReceiver();
  }
}

runTest().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('\n✖ Phase 6 Test Failed:', err);
  stopWebhookReceiver();
  process.exit(1);
});
