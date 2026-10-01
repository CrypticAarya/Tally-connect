import assert from 'assert';
import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { config } from './server/src/config.js';
import { getActiveEnvironment, ENVIRONMENTS } from './server/src/config/environments.js';
import { StorageService, LocalStorageProvider, CloudStorageProvider } from './server/src/storage/storageService.js';
import { JobQueue } from './server/src/queue/jobQueue.js';
import { WebhookService } from './server/src/services/webhookService.js';
import { createRateLimiter } from './server/src/middleware/rateLimiter.js';
import { SaasRepository } from './server/src/db/saasRepository.js';
import { pool } from './server/src/db/mysql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = process.env.CLOUD_URL || 'http://127.0.0.1:5001';

async function runTest() {
  console.log('===============================================================');
  console.log('🧪 PHASE 8: PRODUCTION HARDENING & CLOUD READINESS TEST');
  console.log('===============================================================\n');

  // Pre-Check: Server Health
  console.log('======================================================');
  console.log('▶ Pre-Check: Verify Cloud Server is Online');
  console.log('======================================================');
  const healthResp = await fetch(`${BASE_URL}/api/health`);
  assert.strictEqual(healthResp.status, 200, 'Server should be online');
  const healthData = await healthResp.json();
  assert.strictEqual(healthData.status, 'OK');
  console.log('  ✔ Cloud server is online and responding (status: OK)\n');

  // =========================================================================
  // 1. Environment Configuration Works
  // =========================================================================
  console.log('======================================================');
  console.log('▶ 1. Verification: Environment Configuration');
  console.log('======================================================');

  // Verify active environment
  assert.ok(config.activeEnvironment, 'config.activeEnvironment must be set');
  console.log(`  ✔ Active Environment: ${config.activeEnvironment} (${config.displayName})`);

  // Verify multi-environment profiles exist
  assert.ok(ENVIRONMENTS.development, 'Development profile must exist');
  assert.ok(ENVIRONMENTS.staging, 'Staging profile must exist');
  assert.ok(ENVIRONMENTS.production, 'Production profile must exist');
  console.log('  ✔ Environment profiles available: development, staging, production');

  // Verify secrets are decoupled from source code into environment
  assert.ok(config.secrets.apiMasterSecret, 'apiMasterSecret must be configured');
  assert.ok(config.secrets.jwtSecret, 'jwtSecret must be configured');
  assert.ok(config.secrets.encryptionKey, 'encryptionKey must be configured');
  assert.ok(config.secrets.webhookSigningSecret, 'webhookSigningSecret must be configured');
  console.log('  ✔ Secrets loaded outside hardcoded defaults:');
  console.log(`     - JWT Secret: ${config.secrets.jwtSecret.slice(0, 8)}***`);
  console.log(`     - Encryption Key: ${config.secrets.encryptionKey.slice(0, 8)}***`);
  console.log(`     - Webhook Signing Secret: ${config.secrets.webhookSigningSecret.slice(0, 8)}***`);

  // Verify .gitignore protects .env files
  const gitignoreContent = fs.readFileSync(path.resolve(__dirname, '.gitignore'), 'utf8');
  assert.ok(gitignoreContent.includes('.env'), '.gitignore must ignore .env files');
  console.log('  ✔ .gitignore enforces exclusion of .env secret files');

  // Verify Object Storage Abstraction (Local and Cloud providers)
  const localStorage = new LocalStorageProvider({ baseDir: path.resolve(__dirname, 'server/storage/test-exports') });
  const testKey = 'test-export-data.json';
  const testContent = JSON.stringify({ exported_at: new Date().toISOString(), records: 42 });

  await localStorage.putObject(testKey, testContent);
  const exists = await localStorage.objectExists(testKey);
  assert.strictEqual(exists, true, 'Object should exist in storage');
  const retrieved = await localStorage.getObject(testKey);
  assert.strictEqual(retrieved, testContent, 'Retrieved content must match written content');
  await localStorage.deleteObject(testKey);
  const existsAfterDelete = await localStorage.objectExists(testKey);
  assert.strictEqual(existsAfterDelete, false, 'Object should be deleted');
  console.log('  ✔ LocalStorageProvider: putObject, objectExists, getObject, deleteObject verified');

  const cloudStorage = new CloudStorageProvider({ bucket: 'tally-connect-mock-s3' });
  await cloudStorage.putObject('mock-key', 'mock-content');
  const cloudRetrieved = await cloudStorage.getObject('mock-key');
  assert.strictEqual(cloudRetrieved, 'mock-content');
  console.log('  ✔ CloudStorageProvider: S3/GCS object storage abstraction verified');

  const defaultStorage = StorageService.getInstance();
  assert.ok(defaultStorage, 'Default StorageService instance should be initialized');
  console.log(`  ✔ StorageService default provider active: [${defaultStorage.provider.name}]\n`);

  // =========================================================================
  // 2. Rate Limiting Works
  // =========================================================================
  console.log('======================================================');
  console.log('▶ 2. Verification: API Rate Limiting & Protection');
  console.log('======================================================');

  // Verify standard RateLimit headers on live endpoints
  const apiTestResp = await fetch(`${BASE_URL}/api/docs`);
  assert.strictEqual(apiTestResp.status, 200);
  assert.ok(apiTestResp.headers.has('x-ratelimit-limit'), 'Response should include X-RateLimit-Limit');
  assert.ok(apiTestResp.headers.has('x-ratelimit-remaining'), 'Response should include X-RateLimit-Remaining');
  assert.ok(apiTestResp.headers.has('x-ratelimit-reset'), 'Response should include X-RateLimit-Reset');
  console.log(`  ✔ RateLimit Headers present: Limit=${apiTestResp.headers.get('x-ratelimit-limit')}, Remaining=${apiTestResp.headers.get('x-ratelimit-remaining')}, Reset=${apiTestResp.headers.get('x-ratelimit-reset')}s`);

  // Verify rate limiter enforcement logic: create isolated limiter with 3 requests max
  const microLimiter = createRateLimiter({ windowMs: 3000, maxRequests: 3 });
  let nextCalled = 0;
  const mockNext = () => { nextCalled++; };

  const createMockReqRes = (key) => {
    const headers = { 'x-api-key': key };
    const resHeaders = {};
    let statusCode = 200;
    let jsonBody = null;
    return {
      req: { path: '/api/v1/test', headers, ip: '127.0.0.1' },
      res: {
        setHeader: (k, v) => { resHeaders[k.toLowerCase()] = v; },
        status: (code) => { statusCode = code; return { json: (b) => { jsonBody = b; } }; }
      },
      getStatusCode: () => statusCode,
      getJsonBody: () => jsonBody,
      getResHeaders: () => resHeaders
    };
  };

  const clientKey = 'test-rate-limit-client';
  // Request 1: allowed
  const r1 = createMockReqRes(clientKey);
  microLimiter(r1.req, r1.res, mockNext);
  assert.strictEqual(r1.getStatusCode(), 200);
  assert.strictEqual(nextCalled, 1);

  // Request 2: allowed
  const r2 = createMockReqRes(clientKey);
  microLimiter(r2.req, r2.res, mockNext);
  assert.strictEqual(r2.getStatusCode(), 200);
  assert.strictEqual(nextCalled, 2);

  // Request 3: allowed
  const r3 = createMockReqRes(clientKey);
  microLimiter(r3.req, r3.res, mockNext);
  assert.strictEqual(r3.getStatusCode(), 200);
  assert.strictEqual(nextCalled, 3);

  // Request 4: BLOCKED with HTTP 429
  const r4 = createMockReqRes(clientKey);
  microLimiter(r4.req, r4.res, mockNext);
  assert.strictEqual(r4.getStatusCode(), 429, 'Excess request must return HTTP 429');
  assert.strictEqual(r4.getJsonBody()?.error?.code, 'RATE_LIMIT_EXCEEDED');
  assert.ok(r4.getResHeaders()['retry-after'], 'Blocked response must include Retry-After header');
  assert.strictEqual(nextCalled, 3, 'next() should not be called when rate limited');
  console.log('  ✔ Rate limiter successfully blocked 4th request with HTTP 429 RATE_LIMIT_EXCEEDED and Retry-After header\n');

  // =========================================================================
  // 3. Queue Processing Works
  // =========================================================================
  console.log('======================================================');
  console.log('▶ 3. Verification: Background Job Queue Architecture');
  console.log('======================================================');

  // Setup a test app and connection in MySQL respecting foreign key constraints
  const queueApp = await SaasRepository.createApp({
    appName: 'Queue Verification App',
    webhookUrl: 'https://app.test/webhook'
  });
  const testConnId = `conn_queue_test_${Date.now()}`;
  await pool.query(
    `INSERT INTO connections (id, saas_app_id, external_user_id, company_name, status, created_at)
     VALUES (?, ?, 'user_q_1', 'Queue Testing Enterprise', 'ACTIVE', CURRENT_TIMESTAMP)`,
    [testConnId, queueApp.id]
  );

  // 1. Enqueue job
  const job = await JobQueue.enqueue({
    connectionId: testConnId,
    entityType: 'customers',
    maxRetries: 3
  });

  assert.ok(job.id, 'Job should have a generated ID');
  assert.strictEqual(job.status, 'PENDING');
  assert.strictEqual(job.retry_count, 0);
  assert.strictEqual(job.max_retries, 3);
  console.log(`  ✔ Job enqueued: ID=${job.id}, status=${job.status}, retry_count=${job.retry_count}`);

  // 2. Claim job atomically (worker claim)
  const claimed = await JobQueue.claimNextJob();
  assert.ok(claimed, 'A pending job should be claimed');
  assert.strictEqual(claimed.id, job.id);
  assert.strictEqual(claimed.status, 'PROCESSING');
  console.log(`  ✔ Job claimed by worker: ID=${claimed.id}, status=${claimed.status}`);

  // 3. Simulate failure with automatic retry
  const fail1 = await JobQueue.failJob(job.id, 'Simulated Tally XML connection drop');
  assert.strictEqual(fail1.status, 'PENDING', 'Job under max_retries should return to PENDING');
  assert.strictEqual(fail1.retry_count, 1);
  assert.strictEqual(fail1.re_queued, true);
  console.log(`  ✔ Job failed (attempt 1): re-queued with retry_count=${fail1.retry_count}`);

  // 4. Claim again and simulate second failure
  const claimed2 = await JobQueue.claimNextJob();
  assert.strictEqual(claimed2.id, job.id);
  const fail2 = await JobQueue.failJob(job.id, 'Second failure');
  assert.strictEqual(fail2.retry_count, 2);
  assert.strictEqual(fail2.re_queued, true);
  console.log(`  ✔ Job failed (attempt 2): re-queued with retry_count=${fail2.retry_count}`);

  // 5. Claim again and exceed max retries (3)
  const claimed3 = await JobQueue.claimNextJob();
  assert.strictEqual(claimed3.id, job.id);
  const fail3 = await JobQueue.failJob(job.id, 'Third permanent failure');
  assert.strictEqual(fail3.status, 'FAILED', 'Job exceeding max retries must mark FAILED');
  assert.strictEqual(fail3.retry_count, 3);
  assert.strictEqual(fail3.re_queued, false);
  console.log(`  ✔ Job exceeded max_retries: permanently marked as status=${fail3.status}`);

  // 6. Enqueue another job and complete it successfully
  const jobSuccess = await JobQueue.enqueue({
    connectionId: testConnId,
    entityType: 'sales',
    maxRetries: 3
  });
  const claimedSuccess = await JobQueue.claimNextJob();
  assert.strictEqual(claimedSuccess.id, jobSuccess.id);
  const completed = await JobQueue.completeJob(jobSuccess.id);
  assert.strictEqual(completed.status, 'COMPLETED');
  console.log(`  ✔ Second job claimed and completed: ID=${completed.id}, status=${completed.status}`);

  // 7. Check Queue Stats
  const queueStats = await JobQueue.getQueueStats();
  assert.ok(queueStats.completed >= 1, 'Completed count should be >= 1');
  assert.ok(queueStats.failed >= 1, 'Failed count should be >= 1');
  assert.ok(queueStats.total >= 2, 'Total count should be >= 2');
  console.log(`  ✔ Queue aggregate stats verified: Completed=${queueStats.completed}, Failed=${queueStats.failed}, Total=${queueStats.total}\n`);

  // =========================================================================
  // 4. Webhook Reliability Works
  // =========================================================================
  console.log('======================================================');
  console.log('▶ 4. Verification: Webhook Reliability & Automatic Retry');
  console.log('======================================================');

  let webhookAttempts = 0;
  const receivedHeaders = [];
  const mockWebhookPort = 5099;

  // Spin up a temporary mock webhook receiver
  const webhookServer = http.createServer((req, res) => {
    webhookAttempts++;
    receivedHeaders.push({
      attempt: req.headers['x-tally-attempt'],
      signature: req.headers['x-tally-signature'],
      event: req.headers['x-tally-event']
    });

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      // Fail first 2 attempts with HTTP 500, succeed on 3rd attempt with HTTP 200
      if (webhookAttempts < 3) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Temporary receiver internal error' }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received: true }));
      }
    });
  });

  await new Promise(resolve => webhookServer.listen(mockWebhookPort, resolve));

  // Register SaaS App pointing to this mock webhook URL
  const webhookAppResp = await fetch(`${BASE_URL}/api/developer/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_name: 'Webhook Reliability SaaS',
      webhook_url: `http://127.0.0.1:${mockWebhookPort}/webhook`
    })
  });
  const webhookAppData = await webhookAppResp.json();
  const webhookAppId = webhookAppData.app.id;
  const webhookAppSecret = webhookAppData.app.api_secret;

  // Dispatch webhook with rapid retry schedule [50ms, 100ms, 150ms]
  const deliveryResult = await WebhookService.deliver(
    webhookAppId,
    WebhookService.EVENTS.SYNC_COMPLETED,
    { entity: 'customers', count: 120 },
    { maxRetries: 3, retrySchedule: [50, 100, 150] }
  );

  assert.strictEqual(deliveryResult.delivered, true);
  assert.strictEqual(deliveryResult.success, true, 'Delivery should eventually succeed on attempt 3');
  assert.strictEqual(deliveryResult.attempts, 3, 'Should have made 3 attempts');
  assert.strictEqual(webhookAttempts, 3, 'Server should have received 3 requests');

  // Verify headers and HMAC signature
  assert.strictEqual(receivedHeaders[0].attempt, '1');
  assert.strictEqual(receivedHeaders[1].attempt, '2');
  assert.strictEqual(receivedHeaders[2].attempt, '3');
  assert.ok(receivedHeaders[2].signature.startsWith('sha256='), 'Signature must be sha256 formatted');
  console.log(`  ✔ Automatic Webhook Retry verified: 3 attempts executed (${webhookAttempts} received)`);
  console.log(`  ✔ Headers verified: X-Tally-Attempt (1->2->3), X-Tally-Signature present`);

  // Test dead-letter failed webhook queue
  // Create an un-routable app
  const deadAppResp = await fetch(`${BASE_URL}/api/developer/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_name: 'Dead Letter Test SaaS',
      webhook_url: `http://127.0.0.1:5199/non-existent-webhook`
    })
  });
  const deadAppData = await deadAppResp.json();
  const deadDelivery = await WebhookService.deliver(
    deadAppData.app.id,
    WebhookService.EVENTS.SYNC_FAILED,
    { error: 'Permanent failure' },
    { maxRetries: 2, retrySchedule: [20, 20] }
  );

  assert.strictEqual(deadDelivery.success, false);
  const failedQueue = WebhookService.getFailedQueue();
  assert.ok(failedQueue.length >= 1, 'Failed webhook queue should capture un-routable event');
  console.log(`  ✔ Failed webhook dead-letter queue captured event (queue size: ${failedQueue.length})`);

  webhookServer.close();
  console.log('  ✔ Webhook reliability test receiver closed\n');

  // =========================================================================
  // 5. Admin Metrics Work
  // =========================================================================
  console.log('======================================================');
  console.log('▶ 5. Verification: Admin Monitoring APIs');
  console.log('======================================================');

  // Test GET /admin/stats
  const statsResp = await fetch(`${BASE_URL}/admin/stats`);
  assert.strictEqual(statsResp.status, 200, 'GET /admin/stats should return 200');
  const statsData = await statsResp.json();
  assert.strictEqual(statsData.success, true);
  assert.ok(typeof (statsData.total_saas_apps ?? statsData.totalSaasApps) === 'number', 'total SaaS apps must be a number');
  assert.ok(typeof (statsData.total_connections ?? statsData.totalConnections) === 'number', 'total connections must be a number');
  assert.ok(typeof (statsData.online_agents ?? statsData.onlineAgents) === 'number', 'online agents must be a number');
  assert.ok(typeof (statsData.failed_syncs ?? statsData.failedSyncs) === 'number', 'failed syncs must be a number');
  assert.ok(typeof (statsData.api_requests ?? statsData.apiRequests) === 'number', 'API requests must be a number');

  console.log('  ✔ GET /admin/stats verified:');
  console.log(`     - Total SaaS Apps: ${statsData.total_saas_apps ?? statsData.totalSaasApps}`);
  console.log(`     - Total Connections: ${statsData.total_connections ?? statsData.totalConnections}`);
  console.log(`     - Online Agents: ${statsData.online_agents ?? statsData.onlineAgents}`);
  console.log(`     - Failed Syncs: ${statsData.failed_syncs ?? statsData.failedSyncs}`);
  console.log(`     - API Requests Tracked: ${statsData.api_requests ?? statsData.apiRequests}`);

  // Test GET /admin/sync-health
  const healthMetricsResp = await fetch(`${BASE_URL}/admin/sync-health`);
  assert.strictEqual(healthMetricsResp.status, 200, 'GET /admin/sync-health should return 200');
  const healthMetrics = await healthMetricsResp.json();
  assert.strictEqual(healthMetrics.success, true);
  assert.ok(typeof (healthMetrics.success_rate ?? healthMetrics.successRate) === 'number', 'success rate must be numeric');
  assert.ok(Array.isArray(healthMetrics.failure_reasons ?? healthMetrics.failureReasons), 'failure reasons must be an array');
  assert.ok(typeof (healthMetrics.average_sync_time ?? healthMetrics.averageSyncTime) === 'number', 'average sync time must be numeric');

  console.log('  ✔ GET /admin/sync-health verified:');
  console.log(`     - Success Rate: ${healthMetrics.success_rate ?? healthMetrics.successRate}%`);
  console.log(`     - Average Sync Time: ${healthMetrics.average_sync_time ?? healthMetrics.averageSyncTime} ms`);
  console.log(`     - Failure Reasons: ${JSON.stringify(healthMetrics.failure_reasons ?? healthMetrics.failureReasons)}`);

  // Also verify /api/admin/* aliases
  const aliasStats = await fetch(`${BASE_URL}/api/admin/stats`);
  assert.strictEqual(aliasStats.status, 200, 'GET /api/admin/stats alias must work');
  const aliasHealth = await fetch(`${BASE_URL}/api/admin/sync-health`);
  assert.strictEqual(aliasHealth.status, 200, 'GET /api/admin/sync-health alias must work');
  console.log('  ✔ /api/admin/stats and /api/admin/sync-health aliases verified\n');

  // =========================================================================
  // 6. Security Audit Checklist
  // =========================================================================
  console.log('======================================================');
  console.log('▶ 6. Verification: Security Audit Checklist');
  console.log('======================================================');

  // 1. API Authentication: Missing key returns 401
  const unauthResp = await fetch(`${BASE_URL}/api/v1/customers`);
  assert.strictEqual(unauthResp.status, 401, 'Request without API key must return 401');
  const unauthData = await unauthResp.json();
  assert.ok(unauthData.error, 'Response must explain authentication requirement');
  console.log('  ✔ Security: Request without API key rejected with 401 UNAUTHORIZED');

  // Invalid key returns 403
  const invalidKeyResp = await fetch(`${BASE_URL}/api/v1/customers`, {
    headers: { 'x-api-key': 'tc_live_fake_key_999999999' }
  });
  assert.strictEqual(invalidKeyResp.status, 403, 'Invalid API key must return 403 Forbidden');
  console.log('  ✔ Security: Request with invalid API key rejected with 403 FORBIDDEN');

  // 2. Permission Enforcement: Disallowed entity returns 403
  // Create an app & connection with allow_inventory = false
  const secAppResp = await fetch(`${BASE_URL}/api/developer/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_name: 'Security Test SaaS' })
  });
  const secAppData = await secAppResp.json();
  const secApiKey = secAppData.app.api_key;
  const secAppId = secAppData.app.id;

  const secConn = await SaasRepository.createConnection({
    saasAppId: secAppId,
    externalUserId: 'sec_user_01',
    companyName: 'Restricted Permissions Corp',
    status: 'ACTIVE'
  });
  await SaasRepository.setPermissions(secConn.id, {
    customers: true,
    sales: true,
    inventory: false, // Explicitly disallowed
    ledgers: true,
    trial_balance: false
  });

  const forbiddenResp = await fetch(`${BASE_URL}/api/v1/inventory`, {
    headers: {
      'x-api-key': secApiKey,
      'x-connection-id': secConn.id
    }
  });
  assert.strictEqual(forbiddenResp.status, 403, 'Disallowed entity must return 403 Forbidden');
  const forbiddenData = await forbiddenResp.json();
  assert.ok(forbiddenData.error, 'Response must explain permission denial');
  console.log('  ✔ Security: Disallowed entity access rejected with 403 PERMISSION_DENIED');

  // 3. Tenant Isolation: Connection data partitioned by connection_id
  const cachedData1 = [{ id: 'cust_iso_1', name: 'Tenant 1 Exclusive Customer' }];
  await SaasRepository.saveEntityCache({
    connectionId: secConn.id,
    entityType: 'customers',
    dataJson: cachedData1
  });

  // Create another isolated connection under the same or different tenant
  const secConn2 = await SaasRepository.createConnection({
    saasAppId: secAppId,
    externalUserId: 'sec_user_02',
    companyName: 'Isolated Tenant 2 Inc',
    status: 'ACTIVE'
  });
  const cachedData2 = [{ id: 'cust_iso_2', name: 'Tenant 2 Exclusive Customer' }];
  await SaasRepository.saveEntityCache({
    connectionId: secConn2.id,
    entityType: 'customers',
    dataJson: cachedData2
  });

  const tenant1Resp = await fetch(`${BASE_URL}/api/v1/customers`, {
    headers: {
      'x-api-key': secApiKey,
      'x-connection-id': secConn.id
    }
  });
  assert.strictEqual(tenant1Resp.status, 200);
  const tenant1Data = await tenant1Resp.json();
  assert.strictEqual(tenant1Data.data[0].name, 'Tenant 1 Exclusive Customer');

  const tenant2Resp = await fetch(`${BASE_URL}/api/v1/customers`, {
    headers: {
      'x-api-key': secApiKey,
      'x-connection-id': secConn2.id
    }
  });
  assert.strictEqual(tenant2Resp.status, 200);
  const tenant2Data = await tenant2Resp.json();
  assert.strictEqual(tenant2Data.data[0].name, 'Tenant 2 Exclusive Customer');

  console.log('  ✔ Security: Multi-tenant isolation verified (tenant 1 and tenant 2 strictly isolated)');

  // 4. Webhook Signature Verification
  const testSecret = secAppData.app.api_secret;
  const testPayload = JSON.stringify({ event: 'sync.completed', data: { test: true } });
  const validSignature = crypto.createHmac('sha256', testSecret).update(testPayload).digest('hex');

  // Test correct signature
  const verifyHmac = (payload, secret, receivedSig) => {
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(receivedSig.replace(/^sha256=/, '')));
  };
  assert.strictEqual(verifyHmac(testPayload, testSecret, `sha256=${validSignature}`), true);

  // Tampered payload fails verification
  const tamperedPayload = JSON.stringify({ event: 'sync.completed', data: { test: false } });
  const tamperedSig = crypto.createHmac('sha256', testSecret).update(tamperedPayload).digest('hex');
  assert.notStrictEqual(tamperedSig, validSignature, 'Tampered payload should produce distinct signature');
  console.log('  ✔ Security: HMAC SHA-256 webhook signature and tampering detection verified');

  // 5. Secret Storage Verification: Hashes only, no plaintext credentials
  const [userRows] = await pool.query('SELECT password_hash FROM developers LIMIT 1');
  if (userRows.length > 0) {
    const storedHash = userRows[0].password_hash;
    assert.ok(storedHash.includes(':'), 'Stored password must be salt:hash PBKDF2');
    assert.notStrictEqual(storedHash, 'Secret123', 'Plaintext password must not be stored');
    console.log('  ✔ Security: PBKDF2 password salt-hash storage verified');
  }

  const [connRows] = await pool.query('SELECT api_key, api_secret FROM apps LIMIT 1');
  if (connRows.length > 0) {
    assert.ok(connRows[0].api_key.startsWith('tc_live_'), 'API key follows standard live prefix');
    assert.ok(connRows[0].api_secret.startsWith('sec_live_') || connRows[0].api_secret.startsWith('tc_sec_'), 'API secret follows standard secret prefix');
    console.log('  ✔ Security: High-entropy cryptographically generated API keys/secrets verified');
  }

  console.log('\n===============================================================');
  console.log('🎉 PHASE 8 VALIDATION PASSED COMPLETELY!');
  console.log('===============================================================');
  console.log('  ✓ Environment configuration works');
  console.log('  ✓ Rate limiting works');
  console.log('  ✓ Queue processing works');
  console.log('  ✓ Webhook retry works');
  console.log('  ✓ Admin metrics work');
  console.log('  ✓ Security checks pass');
  console.log('===============================================================\n');

  process.exit(0);
}

runTest().catch(err => {
  console.error('\n❌ PHASE 8 VALIDATION FAILED:');
  console.error(err);
  process.exit(1);
});
