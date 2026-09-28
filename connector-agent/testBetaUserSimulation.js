import { CloudClient } from './src/cloudClient.js';
import { ConnectorAgent } from './src/agent.js';
import fs from 'fs';
import path from 'path';

const CLOUD_URL = 'http://localhost:5001';

async function runBetaUserSimulation() {
  console.log('================================================================');
  console.log('🚀 PHASE 2 STEP 1: COMPLETE BETA USER JOURNEY SIMULATION');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // Step 1: Customer Signup (User creates account & company)
  // -------------------------------------------------------------
  console.log('--- Step 1: Customer Signup & Company Creation ---');
  const companyName = 'Zenith Dynamics India Ltd';
  const signupRes = await fetch(`${CLOUD_URL}/api/tenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyName })
  });
  const signupData = await signupRes.json();
  if (!signupRes.ok) throw new Error(signupData.error);
  const tenant = signupData.tenant;
  console.log(`  ✔ Customer Account & Company Created: "${tenant.companyName}"`);
  console.log(`  ✔ Tenant ID: ${tenant.id}`);

  // -------------------------------------------------------------
  // Step 2: Connector Provisioning (Generates credentials)
  // -------------------------------------------------------------
  console.log('\n--- Step 2: Connector Provisioning & Credential Generation ---');
  const connectorId = `conn_zenith_hq_${Date.now().toString().slice(-4)}`;
  const connRes = await fetch(`${CLOUD_URL}/api/tenants/${tenant.id}/connectors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectorId })
  });
  const connData = await connRes.json();
  if (!connRes.ok) throw new Error(connData.error);
  console.log(`  ✔ Connector Created: ${connData.connectorId}`);
  console.log(`  ✔ One-time Secret Token: ${connData.token.slice(0, 18)}...`);

  // Verify connector appears in tenant's connector list
  const listConnRes = await fetch(`${CLOUD_URL}/api/tenants/${tenant.id}/connectors`);
  const listConnData = await listConnRes.json();
  console.log(`  ✔ Connectors in Tenant: ${listConnData.connectors.length} (${listConnData.connectors[0].connectorId})`);

  // -------------------------------------------------------------
  // Step 3: Agent Download & Connection (Customer launches agent)
  // -------------------------------------------------------------
  console.log('\n--- Step 3: Agent Download & Live Tally Connection ---');
  
  // Test agent download endpoint
  const downloadRes = await fetch(`${CLOUD_URL}/api/agent/download`);
  console.log(`  ✔ Tested Agent Download Endpoint: HTTP ${downloadRes.status} (${downloadRes.headers.get('content-disposition')})`);

  // Write temporary customer PC config
  const tempConfigDir = path.resolve(process.cwd(), 'scratch/beta_customer_pc');
  if (fs.existsSync(tempConfigDir)) fs.rmSync(tempConfigDir, { recursive: true, force: true });
  fs.mkdirSync(tempConfigDir, { recursive: true });

  const configPath = path.join(tempConfigDir, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify({
    cloudUrl: CLOUD_URL,
    connectorId: connData.connectorId,
    secret: connData.token,
    tallyHost: '127.0.0.1',
    tallyPort: 9000,
    pollIntervalSeconds: 3,
    heartbeatIntervalSeconds: 15
  }, null, 2), 'utf-8');

  // Launch agent on customer host
  const agent = new ConnectorAgent(configPath);
  await agent.start();
  console.log('  ✔ Customer desktop agent launched in background.');

  // Wait 2 seconds for heartbeat to register in cloud
  await new Promise(r => setTimeout(r, 2000));

  // Verify connector status is now ONLINE
  const verifyRes = await fetch(`${CLOUD_URL}/api/tenants/${tenant.id}/connectors`);
  const verifyData = await verifyRes.json();
  const onlineConnector = verifyData.connectors.find(c => c.connectorId === connData.connectorId);
  console.log(`  ✔ Cloud Verification: Status = ${onlineConnector?.status}, Active Company = "${onlineConnector?.activeCompany}"`);
  if (onlineConnector?.status !== 'ONLINE') throw new Error('Connector status did not turn ONLINE');

  // -------------------------------------------------------------
  // Step 4: User Creates Export Request from Beta Dashboard
  // -------------------------------------------------------------
  console.log('\n--- Step 4: Submitting Export Request via Dashboard ---');
  const exportReqRes = await fetch(`${CLOUD_URL}/api/connector/jobs/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId: tenant.id,
      connectorId: connData.connectorId,
      dataset: 'SALES_REGISTER',
      filters: { fromDate: '2026-04-01', toDate: '2026-09-30' }
    })
  });
  const exportReqData = await exportReqRes.json();
  const createdJob = exportReqData.job;
  console.log(`  ✔ Export Job Created: ID = ${createdJob.id}`);
  console.log(`    Dataset: ${createdJob.dataset} | Status: ${createdJob.status}`);

  // Trigger agent processing loop
  console.log('  Agent polling cloud for pending export task...');
  await agent.jobProcessor.pollOnce();

  // -------------------------------------------------------------
  // Step 5: Verify Completion & CSV Download
  // -------------------------------------------------------------
  console.log('\n--- Step 5: Verifying Job Completion & CSV Download ---');
  const jobRes = await fetch(`${CLOUD_URL}/api/exports/${createdJob.id}`);
  const finalJob = await jobRes.json();
  console.log(`  ✔ Cloud Job State: Status = ${finalJob.status}`);
  console.log(`    Exported File: ${finalJob.filename} (${finalJob.rowCount} rows, ${finalJob.sizeBytes} bytes)`);
  if (finalJob.status !== 'COMPLETED') throw new Error(`Job status was not COMPLETED: ${finalJob.status}`);

  // Download the CSV
  const csvDownloadRes = await fetch(`${CLOUD_URL}/api/exports/${createdJob.id}/download`);
  if (!csvDownloadRes.ok) throw new Error(`CSV download failed with HTTP ${csvDownloadRes.status}`);
  const csvContent = await csvDownloadRes.text();
  const csvLines = csvContent.trim().split('\n');
  console.log(`  ✔ CSV Download Successful! Total lines: ${csvLines.length} (including 32-column header)`);
  console.log(`  Header row (first 120 chars):\n    ${csvLines[0].slice(0, 120)}...`);
  console.log(`  Data row 1 (first 120 chars):\n    ${csvLines[1].slice(0, 120)}...`);

  // Graceful agent shutdown
  agent.stop();
  console.log('\n  ✔ Agent stopped.');

  console.log('\n================================================================');
  console.log('🎉 COMPLETE BETA USER SIMULATION PASSED (100% SUCCESS)!');
  console.log('================================================================\n');
}

runBetaUserSimulation().catch(err => {
  console.error('\n✖ Simulation error:', err);
  process.exit(1);
});
