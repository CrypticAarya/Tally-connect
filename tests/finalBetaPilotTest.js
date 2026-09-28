import { format } from 'fast-csv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5001';

const PILOT_CUSTOMERS = [
  {
    name: 'Anil Kapoor',
    email: `anil_${Date.now()}@apexlogistics.in`,
    password: 'Password@123',
    companyName: 'Apex Logistics Private Limited',
    dataset: 'CUSTOMER',
    schedule: 'Hourly Master Sync',
    machineName: 'APEX-SRV-MUMBAI',
    agentVersion: '1.0.0-beta',
    rowsCount: 250
  },
  {
    name: 'Dr. Neha Sen',
    email: `neha_${Date.now()}@nexusdiagnostics.com`,
    password: 'Password@123',
    companyName: 'Nexus Healthcare Diagnostics',
    dataset: 'CHART_OF_ACCOUNTS',
    schedule: 'Daily End-of-Day Sync',
    machineName: 'NEXUS-LAB-PUNE',
    agentVersion: '1.0.0-beta',
    rowsCount: 150
  },
  {
    name: 'Rohan Gupta',
    email: `rohan_${Date.now()}@bluecrestretail.in`,
    password: 'Password@123',
    companyName: 'Bluecrest Retail Outlets',
    dataset: 'SALES_REGISTER',
    schedule: 'Twice-Daily Sales Batch',
    machineName: 'BC-POS-BLR-04',
    agentVersion: '1.0.0-beta',
    rowsCount: 500
  },
  {
    name: 'Zoya Farooqui',
    email: `zoya_${Date.now()}@zenithpolymers.co.in`,
    password: 'Password@123',
    companyName: 'Zenith Industrial Polymers',
    dataset: 'TRIAL_BALANCE',
    schedule: 'Weekly Financial Close',
    machineName: 'ZENITH-PLANT-VAPI',
    agentVersion: '1.0.0-beta',
    rowsCount: 120
  },
  {
    name: 'Manish Kulkarni',
    email: `manish_${Date.now()}@matrixeng.in`,
    password: 'Password@123',
    companyName: 'Matrix Precision Engineering',
    dataset: 'SALES_REGISTER',
    schedule: 'Continuous High-Volume Sync',
    machineName: 'MATRIX-HQ-DELHI',
    agentVersion: '1.0.0-beta',
    rowsCount: 10000 // 10,000 rows streaming
  }
];

// Helper: HTTP request wrapper
async function api(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, ok: res.ok, data, headers: res.headers };
}

// Generate streaming CSV data
async function generateCsvContent(columns, rowCount, companyName) {
  return new Promise((resolve, reject) => {
    let output = '';
    const csvStream = format({ headers: columns, writeHeaders: true });
    csvStream.on('data', chunk => { output += chunk; });
    csvStream.on('end', () => resolve(output));
    csvStream.on('error', err => reject(err));

    for (let i = 1; i <= rowCount; i++) {
      const row = {};
      for (const col of columns) {
        if (col === 'Company') row[col] = companyName;
        else if (col === 'Index') row[col] = String(i);
        else row[col] = `${col}_val_${i}`;
      }
      csvStream.write(row);
    }
    csvStream.end();
  });
}

async function runFinalBetaPilotTest() {
  console.log('================================================================');
  console.log('🚀 PHASE 3 STEP 1: FINAL BETA CUSTOMER PILOT SIMULATION');
  console.log('Testing: 5 External Customers | Diverse Schedules | Audit & Versions');
  console.log('================================================================\n');

  const startTime = Date.now();
  const customerInstances = [];

  // -------------------------------------------------------------
  // PART 1: Environment Configuration Separation Verification
  // -------------------------------------------------------------
  console.log('▶ TEST PART 1: Verifying Environment Configuration Separation...');
  const envRes = await api('/api/system/environment');
  if (!envRes.ok) throw new Error('Failed to retrieve system environment configuration');

  console.log(`  ✔ Active Environment: "${envRes.data.displayName}" (${envRes.data.activeEnvironment})`);
  console.log(`  ✔ API Base URL: ${envRes.data.urls.apiUrl}`);
  console.log(`  ✔ Agent Endpoint: ${envRes.data.urls.agentEndpoint}`);
  console.log(`  ✔ Separated Profiles: ${envRes.data.environments.map(e => e.name).join(', ')}`);

  // -------------------------------------------------------------
  // PART 2: Agent Version Management & Compatibility Verification
  // -------------------------------------------------------------
  console.log('\n▶ TEST PART 2: Verifying Agent Version Compatibility Policy...');
  // 2a. Current version check
  const verCurrentRes = await api('/api/agent/version-check?version=1.0.0-beta');
  if (!verCurrentRes.ok || !verCurrentRes.data.isSupported) {
    throw new Error('Current version 1.0.0-beta failed compatibility check');
  }
  console.log(`  ✔ Current Version 1.0.0-beta: Supported = ${verCurrentRes.data.isSupported}, UpdateAvailable = ${verCurrentRes.data.isUpdateAvailable}`);

  // 2b. Deprecated legacy version check (should be marked unsupported)
  const verOldRes = await api('/api/agent/version-check?version=0.8.0');
  if (!verOldRes.ok || verOldRes.data.isSupported !== false || verOldRes.data.upgradeUrgency !== 'CRITICAL') {
    throw new Error('Deprecated version 0.8.0 should be marked unsupported with CRITICAL urgency');
  }
  console.log(`  ✔ Deprecated Version 0.8.0: Correctly flagged unsupported (Urgency: ${verOldRes.data.upgradeUrgency})`);

  // -------------------------------------------------------------
  // PART 3: 5 External Customers Full Pilot Simulation
  // -------------------------------------------------------------
  console.log('\n▶ TEST PART 3: Simulating 5 Real External Beta Customers End-to-End...');

  for (const c of PILOT_CUSTOMERS) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`🏢 CUSTOMER: ${c.companyName}`);
    console.log(`   Admin: ${c.name} (${c.email})`);
    console.log(`   Host: ${c.machineName} | Schedule: ${c.schedule} | Dataset: ${c.dataset}`);
    console.log(`----------------------------------------------------------------`);

    // 1. Onboarding: User Signup
    const signupRes = await api('/api/auth/signup', {
      method: 'POST',
      body: {
        name: c.name,
        email: c.email,
        password: c.password,
        companyName: c.companyName
      }
    });
    if (!signupRes.ok) throw new Error(`Signup failed for ${c.companyName}: ${JSON.stringify(signupRes.data)}`);
    const { user, tenant, token } = signupRes.data;
    console.log(`  [1/6] Onboarding Complete: User "${user.email}" -> Tenant "${tenant.companyName}" (${tenant.id})`);

    // 2. Authentication: User Login (Tracked in Audit Log)
    const loginRes = await api('/api/auth/login', {
      method: 'POST',
      body: { email: c.email, password: c.password }
    });
    if (!loginRes.ok) throw new Error(`Login failed for ${c.email}`);
    const sessionToken = loginRes.data.token;
    console.log(`  [2/6] Authentication Verified: Active Session "${sessionToken.slice(0, 16)}..."`);

    // 3. Installation: Agent Binary & Version Check
    const versionCheck = await api(`/api/agent/version-check?version=${c.agentVersion}`);
    if (!versionCheck.ok || !versionCheck.data.isSupported) throw new Error('Agent version rejected');
    console.log(`  [3/6] Installation Validated: Agent v${c.agentVersion} compatibility confirmed`);

    // 4. Provisioning & Connection: Provision Connector, Register & Heartbeat
    const provRes = await api(`/api/tenants/${tenant.id}/connectors`, { method: 'POST', body: {} });
    if (!provRes.ok) throw new Error(`Provisioning failed for ${c.companyName}`);
    const { connectorId, token: connectorSecret } = provRes.data;

    // Agent Registration (Tracked in Audit Log)
    const regRes = await api('/api/connector/register', {
      method: 'POST',
      headers: {
        'x-connector-id': connectorId,
        'x-connector-secret': connectorSecret
      },
      body: {
        machineName: c.machineName,
        agentVersion: c.agentVersion
      }
    });
    if (!regRes.ok) throw new Error(`Registration failed for connector ${connectorId}`);

    // Agent Heartbeat (Sets status ONLINE)
    const beatRes = await api('/api/connector/heartbeat', {
      method: 'POST',
      headers: {
        'x-connector-id': connectorId,
        'x-connector-secret': connectorSecret
      },
      body: {
        machineName: c.machineName,
        tallyStatus: 'CONNECTED',
        activeCompany: c.companyName,
        port: 9000,
        agentVersion: c.agentVersion,
        timestamp: new Date().toISOString()
      }
    });
    if (!beatRes.ok) throw new Error(`Heartbeat failed for connector ${connectorId}`);
    console.log(`  [4/6] Connection Established: Connector ${connectorId} ONLINE on [${c.machineName}]`);

    // 5. Scheduled Export Execution (Creation & Completion Tracked in Audit Log)
    const jobCreation = await api('/api/connector/jobs/create', {
      method: 'POST',
      body: {
        tenantId: tenant.id,
        connectorId: connectorId,
        dataset: c.dataset,
        userId: user.id,
        filters: { schedule: c.schedule, fromDate: '2026-04-01', toDate: '2026-09-30' }
      }
    });
    if (!jobCreation.ok) throw new Error(`Export job creation failed for ${c.companyName}`);
    const jobId = jobCreation.data.job.id;

    // Agent sets job PROCESSING
    await api(`/api/connector/jobs/${jobId}/status`, {
      method: 'POST',
      headers: {
        'x-connector-id': connectorId,
        'x-connector-secret': connectorSecret
      },
      body: { status: 'PROCESSING' }
    });

    // Agent generates CSV and sets job COMPLETED
    const columns = ['Index', 'Company', 'VoucherNo', 'Amount', 'TaxRate', 'Date'];
    const csvData = await generateCsvContent(columns, c.rowsCount, c.companyName);
    const filename = `${c.dataset}_${Date.now()}_${jobId.slice(-5)}.csv`;
    const preview = [{ Index: '1', Company: c.companyName, Amount: '125000.00', Date: '2026-05-15' }];

    const completeRes = await api(`/api/connector/jobs/${jobId}/status`, {
      method: 'POST',
      headers: {
        'x-connector-id': connectorId,
        'x-connector-secret': connectorSecret
      },
      body: {
        status: 'COMPLETED',
        rowCount: c.rowsCount,
        filename,
        csvContent: csvData,
        preview
      }
    });
    if (!completeRes.ok) throw new Error(`Failed to complete job ${jobId}`);
    console.log(`  [5/6] Export Completed: Job ${jobId} -> ${c.rowsCount.toLocaleString()} rows generated (${(csvData.length / 1024).toFixed(1)} KB)`);

    // 6. CSV Download (Tracked in Audit Log)
    const downloadRes = await api(`/api/exports/${jobId}/download`);
    if (!downloadRes.ok) throw new Error(`CSV download failed with status ${downloadRes.status}`);
    console.log(`  [6/6] CSV Download Streamed: ${downloadRes.data.length} bytes received`);

    // Customer logs out (Tracked in Audit Log)
    await api('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` }
    });

    customerInstances.push({
      ...c,
      tenantId: tenant.id,
      userId: user.id,
      connectorId,
      jobId
    });
  }

  // -------------------------------------------------------------
  // PART 4: Verification of Comprehensive Audit Logs
  // -------------------------------------------------------------
  console.log('\n▶ TEST PART 4: Verifying Full Audit Trail Across All 6 Required Actions...');

  const REQUIRED_ACTIONS = [
    'login',
    'logout',
    'connector_registration',
    'export_creation',
    'export_completion',
    'csv_download'
  ];

  for (const c of customerInstances) {
    const auditRes = await api(`/api/audit-logs?tenantId=${c.tenantId}`);
    if (!auditRes.ok) throw new Error(`Failed to fetch audit logs for tenant ${c.tenantId}`);

    const logs = auditRes.data.auditLogs || [];
    const recordedActions = new Set(logs.map(l => l.action));

    console.log(`\n  🏢 Audit Trail for ${c.companyName}:`);
    for (const requiredAction of REQUIRED_ACTIONS) {
      const isPresent = recordedActions.has(requiredAction);
      if (!isPresent) {
        throw new Error(`Missing required audit log action "${requiredAction}" for ${c.companyName}`);
      }
      console.log(`     - [✔] Action recorded: "${requiredAction}"`);
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n================================================================');
  console.log(`🎉 PHASE 3 STEP 1: PILOT PREPARATION SIMULATION PASSED in ${durationSec}s!`);
  console.log('All 5 external beta customers successfully onboarded, connected, exported,');
  console.log('and fully logged across deployment safety, versioning & audit requirements.');
  console.log('================================================================\n');
}

runFinalBetaPilotTest().catch(err => {
  console.error('\n✖ Final Beta Pilot Test Failed:', err);
  process.exit(1);
});
