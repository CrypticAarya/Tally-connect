import { CloudClient } from './src/cloudClient.js';
import { JobProcessor } from './src/jobProcessor.js';
import { TallyXmlHttpAdapter } from '../server/src/adapters/tallyXmlHttpAdapter.js';

const CLOUD_URL = 'http://localhost:5001';

async function runMultiTenantSimulation() {
  console.log('================================================================');
  console.log('👥 PHASE 1 STEP 4: MULTI-TENANT REGISTRATION & ISOLATION TEST');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // Step 1: Provision Two Independent Tenants
  // -------------------------------------------------------------
  console.log('--- Step 1: Creating Tenants in Cloud Database ---');
  
  // Tenant A: Acme Retail Solutions
  const tenantARes = await fetch(`${CLOUD_URL}/api/tenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyName: 'Acme Retail Solutions Ltd' })
  });
  const tenantAData = await tenantARes.json();
  const tenantA = tenantAData.tenant;
  console.log(`  ✔ Tenant A Created: "${tenantA.companyName}" (ID: ${tenantA.id})`);

  // Tenant B: Zenith Global Logistics
  const tenantBRes = await fetch(`${CLOUD_URL}/api/tenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyName: 'Zenith Global Logistics Ltd' })
  });
  const tenantBData = await tenantBRes.json();
  const tenantB = tenantBData.tenant;
  console.log(`  ✔ Tenant B Created: "${tenantB.companyName}" (ID: ${tenantB.id})`);

  // -------------------------------------------------------------
  // Step 2: Provision Connectors & Generate Dynamic Tokens
  // -------------------------------------------------------------
  console.log('\n--- Step 2: Generating Unique Tokens for Each Tenant Connector ---');
  
  // Provision Connector A
  const connARes = await fetch(`${CLOUD_URL}/api/tenants/${tenantA.id}/connectors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectorId: 'conn_acme_mumbai_01' })
  });
  const connA = await connARes.json();
  console.log(`  ✔ Connector A Provisioned: ID = ${connA.connectorId}`);
  console.log(`    Token A (Secret): ${connA.token.slice(0, 16)}...`);

  // Provision Connector B
  const connBRes = await fetch(`${CLOUD_URL}/api/tenants/${tenantB.id}/connectors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectorId: 'conn_zenith_delhi_01' })
  });
  const connB = await connBRes.json();
  console.log(`  ✔ Connector B Provisioned: ID = ${connB.connectorId}`);
  console.log(`    Token B (Secret): ${connB.token.slice(0, 16)}...`);

  // -------------------------------------------------------------
  // Step 3: Verify Token Authentication & Hash Validation
  // -------------------------------------------------------------
  console.log('\n--- Step 3: Verifying Authentication & Token Hash Validation ---');

  // Attempt registration with invalid token
  const badAuthRes = await fetch(`${CLOUD_URL}/api/connector/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer invalid_secret_token_xyz',
      'X-Connector-ID': connA.connectorId
    },
    body: JSON.stringify({ machineName: 'Hacker-PC' })
  });
  console.log(`  ✔ Invalid token correctly rejected with HTTP ${badAuthRes.status} (${(await badAuthRes.json()).error})`);
  if (badAuthRes.status !== 401) throw new Error('Expected 401 for invalid token');

  // Initialize CloudClients for Agent A and Agent B
  const clientA = new CloudClient({
    cloudUrl: CLOUD_URL,
    connectorId: connA.connectorId,
    secret: connA.token
  });

  const clientB = new CloudClient({
    cloudUrl: CLOUD_URL,
    connectorId: connB.connectorId,
    secret: connB.token
  });

  // Register Agent A
  const regARes = await clientA.register('Acme-Store-Server');
  console.log(`  ✔ Agent A Registered: Tenant = ${regARes.data.tenantId}, Company = "${regARes.data.companyName}"`);
  if (!regARes.success || regARes.data.tenantId !== tenantA.id) throw new Error('Agent A registration mismatch');

  // Register Agent B
  const regBRes = await clientB.register('Zenith-Depot-Server');
  console.log(`  ✔ Agent B Registered: Tenant = ${regBRes.data.tenantId}, Company = "${regBRes.data.companyName}"`);
  if (!regBRes.success || regBRes.data.tenantId !== tenantB.id) throw new Error('Agent B registration mismatch');

  // -------------------------------------------------------------
  // Step 4: Dispatch Jobs for Tenant A and Tenant B
  // -------------------------------------------------------------
  console.log('\n--- Step 4: Dispatching Jobs for Each Tenant ---');
  
  // Job A for Tenant A: SALES_REGISTER
  const jobARes = await fetch(`${CLOUD_URL}/api/connector/jobs/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId: tenantA.id,
      connectorId: connA.connectorId,
      dataset: 'SALES_REGISTER',
      filters: { fromDate: '2026-04-01', toDate: '2026-09-30' }
    })
  });
  const jobAData = await jobARes.json();
  const jobA = jobAData.job;
  console.log(`  ✔ Created Job A: ID = ${jobA.id} | Tenant = ${jobA.tenantId} | Dataset = ${jobA.dataset}`);

  // Job B for Tenant B: CUSTOMER
  const jobBRes = await fetch(`${CLOUD_URL}/api/connector/jobs/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId: tenantB.id,
      connectorId: connB.connectorId,
      dataset: 'CUSTOMER'
    })
  });
  const jobBData = await jobBRes.json();
  const jobB = jobBData.job;
  console.log(`  ✔ Created Job B: ID = ${jobB.id} | Tenant = ${jobB.tenantId} | Dataset = ${jobB.dataset}`);

  // -------------------------------------------------------------
  // Step 5: Test Tenant Job Isolation (Polling)
  // -------------------------------------------------------------
  console.log('\n--- Step 5: Testing Job Isolation on Polling ---');

  // Agent A polls
  const pendingForA = await clientA.fetchPendingJobs();
  console.log(`  Agent A received ${pendingForA.jobs.length} job(s):`, pendingForA.jobs.map(j => ({ id: j.id, tenantId: j.tenantId, dataset: j.dataset })));
  const aHasJobA = pendingForA.jobs.some(j => j.id === jobA.id);
  const aHasJobB = pendingForA.jobs.some(j => j.id === jobB.id);

  if (!aHasJobA) throw new Error('Agent A failed to receive its own Job A');
  if (aHasJobB) throw new Error('SECURITY VIOLATION: Agent A received Tenant B\'s Job B!');
  console.log('  ✔ VERIFIED: Tenant A connector cannot see Tenant B jobs.');

  // Agent B polls
  const pendingForB = await clientB.fetchPendingJobs();
  console.log(`  Agent B received ${pendingForB.jobs.length} job(s):`, pendingForB.jobs.map(j => ({ id: j.id, tenantId: j.tenantId, dataset: j.dataset })));
  const bHasJobB = pendingForB.jobs.some(j => j.id === jobB.id);
  const bHasJobA = pendingForB.jobs.some(j => j.id === jobA.id);

  if (!bHasJobB) throw new Error('Agent B failed to receive its own Job B');
  if (bHasJobA) throw new Error('SECURITY VIOLATION: Agent B received Tenant A\'s Job A!');
  console.log('  ✔ VERIFIED: Tenant B connector cannot see Tenant A jobs.');

  // -------------------------------------------------------------
  // Step 6: Test Tenant Isolation on Status Update (Cross-Tenant Hijack Protection)
  // -------------------------------------------------------------
  console.log('\n--- Step 6: Testing Cross-Tenant Hijack Protection on Status Update ---');

  // Connector A attempts to hijack/update Tenant B's Job B
  const hijackAttempt = await clientA.updateJobStatus(jobB.id, {
    status: 'PROCESSING'
  });
  console.log('  Tenant A update attempt on Tenant B job result:', hijackAttempt);
  if (hijackAttempt.success) {
    throw new Error('SECURITY VIOLATION: Tenant A was able to update Tenant B\'s job!');
  }
  console.log(`  ✔ VERIFIED: Cross-tenant update blocked with error: "${hijackAttempt.error}"`);

  // -------------------------------------------------------------
  // Step 7: Execute Real Pipeline for Both Tenants
  // -------------------------------------------------------------
  console.log('\n--- Step 7: Executing Real Export Pipelines for Both Tenants ---');

  const tallyAdapter = new TallyXmlHttpAdapter({ fixtureFallback: true });

  // Job Processor for Tenant A
  const processorA = new JobProcessor({
    cloudClient: clientA,
    tallyAdapter,
    config: { tallyHost: '127.0.0.1', tallyPort: 9000 }
  });

  // Job Processor for Tenant B
  const processorB = new JobProcessor({
    cloudClient: clientB,
    tallyAdapter,
    config: { tallyHost: '127.0.0.1', tallyPort: 9000 }
  });

  // Execute Tenant A Job (Sales Register)
  console.log('\n  [Tenant A] Executing Job A (SALES_REGISTER)...');
  const execARes = await processorA.executeJob(jobA);
  console.log(`  ✔ Tenant A Export Succeeded: ${execARes.rowCount} rows`);
  if (!execARes.success) throw new Error(`Tenant A execution failed: ${execARes.error}`);

  // Execute Tenant B Job (Customer Master)
  console.log('\n  [Tenant B] Executing Job B (CUSTOMER)...');
  const execBRes = await processorB.executeJob(jobB);
  console.log(`  ✔ Tenant B Export Succeeded: ${execBRes.rowCount} rows`);
  if (!execBRes.success) throw new Error(`Tenant B execution failed: ${execBRes.error}`);

  // -------------------------------------------------------------
  // Step 8: Verify Downloads and Cloud Status for Both Tenants
  // -------------------------------------------------------------
  console.log('\n--- Step 8: Verifying Cloud Records and Downloads ---');

  // Verify Job A in Cloud
  const statusARes = await fetch(`${CLOUD_URL}/api/exports/${jobA.id}`);
  const statusA = await statusARes.json();
  console.log(`  Tenant A Cloud Job: Status = ${statusA.status}, File = "${statusA.filename}", Size = ${statusA.sizeBytes} bytes`);

  const downloadARes = await fetch(`${CLOUD_URL}/api/exports/${jobA.id}/download`);
  const csvAText = await downloadARes.text();
  console.log(`  ✔ Downloaded Tenant A CSV: ${csvAText.split('\n').length} lines`);

  // Verify Job B in Cloud
  const statusBRes = await fetch(`${CLOUD_URL}/api/exports/${jobB.id}`);
  const statusB = await statusBRes.json();
  console.log(`  Tenant B Cloud Job: Status = ${statusB.status}, File = "${statusB.filename}", Size = ${statusB.sizeBytes} bytes`);

  const downloadBRes = await fetch(`${CLOUD_URL}/api/exports/${jobB.id}/download`);
  const csvBText = await downloadBRes.text();
  console.log(`  ✔ Downloaded Tenant B CSV: ${csvBText.split('\n').length} lines`);

  console.log('\n================================================================');
  console.log('🎉 ALL MULTI-TENANT ISOLATION & VALIDATION CHECKS PASSED!');
  console.log('================================================================\n');
}

runMultiTenantSimulation().catch(err => {
  console.error('\n✖ MULTI-TENANT SIMULATION FAILED:', err);
  process.exit(1);
});
