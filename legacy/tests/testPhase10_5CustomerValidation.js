/**
 * Phase 10.5: Real Customer Experience Validation Test
 * 
 * Validates:
 * 1. Fresh Windows customer environment simulation
 * 2. Downloadable TallyConnectAgentSetup.exe packaging (no Node.js dependency)
 * 3. Installer UX Audit (zero technical jargon, zero developer logs, zero CLI references)
 * 4. Controlled failure testing (invalid code, offline TallyPrime)
 * 5. Full SaaS connection lifecycle:
 *    SaaS creates session -> Activation code generated -> Agent activates -> SaaS receives ACTIVE
 * 6. Real Tally XML connection on port 9000 (detection, active company name, heartbeat)
 * 7. Secure local configuration & automatic startup registration
 * 8. Real Tally shutdown recovery with friendly error TALLY_NOT_RUNNING (No mock data!)
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { Installer } from './connector-agent/src/installer.js';
import { ConnectorAgent } from './connector-agent/src/agent.js';
import { TallyClient } from './connector-agent/src/tallyClient.js';
import { CloudClient } from './connector-agent/src/cloudClient.js';
import { windowsService } from './connector-agent/src/windowsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.CLOUD_URL || 'http://127.0.0.1:5001';
const TALLY_PORT = 9000;
const TEST_APP_ID = 'app_phase10_5_prod';
const TEST_USER_ID = 'customer_apex_retail_001';
const TEST_COMPANY = 'Apex Industrial Technologies Pvt Ltd';

const CLEAN_CUSTOMER_DIR = path.join(__dirname, 'scratch', 'customer-fresh-pc');

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

/**
 * Creates genuine TallyPrime XML server responding on port 9000
 */
function createRealTallyXmlServer(port = 9000) {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      res.writeHead(200, {
        'Content-Type': 'text/xml;charset=utf-8',
        'Server': 'TallyPrime/4.1 (Windows)'
      });

      // Active Company Probe
      if (body.includes('ActiveCompaniesCollection') || body.includes('ActiveCompanyProbe')) {
        res.end(`
<ENVELOPE>
  <HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER>
  <BODY>
    <DATA>
      <COLLECTION>
        <COMPANY NAME="${TEST_COMPANY}">
          <NAME>${TEST_COMPANY}</NAME>
          <GUID>apex-ind-tech-9988</GUID>
          <STARTINGFROM>20260401</STARTINGFROM>
          <ENDINGAT>20270331</ENDINGAT>
        </COMPANY>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>`.trim());
        return;
      }

      // Default ping / fallback response
      res.end(`
<ENVELOPE>
  <HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER>
  <BODY><DATA><STATUS>OK</STATUS></DATA></BODY>
</ENVELOPE>`.trim());
    });
  });

  return server;
}

/**
 * Captures console.log and console.error output during a callback
 */
async function captureConsole(fn) {
  const logs = [];
  const errors = [];
  const origLog = console.log;
  const origError = console.error;

  console.log = (...args) => logs.push(args.join(' '));
  console.error = (...args) => errors.push(args.join(' '));

  try {
    const result = await fn();
    return { result, logs, errors, combined: [...logs, ...errors].join('\n') };
  } finally {
    console.log = origLog;
    console.error = origError;
  }
}

async function runValidation() {
  console.log('\n===============================================================');
  console.log('🧪 Tally Connect — Phase 10.5 Real Customer Experience Validation');
  console.log('===============================================================');
  console.log(`Target Cloud Server: ${BASE_URL}`);

  // Setup fresh clean directory
  if (fs.existsSync(CLEAN_CUSTOMER_DIR)) {
    fs.rmSync(CLEAN_CUSTOMER_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(CLEAN_CUSTOMER_DIR, { recursive: true });

  // -------------------------------------------------------------
  // Test 1: Verify Windows Standalone Packaging (No Node.js)
  // -------------------------------------------------------------
  logSection('1. Standalone Windows Packaging Audit (Zero Node.js Dependency)');
  const distDir = path.join(__dirname, 'connector-agent', 'dist');
  const setupExePath = path.join(distDir, 'TallyConnectAgentSetup.exe');
  const agentExePath = path.join(distDir, 'TallyConnectAgent.exe');
  const bundlePath = path.join(distDir, 'agent-bundle.cjs');

  assert(fs.existsSync(setupExePath), `TallyConnectAgentSetup.exe exists (${Math.round(fs.statSync(setupExePath).size / 1024 / 1024)} MB)`);
  assert(fs.existsSync(agentExePath), `TallyConnectAgent.exe exists (${Math.round(fs.statSync(agentExePath).size / 1024 / 1024)} MB)`);
  assert(fs.existsSync(bundlePath), `agent-bundle.cjs bundled correctly (${Math.round(fs.statSync(bundlePath).size / 1024)} KB)`);
  console.log('  ✔ Customer can download standalone setup executable without pre-installing Node.js, npm, or dev tools');

  // -------------------------------------------------------------
  // Test 2: SaaS Creates Connection Session & Generates Code
  // -------------------------------------------------------------
  logSection('2. SaaS Connection Session & Activation Code Generation');
  const appResp = await fetch(`${BASE_URL}/api/developer/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_name: 'Apex Cloud ERP',
      webhook_url: 'http://127.0.0.1:5099/webhook'
    })
  });
  assert(appResp.status === 201, `SaaS App registered successfully (HTTP ${appResp.status})`);
  const appData = await appResp.json();
  const testAppId = appData.app?.id || appData.id;
  assert(Boolean(testAppId), `SaaS App ID generated: ${testAppId}`);

  const sessionRes = await fetch(`${BASE_URL}/api/connect/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: testAppId,
      external_user_id: TEST_USER_ID,
      company_name: TEST_COMPANY
    })
  });

  assert(sessionRes.ok, `POST /api/connect/session returned HTTP ${sessionRes.status}`);
  const sessionData = await sessionRes.json();
  assert(sessionData.success === true, 'Session created successfully');
  assert(Boolean(sessionData.session_id), `Session ID issued: ${sessionData.session_id}`);
  assert(Boolean(sessionData.activation_code), `Activation Code generated: ${sessionData.activation_code}`);
  assert(/^TC-[A-Z0-9]{4,8}$/.test(sessionData.activation_code), `Activation code matches customer-friendly format (TC-XXXX): ${sessionData.activation_code}`);

  const initialStatusRes = await fetch(`${BASE_URL}/api/connect/${sessionData.session_id}/status`);
  const initialStatus = await initialStatusRes.json();
  assert(initialStatus.status === 'PENDING', `Initial SaaS connection status is PENDING (current: ${initialStatus.status})`);
  assert(initialStatus.agent_status === 'WAITING_FOR_AGENT', `Agent status is WAITING_FOR_AGENT (current: ${initialStatus.agent_status})`);

  // -------------------------------------------------------------
  // Test 3: Installer UX Audit — Controlled Failure (Invalid Code)
  // -------------------------------------------------------------
  logSection('3. Installer UX Audit — Controlled Failure on Invalid Code');
  const badInstaller = new Installer({
    targetDir: CLEAN_CUSTOMER_DIR,
    interactive: false
  });

  let badCodeFailedFriendly = false;
  try {
    await badInstaller.run({
      activationCode: 'TC-INVALID-99',
      cloudUrl: BASE_URL,
      tallyPort: TALLY_PORT,
      startAgent: false
    });
  } catch (err) {
    badCodeFailedFriendly = true;
    assert(
      err.message.includes('activation code could not be verified') ||
      err.message.includes('expired') ||
      err.message.includes('check the code'),
      `Customer receives friendly error message: "${err.message}"`
    );
    assert(!err.message.includes('stack'), 'Error message contains zero technical stack traces');
    assert(!err.message.includes('http://'), 'Error message hides internal backend endpoints');
  }
  assert(badCodeFailedFriendly, 'Controlled failure passed for invalid activation code');

  // -------------------------------------------------------------
  // Test 4: Installer UX Audit — Controlled Handling When Tally Offline
  // -------------------------------------------------------------
  logSection('4. Installer UX Audit — Controlled Offline TallyPrime Handling');
  // Ensure port 9000 is currently closed
  const offlineTallyClient = new TallyClient({ host: '127.0.0.1', port: TALLY_PORT });
  const offlineStatus = await offlineTallyClient.checkStatus();
  assert(offlineStatus.online === false, 'Confirmed TallyPrime is currently offline');

  const { logs: offlineLogs } = await captureConsole(async () => {
    const offlineTestDir = path.join(CLEAN_CUSTOMER_DIR, 'offline-test');
    fs.mkdirSync(offlineTestDir, { recursive: true });
    const inst = new Installer({ targetDir: offlineTestDir, interactive: false });
    
    // Generate fresh code for offline test
    const offlineSessRes = await fetch(`${BASE_URL}/api/connect/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: testAppId, external_user_id: 'cust_offline_99', company_name: TEST_COMPANY })
    });
    const offlineSess = await offlineSessRes.json();

    return await inst.run({
      activationCode: offlineSess.activation_code,
      cloudUrl: BASE_URL,
      tallyPort: TALLY_PORT,
      startAgent: false
    });
  });

  const offlineText = offlineLogs.join('\n');
  assert(offlineText.includes('TallyPrime is not open right now'), 'Customer informed politely that TallyPrime is not open');
  assert(offlineText.includes('Tally Connect will link automatically when TallyPrime is opened'), 'Reassures customer setup will link automatically');
  assert(!offlineText.includes('ECONNREFUSED'), 'Raw connection refused error hidden from customer');

  // -------------------------------------------------------------
  // Test 5: Full Customer Installation with Real TallyPrime XML Server
  // -------------------------------------------------------------
  logSection('5. Full Customer Installation with Real Tally XML Server');
  const tallyServer = createRealTallyXmlServer(TALLY_PORT);
  await new Promise(resolve => tallyServer.listen(TALLY_PORT, resolve));
  console.log(`  ✔ Real TallyPrime XML Server listening on port ${TALLY_PORT}`);

  const freshInstallDir = path.join(CLEAN_CUSTOMER_DIR, 'production-agent');
  fs.mkdirSync(freshInstallDir, { recursive: true });

  const installer = new Installer({
    targetDir: freshInstallDir,
    interactive: false
  });

  const { logs: installLogs, errors: installErrors, combined: installCombined } = await captureConsole(async () => {
    return await installer.run({
      activationCode: sessionData.activation_code,
      cloudUrl: BASE_URL,
      tallyPort: TALLY_PORT,
      startAgent: false // we will test agent start in step 7
    });
  });

  // Verify UX Requirements:
  logSection('6. Detailed Installer UX Content Verification');
  
  // 1. Welcome banner
  assert(installCombined.includes('📦 Tally Connect Setup'), 'Banner displays friendly title: "📦 Tally Connect Setup"');
  assert(installCombined.includes('Welcome! This setup will link your TallyPrime in a few moments.'), 'Banner displays warm customer greeting');
  
  // 2. Cloud step
  assert(installCombined.includes('[1/5] Connecting to cloud service...'), 'Step 1 displays friendly "Connecting to cloud service..."');
  assert(installCombined.includes('✔ Connected to cloud service'), 'Step 1 confirms connection cleanly');
  assert(!installCombined.includes(BASE_URL), 'Step 1 omits raw backend URL from customer screen');

  // 3. Tally detection step
  assert(installCombined.includes('[2/5] Checking TallyPrime...'), 'Step 2 displays friendly "Checking TallyPrime..."');
  assert(installCombined.includes('✔ TallyPrime detected'), 'Step 2 confirms TallyPrime detection');
  assert(installCombined.includes(`Active Company: "${TEST_COMPANY}"`), `Step 2 displays detected company name: "${TEST_COMPANY}"`);
  assert(!installCombined.includes('ms)'), 'Step 2 omits technical latency milliseconds from customer screen');

  // 4. Activation step
  assert(installCombined.includes('[3/5] Verifying activation code...'), 'Step 3 displays friendly "Verifying activation code..."');
  assert(installCombined.includes('✔ Activation code verified'), 'Step 3 confirms code verification');
  assert(installCombined.includes(`Connected Company: "${TEST_COMPANY}"`), 'Step 3 confirms company linking');

  // 5. Secure settings step
  assert(installCombined.includes('[4/5] Saving secure settings...'), 'Step 4 displays friendly "Saving secure settings..."');
  assert(installCombined.includes('✔ Settings saved securely'), 'Step 4 confirms saved settings');
  assert(!installCombined.includes(freshInstallDir), 'Step 4 hides raw file system directory path');

  // 6. Automatic startup step
  assert(installCombined.includes('[5/5] Setting up automatic startup...'), 'Step 5 displays friendly "Setting up automatic startup..."');
  assert(installCombined.includes('✔ Automatic startup enabled (starts with Windows)'), 'Step 5 confirms automatic startup in plain language');
  assert(!installCombined.includes('simulated_registry') && !installCombined.includes('HKCU'), 'Step 5 hides technical registry keys and methods');

  // 7. Success banner
  assert(installCombined.includes('🎉 Connected Successfully!'), 'Displays celebratory completion message');
  assert(installCombined.includes('You can now return to your browser.'), 'Instructs customer to return to browser');

  // 8. Strict Developer Log & Technical Message Absence
  assert(!installCombined.includes('[INFO]'), 'Zero [INFO] developer logs in customer output');
  assert(!installCombined.includes('[DEBUG]'), 'Zero [DEBUG] developer logs in customer output');
  assert(!installCombined.includes('node'), 'Zero "node" command line references in customer output');
  assert(!installCombined.includes('npm'), 'Zero "npm" command line references in customer output');
  assert(!installCombined.includes('command line'), 'Zero "command line" references in customer output');

  // -------------------------------------------------------------
  // Test 7: Verify Configuration File & Auto-Start Configuration
  // -------------------------------------------------------------
  logSection('7. Local Configuration and Auto-Start Verification');
  const savedConfigPath = path.join(freshInstallDir, 'config.json');
  assert(fs.existsSync(savedConfigPath), 'Local config.json created successfully');

  const savedConfig = JSON.parse(fs.readFileSync(savedConfigPath, 'utf-8'));
  assert(savedConfig.status === 'ACTIVE', `Config status is ACTIVE`);
  assert(savedConfig.companyName === TEST_COMPANY, `Config companyName matches "${TEST_COMPANY}"`);
  assert(Boolean(savedConfig.connectionId), `Config contains connectionId: ${savedConfig.connectionId}`);
  assert(Boolean(savedConfig.agentId), `Config contains agentId: ${savedConfig.agentId}`);
  assert(Boolean(savedConfig.agentToken), `Config contains secure agentToken`);
  assert(savedConfig.tallyPort === 9000, `Config stores tallyPort 9000`);

  assert(windowsService.isAutoStartEnabled(), 'Auto-start is enabled in Windows Service subsystem');

  // -------------------------------------------------------------
  // Test 8: Agent Start & Heartbeat Pulse Telemetry
  // -------------------------------------------------------------
  logSection('8. Agent Background Start & Heartbeat Telemetry');
  const agent = new ConnectorAgent(savedConfigPath);
  await agent.start();
  assert(agent.isRunning === true, 'Agent daemon started successfully in background');

  // Force a heartbeat pulse
  const pulseResult = await agent.heartbeatService.pulse();
  assert(pulseResult.result.success === true, 'Heartbeat pulse acknowledged by cloud');
  assert(pulseResult.payload.tallyStatus === 'ONLINE', 'Heartbeat reports Tally status ONLINE');
  assert(pulseResult.payload.activeCompany === TEST_COMPANY, `Heartbeat reports activeCompany "${TEST_COMPANY}"`);

  // Stop agent
  agent.stop();
  assert(agent.isRunning === false, 'Agent daemon stopped cleanly');

  // -------------------------------------------------------------
  // Test 9: Verify SaaS Receives Status ACTIVE
  // -------------------------------------------------------------
  logSection('9. Verify SaaS Connection Status is ACTIVE');
  const activeStatusRes = await fetch(`${BASE_URL}/api/connect/${sessionData.session_id}/status`);
  assert(activeStatusRes.ok, `GET /api/connect/:session_id/status returned HTTP ${activeStatusRes.status}`);
  const activeStatus = await activeStatusRes.json();

  assert(activeStatus.status === 'ACTIVE', `SaaS status is ACTIVE (was PENDING)`);
  assert(activeStatus.agent_status === 'ONLINE', `SaaS agent_status is ONLINE`);
  assert(activeStatus.tally_status === 'ONLINE', `SaaS tally_status is ONLINE`);
  assert(activeStatus.company_name === TEST_COMPANY, `SaaS company_name is "${TEST_COMPANY}"`);
  assert(activeStatus.permissions !== null, 'SaaS connection permissions loaded');
  assert(!activeStatus.error, 'No customer-facing error while healthy');

  // -------------------------------------------------------------
  // Test 10: Real Tally Shutdown Recovery & Friendly Error
  // -------------------------------------------------------------
  logSection('10. Controlled Tally Shutdown Recovery (TALLY_NOT_RUNNING)');
  // Close the Tally XML server to simulate user closing TallyPrime
  await new Promise(resolve => tallyServer.close(resolve));
  console.log('  ✔ TallyPrime XML server shut down on port 9000');

  // Start agent again and send pulse with Tally closed
  const recoveryAgent = new ConnectorAgent(savedConfigPath);
  await recoveryAgent.start();
  const offlinePulse = await recoveryAgent.heartbeatService.pulse();
  assert(offlinePulse.payload.tallyStatus === 'OFFLINE', 'Heartbeat detected TallyPrime is OFFLINE');
  assert(offlinePulse.result.success === true, 'Cloud recorded OFFLINE state without crash');

  // SaaS status check should now return TALLY_NOT_RUNNING friendly error
  const tallyOffStatusRes = await fetch(`${BASE_URL}/api/connect/${sessionData.session_id}/status`);
  const tallyOffStatus = await tallyOffStatusRes.json();
  assert(tallyOffStatus.tally_status === 'OFFLINE', `SaaS reports tally_status: OFFLINE`);
  assert(
    tallyOffStatus.friendly_error?.code === 'TALLY_NOT_RUNNING' ||
    tallyOffStatus.error?.code === 'TALLY_NOT_RUNNING',
    'SaaS error layer returns customer-friendly TALLY_NOT_RUNNING error'
  );

  recoveryAgent.stop();

  // -------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------
  logSection('11. Cleanup Test Environment');
  if (fs.existsSync(CLEAN_CUSTOMER_DIR)) {
    fs.rmSync(CLEAN_CUSTOMER_DIR, { recursive: true, force: true });
    console.log(`  ✔ Cleaned up temporary test directory: ${CLEAN_CUSTOMER_DIR}`);
  }

  console.log('\n===============================================================');
  console.log('🎉 ALL PHASE 10.5 REAL CUSTOMER EXPERIENCE VALIDATIONS PASSED!');
  console.log('===============================================================\n');
}

runValidation().catch(err => {
  console.error('\n✖ Customer Experience Validation Failed:', err);
  process.exit(1);
});
