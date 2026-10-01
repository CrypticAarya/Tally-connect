import { CloudClient } from './src/cloudClient.js';
import { JobProcessor } from './src/jobProcessor.js';
import { TallyXmlHttpAdapter } from '../server/src/adapters/tallyXmlHttpAdapter.js';

const CLOUD_URL = 'http://localhost:5001';
const CONNECTOR_ID = 'conn_mumbai_hq_01';
const SECRET = 'sec_beta_mumbai_9f8e7d';

async function runSimulation() {
  console.log('================================================================');
  console.log('🧪 PHASE 1 STEP 3: CONNECTOR EXPORT JOB EXECUTION SIMULATION');
  console.log('================================================================\n');

  const cloudClient = new CloudClient({
    cloudUrl: CLOUD_URL,
    connectorId: CONNECTOR_ID,
    secret: SECRET
  });

  const tallyAdapter = new TallyXmlHttpAdapter({
    host: '127.0.0.1',
    port: 9000,
    fixtureFallback: true // Uses real Tally if available, or Tally XML fixtures
  });

  const jobProcessor = new JobProcessor({
    cloudClient,
    tallyAdapter,
    config: {
      cloudUrl: CLOUD_URL,
      connectorId: CONNECTOR_ID,
      secret: SECRET,
      tallyHost: '127.0.0.1',
      tallyPort: 9000
    },
    pollIntervalSeconds: 2 // Shortened for fast test execution
  });

  // 1. Agent Registration
  console.log('--- Step 1: Agent Registration ---');
  const regRes = await cloudClient.register('test-simulation-host');
  console.log('Agent Registration Result:', regRes);
  if (!regRes.success) throw new Error('Registration failed');

  // 2. Test Case 1: SALES_REGISTER Export
  console.log('\n--- Step 2: Cloud Creates SALES_REGISTER Export Job ---');
  const createJobRes = await fetch(`${CLOUD_URL}/api/connector/jobs/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataset: 'SALES_REGISTER',
      filters: {
        fromDate: '2026-04-01',
        toDate: '2026-09-30'
      },
      connectorId: CONNECTOR_ID
    })
  });
  const createdJobData = await createJobRes.json();
  console.log('Cloud created job:', createdJobData.job);
  const salesJobId = createdJobData.job.id;

  // 3. Verify Job is PENDING in Cloud
  console.log('\n--- Step 3: Connector Agent Polls for Pending Jobs ---');
  const pendingJobs = await cloudClient.fetchPendingJobs();
  console.log(`Found ${pendingJobs.jobs.length} pending job(s):`, pendingJobs.jobs.map(j => ({ id: j.id, dataset: j.dataset, status: j.status })));
  const foundSalesJob = pendingJobs.jobs.find(j => j.id === salesJobId);
  if (!foundSalesJob) throw new Error(`Job ${salesJobId} not found in pending jobs`);

  // 4. Agent Executes Job
  console.log('\n--- Step 4: Agent Executes Job (Tally Adapter -> Transformer -> CSV -> Cloud) ---');
  const execResult = await jobProcessor.executeJob(foundSalesJob);
  console.log('Job execution result:', execResult);
  if (!execResult.success) throw new Error(`Job execution failed: ${execResult.error}`);

  // 5. Verify Cloud Job Status & Storage
  console.log('\n--- Step 5: Verify Cloud Status & Download Stream ---');
  const statusRes = await fetch(`${CLOUD_URL}/api/exports/${salesJobId}`);
  const statusData = await statusRes.json();
  console.log('Cloud Job Record:', {
    id: statusData.id,
    dataset: statusData.dataset,
    status: statusData.status,
    rowCount: statusData.rowCount,
    filename: statusData.filename,
    fileKey: statusData.fileKey,
    sizeBytes: statusData.sizeBytes,
    downloadUrl: statusData.downloadUrl
  });

  if (statusData.status !== 'COMPLETED') {
    throw new Error(`Expected status COMPLETED, got ${statusData.status}`);
  }

  // 6. Download and inspect CSV content
  console.log('\n--- Step 6: Verify CSV Download Stream ---');
  const downloadRes = await fetch(`${CLOUD_URL}/api/exports/${salesJobId}/download`);
  if (!downloadRes.ok) throw new Error(`Download failed with HTTP ${downloadRes.status}`);
  const csvText = await downloadRes.text();
  const csvLines = csvText.trim().split('\n');
  console.log(`✔ CSV downloaded successfully! (${csvText.length} bytes, ${csvLines.length} lines including header)`);
  console.log('First 2 lines:');
  console.log(csvLines.slice(0, 2).join('\n'));

  // 7. Test All Supported Datasets (CUSTOMER, CHART_OF_ACCOUNTS, TRIAL_BALANCE)
  console.log('\n--- Step 7: Testing Remaining Supported Datasets ---');
  const datasetsToTest = ['CUSTOMER', 'CHART_OF_ACCOUNTS', 'TRIAL_BALANCE'];

  for (const ds of datasetsToTest) {
    console.log(`\nTesting dataset: ${ds}...`);
    const cRes = await fetch(`${CLOUD_URL}/api/connector/jobs/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset: ds, connectorId: CONNECTOR_ID })
    });
    const cData = await cRes.json();
    const jId = cData.job.id;

    // Agent executes
    const res = await jobProcessor.executeJob(cData.job);
    if (!res.success) throw new Error(`Failed dataset ${ds}: ${res.error}`);

    // Verify cloud record
    const sRes = await fetch(`${CLOUD_URL}/api/exports/${jId}`);
    const sData = await sRes.json();
    console.log(`  ✔ ${ds}: Status = ${sData.status}, Rows = ${sData.rowCount}, File = ${sData.filename}`);
  }

  // 8. Test Error Handling: Invalid Dataset
  console.log('\n--- Step 8: Error Handling Simulation (Invalid Dataset) ---');
  const invalidJob = {
    id: `job_invalid_${Date.now()}`,
    dataset: 'UNKNOWN_VOUCHER_TYPE',
    connectorId: CONNECTOR_ID
  };
  const errRes = await jobProcessor.executeJob(invalidJob);
  console.log('Execution result for invalid dataset:', errRes);
  if (errRes.success) throw new Error('Expected invalid dataset to fail');
  console.log(`✔ Gracefully handled invalid dataset error: "${errRes.error}"`);

  // 9. Test Error Handling: Tally Offline (when fallback is disabled)
  console.log('\n--- Step 9: Error Handling Simulation (Tally Offline with no fallback) ---');
  const strictAdapter = new TallyXmlHttpAdapter({
    host: '127.0.0.1',
    port: 9999, // Unused port
    timeoutMs: 800,
    fixtureFallback: false
  });
  const strictJobProcessor = new JobProcessor({
    cloudClient,
    tallyAdapter: strictAdapter,
    config: { cloudUrl: CLOUD_URL, connectorId: CONNECTOR_ID, secret: SECRET }
  });

  const offlineTestJob = {
    id: `job_offline_${Date.now()}`,
    dataset: 'SALES_REGISTER',
    connectorId: CONNECTOR_ID
  };
  const offlineRes = await strictJobProcessor.executeJob(offlineTestJob);
  console.log('Execution result for offline Tally:', offlineRes);
  if (offlineRes.success) throw new Error('Expected offline Tally to fail');
  console.log(`✔ Gracefully caught Tally connection error: "${offlineRes.error?.slice(0, 75)}..."`);

  console.log('\n================================================================');
  console.log('🎉 ALL PHASE 1 STEP 3 SIMULATION VALIDATION CHECKS PASSED!');
  console.log('================================================================\n');
}

runSimulation().catch(err => {
  console.error('\n✖ SIMULATION FAILED:', err);
  process.exit(1);
});
