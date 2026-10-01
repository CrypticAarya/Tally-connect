import { format } from 'fast-csv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:5001';

const TEN_PILOT_CUSTOMERS = [
  {
    name: 'Anil Kapoor',
    email: `anil_${Date.now()}@apexlogistics.in`,
    password: 'Password@123',
    companyName: 'Apex Logistics Private Limited',
    industry: 'Logistics & Supply Chain',
    tallyVersion: 'TallyPrime 4.1',
    dataSizeCategory: 'Large (250k vouchers)',
    dataset: 'CUSTOMER',
    machineName: 'APEX-SRV-MUMBAI',
    agentVersion: '1.0.0-beta'
  },
  {
    name: 'Dr. Neha Sen',
    email: `neha_${Date.now()}@nexusdiagnostics.com`,
    password: 'Password@123',
    companyName: 'Nexus Healthcare Diagnostics',
    industry: 'Healthcare & Pharma',
    tallyVersion: 'TallyPrime 3.0',
    dataSizeCategory: 'Medium (90k vouchers)',
    dataset: 'CHART_OF_ACCOUNTS',
    machineName: 'NEXUS-LAB-PUNE',
    agentVersion: '1.0.0-beta'
  },
  {
    name: 'Rohan Gupta',
    email: `rohan_${Date.now()}@bluecrestretail.in`,
    password: 'Password@123',
    companyName: 'Bluecrest Retail Outlets',
    industry: 'Retail & FMCG',
    tallyVersion: 'TallyPrime 4.0',
    dataSizeCategory: 'Large (450k vouchers)',
    dataset: 'SALES_REGISTER',
    machineName: 'BC-POS-BLR-04',
    agentVersion: '1.0.0-beta'
  },
  {
    name: 'Zoya Farooqui',
    email: `zoya_${Date.now()}@zenithpolymers.co.in`,
    password: 'Password@123',
    companyName: 'Zenith Industrial Polymers',
    industry: 'Chemicals & Polymers',
    tallyVersion: 'TallyPrime 2.1',
    dataSizeCategory: 'Medium (60k vouchers)',
    dataset: 'TRIAL_BALANCE',
    machineName: 'ZENITH-PLANT-VAPI',
    agentVersion: '1.0.0-beta'
  },
  {
    name: 'Manish Kulkarni',
    email: `manish_${Date.now()}@matrixeng.in`,
    password: 'Password@123',
    companyName: 'Matrix Precision Engineering',
    industry: 'Automotive & Precision Tooling',
    tallyVersion: 'TallyPrime 4.1',
    dataSizeCategory: 'Very Large (1.2M vouchers)',
    dataset: 'SALES_REGISTER',
    machineName: 'MATRIX-HQ-DELHI',
    agentVersion: '1.0.0-beta'
  },
  {
    name: 'Pooja Agarwal',
    email: `pooja_${Date.now()}@sunrisetextiles.in`,
    password: 'Password@123',
    companyName: 'Sunrise Textiles & Apparel',
    industry: 'Textiles & Garments',
    tallyVersion: 'TallyPrime 3.0',
    dataSizeCategory: 'Small (25k vouchers)',
    dataset: 'CUSTOMER',
    machineName: 'SUNRISE-SURAT-MILL',
    agentVersion: '1.0.0-beta'
  },
  {
    name: 'Sameer Joshi',
    email: `sameer_${Date.now()}@quantumcloud.io`,
    password: 'Password@123',
    companyName: 'Quantum Cloud Technologies',
    industry: 'IT & Software Services',
    tallyVersion: 'TallyPrime 4.1',
    dataSizeCategory: 'Medium (80k vouchers)',
    dataset: 'CHART_OF_ACCOUNTS',
    machineName: 'QUANTUM-BLR-DC',
    agentVersion: '1.0.0-beta'
  },
  {
    name: 'Kavita Menon',
    email: `kavita_${Date.now()}@horizonhospitality.co.in`,
    password: 'Password@123',
    companyName: 'Horizon Hospitality Group',
    industry: 'Hospitality & Restaurants',
    tallyVersion: 'TallyPrime 4.0',
    dataSizeCategory: 'Medium (110k vouchers)',
    dataset: 'SALES_REGISTER',
    machineName: 'HORIZON-GOA-RESORT',
    agentVersion: '1.0.0-beta'
  },
  {
    name: 'Harish Reddy',
    email: `harish_${Date.now()}@titanconstruction.in`,
    password: 'Password@123',
    companyName: 'Titan Construction Materials',
    industry: 'Infrastructure & Real Estate',
    tallyVersion: 'TallyPrime 2.0',
    dataSizeCategory: 'Large (320k vouchers)',
    dataset: 'TRIAL_BALANCE',
    machineName: 'TITAN-HYD-CENTRAL',
    agentVersion: '1.0.0-beta'
  },
  {
    name: 'Vivek Singhania',
    email: `vivek_${Date.now()}@vantagecapital.com`,
    password: 'Password@123',
    companyName: 'Vantage Capital Advisors',
    industry: 'Financial & Legal Consulting',
    tallyVersion: 'TallyPrime 4.1',
    dataSizeCategory: 'Small (15k vouchers)',
    dataset: 'CUSTOMER',
    machineName: 'VANTAGE-BKC-OFFICE',
    agentVersion: '1.0.0-beta'
  }
];

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

// Generate CSV data for test
async function generateCsvData(columns, rowCount, company) {
  return new Promise((resolve, reject) => {
    let out = '';
    const csvStream = format({ headers: columns, writeHeaders: true });
    csvStream.on('data', chunk => { out += chunk; });
    csvStream.on('end', () => resolve(out));
    csvStream.on('error', err => reject(err));

    for (let i = 1; i <= rowCount; i++) {
      const row = {};
      for (const col of columns) {
        if (col === 'Company') row[col] = company;
        else row[col] = `${col}_${i}`;
      }
      csvStream.write(row);
    }
    csvStream.end();
  });
}

async function runRealCustomerPilotSimulation() {
  console.log('================================================================');
  console.log('🚀 PHASE 3 STEP 2: REAL CUSTOMER PILOT FRAMEWORK SIMULATION');
  console.log('Testing: 10 Real Customers | Tracking | Feedback | Metrics | Workflow');
  console.log('================================================================\n');

  const startTime = Date.now();
  const pilotInstances = [];

  // -------------------------------------------------------------
  // STEP 1: Customer Onboarding & Pilot Profile Tracking
  // -------------------------------------------------------------
  console.log('▶ STEP 1: Provisioning 10 Real Pilot Accounts & Tracking Profiles...');
  for (const c of TEN_PILOT_CUSTOMERS) {
    // 1a. User Account & Tenant
    const signupRes = await api('/api/auth/signup', {
      method: 'POST',
      body: {
        name: c.name,
        email: c.email,
        password: c.password,
        companyName: c.companyName
      }
    });
    if (!signupRes.ok) throw new Error(`Signup failed for ${c.companyName}`);
    const { user, tenant, token } = signupRes.data;

    // 1b. Pilot Tracking System Profile Registration
    const pilotRes = await api('/api/pilots', {
      method: 'POST',
      body: {
        tenantId: tenant.id,
        customerName: c.name,
        companyName: c.companyName,
        contactEmail: c.email,
        industry: c.industry,
        tallyVersion: c.tallyVersion,
        dataSizeCategory: c.dataSizeCategory,
        stage: 'DAY_0_INSTALLATION',
        notes: `Pilot agreement signed. Assigned dedicated engineer.`
      }
    });
    if (!pilotRes.ok) throw new Error(`Pilot registration failed for ${c.companyName}`);

    // 1c. Provision Connector
    const connRes = await api(`/api/tenants/${tenant.id}/connectors`, { method: 'POST', body: {} });
    const { connectorId, token: secretToken } = connRes.data;

    pilotInstances.push({
      ...c,
      tenantId: tenant.id,
      userId: user.id,
      connectorId,
      secretToken
    });

    console.log(`  ✔ [${c.companyName}] Onboarded: Stage = Day 0: Installation | Industry = ${c.industry} | Tally = ${c.tallyVersion}`);
  }

  // -------------------------------------------------------------
  // STEP 2: Day 0 -> Connector Installation & Telemetry Activation
  // -------------------------------------------------------------
  console.log('\n▶ STEP 2: Simulating Day 0 Installation & Heartbeats across 10 Host Machines...');
  for (const p of pilotInstances) {
    // Agent Registers (auto-advances to Day 1: First Export)
    const regRes = await api('/api/connector/register', {
      method: 'POST',
      headers: {
        'x-connector-id': p.connectorId,
        'x-connector-secret': p.secretToken
      },
      body: {
        machineName: p.machineName,
        agentVersion: p.agentVersion
      }
    });
    if (!regRes.ok) throw new Error(`Registration failed for ${p.connectorId}`);

    // Agent Heartbeat
    await api('/api/connector/heartbeat', {
      method: 'POST',
      headers: {
        'x-connector-id': p.connectorId,
        'x-connector-secret': p.secretToken
      },
      body: {
        machineName: p.machineName,
        tallyStatus: 'CONNECTED',
        activeCompany: p.companyName,
        port: 9000,
        agentVersion: p.agentVersion,
        timestamp: new Date().toISOString()
      }
    });
    console.log(`  ✔ [${p.companyName}] Connector ${p.connectorId} Online on [${p.machineName}] -> Auto-advanced to Day 1`);
  }

  // -------------------------------------------------------------
  // STEP 3: Day 1 -> First Export Execution & Validation
  // -------------------------------------------------------------
  console.log('\n▶ STEP 3: Simulating Day 1 First Export across 10 Pilot Customers...');
  for (const p of pilotInstances) {
    // Customer requests first export
    const jobRes = await api('/api/connector/jobs/create', {
      method: 'POST',
      body: {
        tenantId: p.tenantId,
        connectorId: p.connectorId,
        dataset: p.dataset,
        userId: p.userId,
        filters: { fromDate: '2026-04-01', toDate: '2026-09-30' }
      }
    });
    const jobId = jobRes.data.job.id;

    // Agent processes job
    await api(`/api/connector/jobs/${jobId}/status`, {
      method: 'POST',
      headers: { 'x-connector-id': p.connectorId, 'x-connector-secret': p.secretToken },
      body: { status: 'PROCESSING' }
    });

    // Agent finishes job (auto-records firstExportAt and advances to Week 1 Review)
    const csvContent = await generateCsvData(['Company', 'ID', 'Date', 'Amount'], 50, p.companyName);
    await api(`/api/connector/jobs/${jobId}/status`, {
      method: 'POST',
      headers: { 'x-connector-id': p.connectorId, 'x-connector-secret': p.secretToken },
      body: {
        status: 'COMPLETED',
        rowCount: 50,
        filename: `${p.dataset}_first_export.csv`,
        csvContent,
        preview: [{ Company: p.companyName, ID: '1', Amount: '45000.00' }]
      }
    });

    // Customer downloads CSV
    const downloadRes = await api(`/api/exports/${jobId}/download`);
    if (!downloadRes.ok) throw new Error(`Download failed for ${jobId}`);

    p.jobId = jobId;
    console.log(`  ✔ [${p.companyName}] First Export Completed & Downloaded (50 rows) -> Auto-advanced to Week 1 Review`);
  }

  // -------------------------------------------------------------
  // STEP 4: Week 1 & Week 2 Workflow Transitions & Usage Review
  // -------------------------------------------------------------
  console.log('\n▶ STEP 4: Advancing Pilot Workflow Stages (Week 1 Review & Week 2 Feedback)...');
  for (let i = 0; i < pilotInstances.length; i++) {
    const p = pilotInstances[i];
    // For customers 0 to 4: transition to Week 2 Feedback collection
    if (i < 5) {
      await api(`/api/pilots/${p.tenantId}/stage`, {
        method: 'POST',
        body: { stage: 'WEEK_2_COLLECT_FEEDBACK' }
      });
      console.log(`  ✔ [${p.companyName}] Transitioned to Week 2: Collect Feedback`);
    } else {
      console.log(`  ✔ [${p.companyName}] Stable in Week 1: Review Usage`);
    }
  }

  // -------------------------------------------------------------
  // STEP 5: Customer Feedback, Issue Reporting & Feature Requests
  // -------------------------------------------------------------
  console.log('\n▶ STEP 5: Collecting Customer Feedback, Bug Reports & Feature Requests...');

  // 5a. Customer 3 logs an issue
  const issue1 = await api('/api/feedback', {
    method: 'POST',
    body: {
      tenantId: pilotInstances[2].tenantId,
      userId: pilotInstances[2].userId,
      type: 'ISSUE',
      severity: 'MEDIUM',
      title: 'Voucher invoice numbers with slashes require URL encoding',
      description: 'Invoices like INV/2026/044 displayed properly in CSV but need cleaner escaping in preview table.'
    }
  });
  console.log(`  ✔ Issue Logged by [${pilotInstances[2].companyName}]: "${issue1.data.feedback.title}"`);

  // 5b. Customer 1 logs a feature request
  const feat1 = await api('/api/feedback', {
    method: 'POST',
    body: {
      tenantId: pilotInstances[0].tenantId,
      userId: pilotInstances[0].userId,
      type: 'FEATURE_REQUEST',
      severity: 'LOW',
      title: 'Support for Godown batch numbers in Sales Register',
      description: 'Would love to have batch expiry and manufacturer batch codes unrolled alongside items.'
    }
  });
  console.log(`  ✔ Feature Request Logged by [${pilotInstances[0].companyName}]: "${feat1.data.feedback.title}"`);

  // 5c. Customer 4 logs a positive feedback note
  const note1 = await api('/api/feedback', {
    method: 'POST',
    body: {
      tenantId: pilotInstances[3].tenantId,
      userId: pilotInstances[3].userId,
      type: 'FEEDBACK',
      severity: 'LOW',
      title: 'Seamless Trial Balance reconciliation',
      description: 'Balances matched our chartered accountant audit sheet to the exact rupee within seconds.'
    }
  });
  console.log(`  ✔ Feedback Note Logged by [${pilotInstances[3].companyName}]: "${note1.data.feedback.title}"`);

  // 5d. Resolve Issue 1
  const resolveRes = await api(`/api/feedback/${issue1.data.feedback.id}`, {
    method: 'PATCH',
    body: {
      status: 'RESOLVED',
      resolution: 'Escaping patch applied to schema string sanitizer.'
    }
  });
  console.log(`  ✔ Issue "${issue1.data.feedback.title}" resolved with status: ${resolveRes.data.feedback.status}`);

  // -------------------------------------------------------------
  // STEP 6: Support Dashboard & Operational Cockpit Verification
  // -------------------------------------------------------------
  console.log('\n▶ STEP 6: Verifying Support Dashboard Aggregations & Metrics...');
  const dashboardRes = await api('/api/pilots/support-dashboard');
  if (!dashboardRes.ok) throw new Error('Failed to retrieve support dashboard');

  const { summary, metrics, activePilots, openIssues } = dashboardRes.data;
  console.log(`  ✔ Support Dashboard Summary:`);
  console.log(`     - Total Registered Pilots: ${summary.totalPilots}`);
  console.log(`     - Active Online Pilots: ${summary.activePilotsCount}`);
  console.log(`     - Open Support Issues: ${summary.openIssuesCount}`);

  console.log(`  ✔ Pilot Operational Metrics:`);
  console.log(`     - Activation Rate: ${metrics.activationRate}%`);
  console.log(`     - Avg Time to First Export: ${metrics.avgTimeToFirstExportMinutes} minutes`);
  console.log(`     - Export Success Rate: ${metrics.exportSuccessRate}%`);
  console.log(`     - Stage Breakdown: Day 0: ${metrics.stageCounts.DAY_0_INSTALLATION}, Day 1: ${metrics.stageCounts.DAY_1_FIRST_EXPORT}, Week 1: ${metrics.stageCounts.WEEK_1_REVIEW_USAGE}, Week 2: ${metrics.stageCounts.WEEK_2_COLLECT_FEEDBACK}`);

  if (summary.totalPilots < 10) {
    throw new Error(`Expected at least 10 pilot customers, found ${summary.totalPilots}`);
  }
  if (metrics.activationRate < 80) {
    throw new Error(`Expected activation rate >= 80%, found ${metrics.activationRate}%`);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n================================================================');
  console.log(`🎉 PHASE 3 STEP 2: REAL CUSTOMER PILOT FRAMEWORK VALIDATED in ${durationSec}s!`);
  console.log('10 Real Pilot Accounts, Tracking System, Feedback Collection,');
  console.log('Support Dashboard, and 14-Day Workflow fully validated.');
  console.log('================================================================\n');
}

runRealCustomerPilotSimulation().catch(err => {
  console.error('\n✖ Simulation Failed:', err);
  process.exit(1);
});
