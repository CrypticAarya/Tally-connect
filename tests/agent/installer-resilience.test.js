import fs from 'fs';
import path from 'path';
import os from 'os';
import assert from 'assert';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { Installer } from '../../connector-agent/src/installer.js';
import { ConnectorAgent } from '../../connector-agent/src/agent.js';
import { getSystemErrorLogPath } from '../../connector-agent/src/cloudConfig.js';
import { pool } from '../../server/src/db/mysql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const DIST_DIR = path.resolve(rootDir, 'connector-agent', 'dist');
const HOST_BIN = path.resolve(DIST_DIR, 'tally-connect-agent-host');
const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:5001';
const TEST_SANDBOX = path.resolve(rootDir, 'sandbox_installer_test');

async function runInstallerResilienceTest() {
  console.log('===============================================================');
  console.log('🧪 TEST: INSTALLER RESILIENCE & ACTIVATION PIPELINE');
  console.log('===============================================================');

  // Setup sandbox
  if (fs.existsSync(TEST_SANDBOX)) {
    fs.rmSync(TEST_SANDBOX, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_SANDBOX, { recursive: true });

  // -------------------------------------------------------------------
  // 1. Unreachable Cloud Failure Path
  // -------------------------------------------------------------------
  console.log('\n▶ 1. Testing Cloud Connection Failure Handling...');
  const failTargetDir = path.join(TEST_SANDBOX, 'fail_run');
  fs.mkdirSync(failTargetDir, { recursive: true });

  const failInstaller = new Installer({
    targetDir: failTargetDir,
    interactive: false
  });

  const failResult = await failInstaller.run({
    activationCode: 'TC-9999',
    cloudUrl: 'http://127.0.0.1:59999', // Deliberately unreachable port
    tallyPort: 9000,
    startAgent: false
  });

  assert.strictEqual(failResult.success, false, 'Installer must return success: false when cloud unreachable');
  assert.ok(
    failResult.error.includes("We couldn't connect to Tally Connect"),
    `Customer error must be friendly, received: "${failResult.error}"`
  );
  assert.ok(
    !failResult.error.includes('127.0.0.1:59999'),
    'Customer error must not leak internal network URLs'
  );
  console.log('  ✔ Customer-safe error returned without leaking internal URLs');

  // Verify technical error was recorded to log file
  const localErrorLog = path.join(failTargetDir, 'logs', 'errors.log');
  assert.ok(fs.existsSync(localErrorLog), 'Technical error logged to target directory logs/errors.log');
  const logContent = fs.readFileSync(localErrorLog, 'utf-8');
  assert.ok(logContent.includes('cloud_health_check'), 'Log file contains technical step context');
  console.log('  ✔ Technical error details persisted to error log');

  // -------------------------------------------------------------------
  // 2. Invalid Activation Code Failure Path
  // -------------------------------------------------------------------
  console.log('\n▶ 2. Testing Invalid Activation Code Path...');
  const invalidCodeDir = path.join(TEST_SANDBOX, 'invalid_code');
  fs.mkdirSync(invalidCodeDir, { recursive: true });

  const invalidInstaller = new Installer({
    targetDir: invalidCodeDir,
    interactive: false
  });

  const invalidResult = await invalidInstaller.run({
    activationCode: 'TC-INVALID-XYZ',
    cloudUrl: SERVER_URL,
    tallyPort: 9000,
    startAgent: false
  });

  assert.strictEqual(invalidResult.success, false, 'Invalid code must return success: false');
  assert.ok(
    invalidResult.error.includes('could not be verified'),
    `Friendly error expected, received: "${invalidResult.error}"`
  );
  console.log('  ✔ Invalid activation code rejected with friendly error');

  // -------------------------------------------------------------------
  // 3. Successful Real Activation Path
  // -------------------------------------------------------------------
  console.log('\n▶ 3. Testing Successful Real Activation Pipeline...');
  
  // Create test connection session
  const saasAppRes = await fetch(`${SERVER_URL}/api/internal/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Resilience Test SaaS ERP',
      redirect_url: 'https://test-saas.com/callback'
    })
  });
  const saasAppData = await saasAppRes.json();
  const apiKey = saasAppData.app.api_key;

  const initRes = await fetch(`${SERVER_URL}/api/connect/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({
      saas_app_id: saasAppData.app.id,
      external_user_id: 'usr_resilience_test_user',
      company_name: 'Resilience Test Corp Ltd'
    })
  });
  const initData = await initRes.json();
  const validCode = initData.activation_code;
  const connectionId = initData.connection_id;
  assert.ok(validCode && validCode.startsWith('TC-'), `Fresh activation code obtained: ${validCode}`);

  const successDir = path.join(TEST_SANDBOX, 'success_run');
  fs.mkdirSync(successDir, { recursive: true });

  const successInstaller = new Installer({
    targetDir: successDir,
    interactive: false
  });

  const successResult = await successInstaller.run({
    activationCode: validCode,
    cloudUrl: SERVER_URL,
    tallyPort: 9000,
    startAgent: false
  });

  assert.strictEqual(successResult.success, true, 'Installer must succeed with valid activation code');
  assert.strictEqual(successResult.config.status, 'ACTIVE', 'Agent config marked ACTIVE');
  assert.strictEqual(successResult.config.connectionId, connectionId, 'Connection ID saved correctly');
  assert.ok(successResult.config.agentToken, 'Agent token issued and saved');
  console.log(`  ✔ Agent activated successfully: connection_id=${connectionId}, agent_id=${successResult.config.agentId}`);

  // Verify connection status in database is now ACTIVE
  const [connRows] = await pool.query('SELECT status, agent_id FROM connections WHERE id = ?', [connectionId]);
  assert.strictEqual(connRows[0].status, 'ACTIVE', 'MySQL connection status transitioned to ACTIVE');
  assert.ok(connRows[0].agent_id, 'Agent ID linked in database');
  console.log('  ✔ Database connection record verified ACTIVE');

  // Verify Heartbeat and Agent startup with saved config
  const agent = new ConnectorAgent(path.join(successDir, 'config.json'));
  await agent.start();
  assert.strictEqual(agent.isRunning, true, 'Agent daemon running with saved credentials');
  const pulseRes = await agent.heartbeatService.pulse();
  assert.strictEqual(pulseRes.result.success, true, 'Heartbeat pulse acknowledged by Cloud API');
  console.log('  ✔ Heartbeat pulse dispatched and acknowledged');
  agent.stop();

  // -------------------------------------------------------------------
  // 4. Standalone Host Binary Non-Interactive Tests
  // -------------------------------------------------------------------
  console.log('\n▶ 4. Testing Standalone Binary Failure Handling...');
  if (fs.existsSync(HOST_BIN)) {
    try {
      execFileSync(HOST_BIN, [
        '--install',
        '--non-interactive',
        '--code', 'TC-FAIL',
        '--cloud-url', 'http://127.0.0.1:59999',
        '--target-dir', path.join(TEST_SANDBOX, 'bin_fail')
      ], { encoding: 'utf-8', stdio: 'pipe' });
      assert.fail('Binary should exit with non-zero on failure');
    } catch (binErr) {
      assert.strictEqual(binErr.status, 1, 'Binary exits with code 1 on failure');
      assert.ok(
        binErr.stdout.includes("We couldn't connect to Tally Connect"),
        'Binary prints customer-safe error'
      );
      assert.ok(
        !binErr.stderr.includes('ExperimentalWarning'),
        'Binary suppresses Node ExperimentalWarning'
      );
      console.log('  ✔ Standalone binary exits with code 1, customer-safe error, and zero experimental warnings');
    }
  }

  // Teardown sandbox
  try {
    fs.rmSync(TEST_SANDBOX, { recursive: true, force: true });
  } catch (_) {}

  console.log('\n===============================================================');
  console.log('🎉 ALL INSTALLER RESILIENCE & ACTIVATION CHECKS PASSED!');
  console.log('===============================================================\n');
}

runInstallerResilienceTest().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('\n✖ Installer Resilience Test Failed:', err);
  process.exit(1);
});
