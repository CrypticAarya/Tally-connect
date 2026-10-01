/**
 * Phase 13 Architecture & Refactor Regression Test
 * Validates all 14 core system capabilities without internal database hacking.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TallyConnect } from '../../sdk/tallyConnect.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

const SERVER_URL = process.env.API_URL || 'http://127.0.0.1:5001';

function assert(condition, message) {
  if (!condition) {
    console.error(`✖ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✔ ${message}`);
}

async function runRegressionSuite() {
  console.log('===============================================================');
  console.log('🏛️  PHASE 13 ARCHITECTURE REFACTOR REGRESSION TEST');
  console.log('===============================================================\n');

  // 1. Server starts
  console.log('▶ 1. Verifying Server Status...');
  const healthRes = await fetch(`${SERVER_URL}/api/health`);
  assert(healthRes.ok, `Server responding on ${SERVER_URL}`);

  // 2. Database connects
  console.log('\n▶ 2. Verifying Database Connectivity...');
  const readyRes = await fetch(`${SERVER_URL}/ready`);
  assert(readyRes.ok, 'Database is responsive and connected via /ready');

  // 3. Health endpoint works
  console.log('\n▶ 3. Verifying Health Payload Structure...');
  const healthData = await healthRes.json();
  assert(healthData.status === 'OK' && healthData.service === 'tally-connect-server', 'Health endpoint reports status OK');

  // 4. Developer authentication works
  console.log('\n▶ 4. Verifying Developer Registration & Authentication...');
  const devEmail = `refactor_dev_${Date.now()}@example.com`;
  const devRes = await fetch(`${SERVER_URL}/api/developer/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Refactor Audit Lead',
      email: devEmail,
      password: 'SecurePassword123!'
    })
  });
  const devData = await devRes.json();
  assert(devData.success === true && Boolean(devData.token), 'Developer account created with JWT token');

  // 5. App creation works
  console.log('\n▶ 5. Verifying App Creation...');
  const appRes = await fetch(`${SERVER_URL}/api/developer/apps`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${devData.token}`
    },
    body: JSON.stringify({
      name: 'Architecture Test App',
      webhook_url: 'https://webhook.site/test'
    })
  });
  const appData = await appRes.json();
  assert(appData.success === true && Boolean(appData.app?.api_key), 'App created with API Key & Secret');
  const apiKey = appData.app.api_key;
  const apiSecret = appData.app.api_secret;

  // 6. Connection creation works
  console.log('\n▶ 6. Verifying Connection Creation & Activation Code...');
  const connRes = await fetch(`${SERVER_URL}/api/connect/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({
      app_id: appData.app.id,
      external_user_id: 'usr_refactor_001',
      company_name: 'Universal Hydraulics Ltd'
    })
  });
  const connData = await connRes.json();
  assert(connData.success === true && Boolean(connData.activation_code), 'Connection session created with activation code');
  const connectionId = connData.connection_id;
  const activationCode = connData.activation_code;

  // 7. Agent activation works
  console.log('\n▶ 7. Verifying Agent Activation...');
  const actRes = await fetch(`${SERVER_URL}/api/agent/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      activation_code: activationCode,
      machine_name: 'REFACTOR-TEST-HOST',
      active_company: 'Universal Hydraulics Ltd'
    })
  });
  const actData = await actRes.json();
  assert(actData.success === true && Boolean(actData.agent_token), 'Agent activated with Bearer token');
  const agentToken = actData.agent_token;

  // 8. Heartbeat works
  console.log('\n▶ 8. Verifying Agent Heartbeat Telemetry...');
  const hbRes = await fetch(`${SERVER_URL}/api/agent/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${agentToken}`
    },
    body: JSON.stringify({
      status: 'ONLINE',
      active_company: 'Universal Hydraulics Ltd',
      tally_status: 'ONLINE'
    })
  });
  const hbData = await hbRes.json();
  assert(hbData.success === true, 'Heartbeat acknowledged by Cloud API');

  // 9. Permission checks work
  console.log('\n▶ 9. Verifying Permission Checks...');
  const permRes = await fetch(`${SERVER_URL}/api/connect/${connectionId}/permissions`, {
    headers: { 'x-api-key': apiKey }
  });
  const permData = await permRes.json();
  assert(permData.success === true && permData.permissions != null, 'Permissions retrieved successfully');

  // 10. Sync works
  console.log('\n▶ 10. Verifying Agent Data Upload & Cloud Cache...');
  const uploadRes = await fetch(`${SERVER_URL}/api/agent/sync/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${agentToken}`
    },
    body: JSON.stringify({
      entity: 'customers',
      records: [
        {
          id: 'cust-refactor-01',
          name: 'Global Valve Technologies Ltd',
          gstin: '27AABCG1234F1Z8',
          address: 'Plot 42, Hinjewadi Phase 2, Pune, Maharashtra, 411057'
        }
      ]
    })
  });
  const uploadData = await uploadRes.json();
  assert(uploadData.success === true, 'Agent sync records successfully uploaded to Cloud cache');

  // 11. API data retrieval works
  console.log('\n▶ 11. Verifying SaaS Data Retrieval API...');
  const client = new TallyConnect({ apiKey, baseUrl: SERVER_URL });
  const custRes = await client.getCustomers(connectionId);
  const custArray = Array.isArray(custRes) ? custRes : (custRes.data || []);
  assert(custArray.length > 0, 'SaaS retrieved permitted customer records via SDK');
  assert(custArray[0].name === 'Global Valve Technologies Ltd', 'Customer name matches synchronized data');

  // 12. Webhooks work
  console.log('\n▶ 12. Verifying Webhook Signature Verification...');
  const testPayload = JSON.stringify({ event: 'sync.completed', connectionId, timestamp: new Date().toISOString() });
  const crypto = await import('crypto');
  const hmac = crypto.createHmac('sha256', apiSecret).update(testPayload).digest('hex');
  const signatureHeader = `sha256=${hmac}`;
  const isSignatureValid = TallyConnect.verifyWebhookSignature(testPayload, signatureHeader, apiSecret);
  assert(isSignatureValid === true, 'Webhook HMAC-SHA256 signature verified with SDK');

  // 13. Windows agent builds
  console.log('\n▶ 13. Verifying Windows Agent Executable Artifacts...');
  const agentExePath = path.join(rootDir, 'connector-agent', 'dist', 'TallyConnectAgent.exe');
  assert(fs.existsSync(agentExePath), `Windows Agent Executable exists: ${path.basename(agentExePath)}`);

  // 14. Windows installer builds
  console.log('\n▶ 14. Verifying Windows Setup Wizard Artifacts...');
  const setupExePath = path.join(rootDir, 'connector-agent', 'dist', 'TallyConnectAgentSetup.exe');
  assert(fs.existsSync(setupExePath), `Windows Setup Wizard exists: ${path.basename(setupExePath)}`);

  console.log('\n===============================================================');
  console.log('🎉 ALL 14 ARCHITECTURAL REGRESSION CHECKS PASSED!');
  console.log('===============================================================\n');
}

runRegressionSuite().catch(err => {
  console.error('\n✖ Architectural Regression Suite FAILED:', err);
  process.exit(1);
});
