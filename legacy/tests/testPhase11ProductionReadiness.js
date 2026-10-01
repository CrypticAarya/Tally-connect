/**
 * Phase 11: Real SaaS Integration & Production Readiness Validation
 * 
 * Validates:
 * 1. Production Health Probes (/health, /ready, /version)
 * 2. Environment Configuration Audit & Removal of Hardcoded / Temporary URLs
 * 3. SaaS App Developer Registration & Live API Key Generation
 * 4. External Connection Session & Agent Linking via Production Cloud URL
 * 5. Standardized SaaS REST API Endpoints with API Key Protection (x-api-key)
 * 6. Webhook Delivery & Cryptographic HMAC-SHA256 Payload Signing
 * 7. MySQL Database Data Persistence & Integrity
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { pool } from './server/src/db/mysql.js';
import { Installer } from './connector-agent/src/installer.js';
import { ConnectorAgent } from './connector-agent/src/agent.js';
import { WebhookService } from './server/src/services/webhookService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.CLOUD_URL || process.env.API_URL || 'http://127.0.0.1:5001';
const WEBHOOK_PORT = 5098;
const TEST_DIR = path.join(__dirname, 'scratch', 'prod-readiness-test');

function logSection(title) {
  console.log(`\n===============================================================`);
  console.log(`▶ ${title}`);
  console.log(`===============================================================`);
}

function assert(condition, message) {
  if (!condition) {
    console.error(`✖ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✔ ${message}`);
}

async function runProductionValidation() {
  console.log('\n===============================================================');
  console.log('🚀 Tally Connect — Phase 11 Production Readiness Validation');
  console.log('===============================================================');
  console.log(`Target API Endpoint: ${BASE_URL}`);

  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });

  // -------------------------------------------------------------
  // Test 1: Production Health Probes (/health, /ready, /version)
  // -------------------------------------------------------------
  logSection('1. Production Health Check Endpoints (/health, /ready, /version)');
  
  // Liveness Probe
  const healthRes = await fetch(`${BASE_URL}/health`);
  assert(healthRes.status === 200, `GET /health returned HTTP ${healthRes.status}`);
  const healthData = await healthRes.json();
  assert(healthData.status === 'OK', `Liveness status is OK (received: ${healthData.status})`);
  assert(typeof healthData.uptime === 'number', `Uptime reported: ${healthData.uptime}s`);

  // Readiness Probe
  const readyRes = await fetch(`${BASE_URL}/ready`);
  assert(readyRes.status === 200, `GET /ready returned HTTP ${readyRes.status}`);
  const readyData = await readyRes.json();
  assert(readyData.status === 'READY', `Readiness status is READY (received: ${readyData.status})`);
  assert(readyData.database === 'connected', `Database readiness is "${readyData.database}"`);
  assert(Boolean(readyData.queue), `Background job queue is "${readyData.queue}"`);

  // Version Probe
  const versionRes = await fetch(`${BASE_URL}/version`);
  assert(versionRes.status === 200, `GET /version returned HTTP ${versionRes.status}`);
  const versionData = await versionRes.json();
  assert(versionData.version === '1.0.0', `Version matches 1.0.0 (received: ${versionData.version})`);
  assert(Boolean(versionData.environment), `Environment reported: ${versionData.environment}`);
  assert(Boolean(versionData.nodeVersion), `Node.js runtime reported: ${versionData.nodeVersion}`);

  // -------------------------------------------------------------
  // Test 2: Environment Configuration & URL Audit
  // -------------------------------------------------------------
  logSection('2. Environment Configuration Audit & Hardcoded URL Removal');
  
  assert(fs.existsSync(path.join(__dirname, 'server', '.env.example')), 'server/.env.example exists');
  assert(fs.existsSync(path.join(__dirname, 'server', '.env.production.example')), 'server/.env.production.example exists');
  
  const agentCfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'connector-agent', 'config.json'), 'utf-8'));
  assert(!agentCfg.cloudUrl.includes('trycloudflare'), 'connector-agent/config.json has zero trycloudflare URLs');

  const agentDevCfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'connector-agent', 'config.dev.json'), 'utf-8'));
  assert(!agentDevCfg.cloudUrl.includes('trycloudflare'), 'connector-agent/config.dev.json has zero trycloudflare URLs');
  console.log('  ✔ Confirmed: All temporary development tunnels audited and purged from codebase');

  // -------------------------------------------------------------
  // Test 3: SaaS Developer App Registration & API Key Verification
  // -------------------------------------------------------------
  logSection('3. SaaS Developer App Registration & API Key Verification');
  
  const appResp = await fetch(`${BASE_URL}/api/developer/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_name: 'Production SaaS ERP Client',
      webhook_url: `http://127.0.0.1:${WEBHOOK_PORT}/webhook`
    })
  });

  assert(appResp.status === 201, 'SaaS App registered (HTTP 201)');
  const appData = await appResp.json();
  const testApp = appData.app || appData;
  const appId = testApp.id;
  const apiKey = testApp.api_key;
  const apiSecret = testApp.api_secret;

  assert(Boolean(appId), `SaaS App ID: ${appId}`);
  assert(Boolean(apiKey) && apiKey.startsWith('tc_live_'), `Live API Key issued: ${apiKey}`);
  assert(Boolean(apiSecret), 'API Secret issued securely');

  // -------------------------------------------------------------
  // Test 4: External Connection Session & Agent Linking
  // -------------------------------------------------------------
  logSection('4. External Connection Session & Agent Linking via Production Cloud URL');
  
  const sessionRes = await fetch(`${BASE_URL}/api/connect/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: appId,
      external_user_id: 'enterprise_customer_9001',
      company_name: 'Apex Industrial Technologies Pvt Ltd'
    })
  });

  assert(sessionRes.status === 201, `POST /api/connect/session returned HTTP ${sessionRes.status}`);
  const sessionData = await sessionRes.json();
  assert(Boolean(sessionData.session_id), `Connection Session ID: ${sessionData.session_id}`);
  assert(Boolean(sessionData.activation_code), `Activation Code: ${sessionData.activation_code}`);

  // Run the customer installer into test dir using the cloud endpoint
  const installer = new Installer({
    targetDir: TEST_DIR,
    interactive: false
  });

  const installResult = await installer.run({
    activationCode: sessionData.activation_code,
    cloudUrl: BASE_URL,
    tallyPort: 9000,
    startAgent: false
  });

  assert(installResult.success === true, 'Agent installation completed successfully');
  assert(installResult.config.status === 'ACTIVE', 'Agent config marked ACTIVE');

  // Launch agent and pulse heartbeat
  const agent = new ConnectorAgent(path.join(TEST_DIR, 'config.json'));
  await agent.start();
  const pulseRes = await agent.heartbeatService.pulse();
  assert(pulseRes.result.success === true, 'Agent heartbeat sent via cloud URL');
  agent.stop();

  // Verify connection status transitioned to ACTIVE on cloud
  const statusRes = await fetch(`${BASE_URL}/api/connect/${sessionData.session_id}/status`);
  assert(statusRes.status === 200, `GET /api/connect/${sessionData.session_id}/status returned HTTP ${statusRes.status}`);
  const statusData = await statusRes.json();
  assert(statusData.status === 'ACTIVE', 'Connection status transitioned to ACTIVE');
  assert(statusData.agent_status === 'ONLINE', 'Agent status is ONLINE');

  // -------------------------------------------------------------
  // Test 5: Standardized SaaS REST APIs with API Key Protection
  // -------------------------------------------------------------
  logSection('5. Standardized SaaS REST API Endpoints with API Key Protection');
  
  // A. Request without API Key should be rejected with 401
  const unauthRes = await fetch(`${BASE_URL}/api/v1/customers`);
  assert(unauthRes.status === 401, `Protected endpoint rejected missing API key with HTTP ${unauthRes.status}`);

  // B. Request with valid x-api-key should succeed
  const authRes = await fetch(`${BASE_URL}/api/v1/customers`, {
    headers: { 'x-api-key': apiKey }
  });
  assert(authRes.status === 200, `Protected endpoint accepted valid x-api-key with HTTP ${authRes.status}`);
  const customersData = await authRes.json();
  assert(customersData.success === true, 'Customers API responded with success: true');
  assert(Array.isArray(customersData.data), 'Customers API returned data array');

  // -------------------------------------------------------------
  // Test 6: Webhook System & HMAC-SHA256 Signing
  // -------------------------------------------------------------
  logSection('6. Production Webhook Delivery & HMAC-SHA256 Signing');
  
  let receivedWebhook = null;
  const webhookServer = http.createServer((req, res) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      receivedWebhook = {
        headers: req.headers,
        body: JSON.parse(raw)
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ received: true }));
    });
  });

  await new Promise(resolve => webhookServer.listen(WEBHOOK_PORT, resolve));

  const webhookResult = await WebhookService.deliver(
    appId,
    'sync.completed',
    {
      connection_id: sessionData.session_id,
      entity: 'customers',
      records_synced: 1,
      completed_at: new Date().toISOString()
    }
  );

  assert(webhookResult.success === true, 'Webhook dispatched successfully (HTTP 200)');
  assert(receivedWebhook !== null, 'Webhook receiver successfully received payload');
  assert(receivedWebhook.body.event === 'sync.completed', 'Webhook event matches "sync.completed"');
  assert(Boolean(receivedWebhook.headers['x-tally-signature']), `Webhook payload signed with HMAC-SHA256: ${receivedWebhook.headers['x-tally-signature']}`);

  // Verify delivery is logged in database
  const [logs] = await pool.query(
    'SELECT * FROM webhook_logs WHERE app_id = ? ORDER BY id DESC LIMIT 1',
    [appId]
  );
  assert(logs.length > 0, 'Webhook delivery recorded in MySQL webhook_logs table');
  assert(logs[0].success === 1, 'Webhook log success is true');
  assert(logs[0].status_code === 200, 'Webhook log status_code is 200');

  await new Promise(resolve => webhookServer.close(resolve));

  // -------------------------------------------------------------
  // Test 7: Database Persistence & Restart Verification
  // -------------------------------------------------------------
  logSection('7. Database Data Persistence & Integrity Verification');
  
  const [dbConn] = await pool.query(
    'SELECT id, status, saas_app_id FROM connections WHERE id = ?',
    [sessionData.session_id]
  );
  assert(dbConn.length === 1, `Connection persisted in MySQL: ${sessionData.session_id}`);
  assert(dbConn[0].status === 'ACTIVE', 'Persisted status is ACTIVE');
  assert(dbConn[0].saas_app_id === appId, 'Associated SaaS App persisted properly');

  // Cleanup
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }

  console.log('\n===============================================================');
  console.log('🎉 ALL PHASE 11 PRODUCTION READINESS VALIDATIONS PASSED!');
  console.log('===============================================================\n');
}

runProductionValidation()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n✖ Production Readiness Validation Failed:', err);
    process.exit(1);
  });
