/**
 * Minimal External Consumer Test for @tallyconnect/sdk
 * Proves both import syntaxes:
 *   import { connectTally, TallyConnect } from '@tallyconnect/sdk';
 *   import DefaultTallyConnect from '@tallyconnect/sdk';
 */

import assert from 'assert';
import crypto from 'crypto';
import { connectTally, TallyConnect } from '../../sdk/index.js';
import DefaultTallyConnect from '../../sdk/index.js';

const BASE_URL = process.env.CLOUD_URL || 'http://127.0.0.1:5001';

async function testSdkConsumer() {
  console.log('===============================================================');
  console.log('📦 EXTERNAL SDK CONSUMER EXPORT VALIDATION TEST');
  console.log('===============================================================\n');

  // 1. Verify export signatures
  console.log('▶ 1. Validating Module Exports...');
  assert.strictEqual(typeof connectTally, 'function', 'connectTally must be exported as a function');
  assert.strictEqual(typeof TallyConnect, 'function', 'TallyConnect must be exported as a class/constructor');
  assert.strictEqual(typeof DefaultTallyConnect, 'function', 'Default export must be TallyConnect');
  assert.strictEqual(TallyConnect, DefaultTallyConnect, 'Named TallyConnect must equal Default export');
  console.log('  ✔ Named exports { connectTally, TallyConnect } correctly exposed');
  console.log('  ✔ Default export TallyConnect correctly exposed');

  // 2. Setup dynamic developer and application to test real consumption
  console.log('\n▶ 2. Setting up Test SaaS Application...');
  const devEmail = `consumer_${Date.now()}@example.com`;
  const regRes = await fetch(`${BASE_URL}/api/developer/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'SDK Consumer App',
      email: devEmail,
      password: 'ConsumerPassword123!'
    })
  });
  const regData = await regRes.json();
  assert(regData.token, 'Developer registered successfully');

  const appRes = await fetch(`${BASE_URL}/api/developer/apps`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${regData.token}`
    },
    body: JSON.stringify({
      name: 'InvoiceSync SaaS',
      webhook_url: 'http://127.0.0.1:9999/webhook'
    })
  });
  const appData = await appRes.json();
  assert(appData.app && appData.app.api_key, 'SaaS App created with API credentials');
  const appId = appData.app.id;
  const apiKey = appData.app.api_key;
  console.log(`  ✔ App provisioned: ${appId}`);

  // 3. Test connectTally() helper function
  console.log('\n▶ 3. Testing connectTally() Helper Function...');
  const session = await connectTally({
    appId,
    userId: 'cust_acct_9981',
    companyName: 'Acme Traders',
    baseUrl: BASE_URL
  });

  assert(session.activationCode, 'connectTally returns activationCode');
  assert(session.connectionId, 'connectTally returns connectionId');
  assert(session.expiresAt, 'connectTally returns expiresAt');
  console.log(`  ✔ connectTally() succeeded. Activation Code: ${session.activationCode}, Connection ID: ${session.connectionId}`);

  // 4. Test TallyConnect class instance methods
  console.log('\n▶ 4. Testing new TallyConnect() Class Instance...');
  const client = new TallyConnect({
    apiKey,
    baseUrl: BASE_URL
  });

  const status = await client.getStatus(session.connectionId);
  assert.strictEqual(status.status, 'PENDING', 'New connection status is PENDING');
  console.log(`  ✔ client.getStatus() succeeded. Connection state: ${status.status}`);

  // 5. Test Webhook Signature verification static method
  console.log('\n▶ 5. Testing TallyConnect.verifyWebhookSignature()...');
  const secret = 'whsec_test_secret_123';
  const testPayload = JSON.stringify({ event: 'sync.completed', connection_id: session.connectionId });
  const testSig = crypto.createHmac('sha256', secret).update(testPayload).digest('hex');

  const isValid = TallyConnect.verifyWebhookSignature(testPayload, testSig, secret);
  assert.strictEqual(isValid, true, 'Webhook signature verification succeeds with matching secret');

  const isInvalid = TallyConnect.verifyWebhookSignature(testPayload, 'bad_signature', secret);
  assert.strictEqual(isInvalid, false, 'Webhook signature verification fails with bad signature');
  console.log('  ✔ TallyConnect.verifyWebhookSignature() verified correctly');

  console.log('\n===============================================================');
  console.log('✅ ALL SDK CONSUMER EXPORT & USAGE CHECKS PASSED');
  console.log('===============================================================\n');
}

testSdkConsumer().catch(err => {
  console.error('\n❌ SDK Consumer Test Failed:', err);
  process.exit(1);
});
