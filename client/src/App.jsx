import React, { useState, useEffect, useRef } from 'react';

const DATASETS = [
  {
    key: 'CUSTOMER',
    name: 'Customer Master',
    columnsCount: 36,
    badge: 'Master Data',
    desc: 'Customer accounts with statutory GSTIN, PAN, bank details, credit limits, and addresses.'
  },
  {
    key: 'CHART_OF_ACCOUNTS',
    name: 'Chart of Accounts',
    columnsCount: 17,
    badge: 'Master Data',
    desc: 'General ledger tree, parent groupings, financial summary mappings, and cost behaviors.'
  },
  {
    key: 'SALES_REGISTER',
    name: 'Sales Register',
    columnsCount: 32,
    badge: 'Transactions',
    desc: 'Flattened line-item invoice vouchers with unrolled items, CGST/SGST/IGST, and other charges.'
  },
  {
    key: 'TRIAL_BALANCE',
    name: 'Trial Balance',
    columnsCount: 9,
    badge: 'Financials',
    desc: 'Periodic debit/credit balances, opening and closing positions across all active ledgers.'
  }
];

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Never';
  const diffMs = Date.now() - new Date(timestamp).getTime();
  if (diffMs < 0) return 'Just now';
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export default function App() {
  // Navigation & Company state
  const [currentTab, setCurrentTab] = useState('dashboard'); // 'dashboard' | 'connectors' | 'exports' | 'pilots'
  const [tenants, setTenants] = useState([]);
  const [activeTenant, setActiveTenant] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Authentication State
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(null); // 'login' | 'signup' | null
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authCompany, setAuthCompany] = useState('');
  const [authError, setAuthError] = useState('');

  // Live telemetry state
  const [connectorStatus, setConnectorStatus] = useState(null);
  const [connectorsList, setConnectorsList] = useState([]);
  const [exportJobs, setExportJobs] = useState([]);
  const [previewJob, setPreviewJob] = useState(null);
  const [exportingKey, setExportingKey] = useState(null);
  const [retryingJobId, setRetryingJobId] = useState(null);

  // Export Search & Filter State
  const [exportSearch, setExportSearch] = useState('');
  const [exportStatusFilter, setExportStatusFilter] = useState('ALL');

  // Pilot Framework & Support State (Phase 3 Step 2)
  const [pilotsList, setPilotsList] = useState([]);
  const [pilotMetrics, setPilotMetrics] = useState(null);
  const [supportDashboard, setSupportDashboard] = useState(null);
  const [feedbackList, setFeedbackList] = useState([]);
  const [feedbackForm, setFeedbackForm] = useState({
    type: 'ISSUE',
    severity: 'MEDIUM',
    title: '',
    description: ''
  });
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Export Request Form
  const [newExportForm, setNewExportForm] = useState({
    dataset: 'SALES_REGISTER',
    fromDate: '2026-04-01',
    toDate: '2026-09-30',
    connectorId: ''
  });

  // Onboarding Wizard State
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardCompany, setWizardCompany] = useState('');
  const [wizardUser, setWizardUser] = useState('');
  const [wizardEmail, setWizardEmail] = useState('');
  const [provisionedConnector, setProvisionedConnector] = useState(null);
  const [wizardDetecting, setWizardDetecting] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // 1. Initial Load: Check Auth & Fetch tenants
  const checkAuth = async () => {
    const token = localStorage.getItem('tc_session_token');
    if (!token) return null;

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        if (data.tenant) {
          setActiveTenant(data.tenant);
        }
        return data.user;
      } else {
        localStorage.removeItem('tc_session_token');
        setCurrentUser(null);
      }
    } catch (err) {
      console.error('Session verification error:', err);
    }
    return null;
  };

  const fetchTenants = async () => {
    try {
      const res = await fetch('/api/tenants');
      if (res.ok) {
        const data = await res.json();
        const list = data.tenants || [];
        setTenants(list);

        // Select previously saved tenant or default
        const savedTenantId = localStorage.getItem('tally_active_tenant');
        const matched = list.find((t) => t.id === savedTenantId) || list[0];
        if (matched && !activeTenant) {
          setActiveTenant(matched);
        } else if (list.length === 0) {
          setShowOnboarding(true);
        }
      }
    } catch (err) {
      console.error('Error fetching tenants:', err);
    }
  };

  // 2. Fetch live status, connectors, and jobs for active tenant
  const refreshTenantData = async (tenantId) => {
    if (!tenantId) return;

    try {
      // Connectors
      const connRes = await fetch(`/api/tenants/${tenantId}/connectors`);
      if (connRes.ok) {
        const connData = await connRes.json();
        setConnectorsList(connData.connectors || []);
        if (connData.connectors?.length > 0 && !newExportForm.connectorId) {
          setNewExportForm((prev) => ({ ...prev, connectorId: connData.connectors[0].connectorId }));
        }
      }

      // Export jobs with search and status filters
      let exportUrl = `/api/exports?tenantId=${tenantId}`;
      if (exportSearch) exportUrl += `&search=${encodeURIComponent(exportSearch)}`;
      if (exportStatusFilter !== 'ALL') exportUrl += `&status=${encodeURIComponent(exportStatusFilter)}`;

      const jobsRes = await fetch(exportUrl);
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setExportJobs(jobsData || []);
      }

      // Connector global status
      const statusRes = await fetch('/api/connector/status');
      if (statusRes.ok) {
        const st = await statusRes.json();
        setConnectorStatus(st);
      }
    } catch (err) {
      console.error('Data refresh error:', err);
    }
  };

  // 3. Fetch Pilot & Support Data (Phase 3 Step 2)
  const fetchPilotData = async () => {
    try {
      const [pilotsRes, metricsRes, supportRes, feedbackRes] = await Promise.all([
        fetch('/api/pilots'),
        fetch('/api/pilots/metrics'),
        fetch('/api/pilots/support-dashboard'),
        fetch('/api/feedback')
      ]);

      if (pilotsRes.ok) {
        const d = await pilotsRes.json();
        setPilotsList(d.pilots || []);
      }
      if (metricsRes.ok) {
        const m = await metricsRes.json();
        setPilotMetrics(m);
      }
      if (supportRes.ok) {
        const s = await supportRes.json();
        setSupportDashboard(s);
      }
      if (feedbackRes.ok) {
        const f = await feedbackRes.json();
        setFeedbackList(f.feedback || []);
      }
    } catch (err) {
      console.error('Error fetching pilot support data:', err);
    }
  };

  useEffect(() => {
    checkAuth();
    fetchTenants();
    fetchPilotData();
  }, []);

  useEffect(() => {
    if (activeTenant) {
      localStorage.setItem('tally_active_tenant', activeTenant.id);
      refreshTenantData(activeTenant.id);
      const timer = setInterval(() => {
        refreshTenantData(activeTenant.id);
        if (currentTab === 'pilots') fetchPilotData();
      }, 3000);
      return () => clearInterval(timer);
    }
  }, [activeTenant, exportSearch, exportStatusFilter, currentTab]);

  // Auth Handlers
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      localStorage.setItem('tc_session_token', data.token);
      setCurrentUser(data.user);
      if (data.tenant) setActiveTenant(data.tenant);
      setShowAuthModal(null);
      setAuthPassword('');
      fetchTenants();
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: authName,
          email: authEmail,
          password: authPassword,
          companyName: authCompany
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      localStorage.setItem('tc_session_token', data.token);
      setCurrentUser(data.user);
      setActiveTenant(data.tenant);
      setShowAuthModal(null);
      setAuthPassword('');
      fetchTenants();
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('tc_session_token');
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
      } catch (e) {
        // silent
      }
    }
    localStorage.removeItem('tc_session_token');
    setCurrentUser(null);
  };

  // Onboarding: Step 1 -> Create Company & Tenant
  const handleOnboardingCreateCompany = async (e) => {
    e.preventDefault();
    if (!wizardCompany.trim()) return;

    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: wizardCompany.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create company');

      const createdTenant = data.tenant;
      setTenants((prev) => [createdTenant, ...prev]);
      setActiveTenant(createdTenant);

      // Immediately provision first connector for this tenant
      const connRes = await fetch(`/api/tenants/${createdTenant.id}/connectors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const connData = await connRes.json();
      setProvisionedConnector(connData);

      setWizardStep(2); // Go to step 2: Credentials
    } catch (err) {
      alert(`Signup error: ${err.message}`);
    }
  };

  // Onboarding Step 4: Live Detection Polling
  useEffect(() => {
    let poller;
    if (showOnboarding && wizardStep === 4 && provisionedConnector) {
      setWizardDetecting(true);
      poller = setInterval(async () => {
        try {
          const res = await fetch(`/api/tenants/${activeTenant.id}/connectors`);
          if (res.ok) {
            const data = await res.json();
            const found = data.connectors?.find((c) => c.connectorId === provisionedConnector.connectorId);
            if (found && found.status === 'ONLINE') {
              setWizardDetecting(false);
              clearInterval(poller);
            }
          }
        } catch (err) {
          // Retry
        }
      }, 2000);
    }
    return () => clearInterval(poller);
  }, [showOnboarding, wizardStep, provisionedConnector, activeTenant]);

  // Handle Quick Export from Dashboard
  const triggerQuickExport = async (datasetKey) => {
    if (!activeTenant) return;
    setExportingKey(datasetKey);

    const targetConnector = connectorsList.find((c) => c.status === 'ONLINE')?.connectorId || connectorsList[0]?.connectorId || 'conn_mumbai_hq_01';

    try {
      const res = await fetch('/api/connector/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: activeTenant.id,
          connectorId: targetConnector,
          dataset: datasetKey,
          filters: { fromDate: '2026-04-01', toDate: '2026-09-30' }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Refresh jobs list immediately
      await refreshTenantData(activeTenant.id);
      setCurrentTab('exports');
    } catch (err) {
      alert(`Export request error: ${err.message}`);
    } finally {
      setExportingKey(null);
    }
  };

  // Handle Custom Export Creation from Exports Tab
  const handleCreateCustomExport = async (e) => {
    e.preventDefault();
    if (!activeTenant) return;

    try {
      const res = await fetch('/api/connector/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: activeTenant.id,
          connectorId: newExportForm.connectorId || connectorsList[0]?.connectorId,
          dataset: newExportForm.dataset,
          filters: {
            fromDate: newExportForm.fromDate,
            toDate: newExportForm.toDate
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await refreshTenantData(activeTenant.id);
      alert(`Export request queued successfully! (Job ID: ${data.job.id})`);
    } catch (err) {
      alert(`Failed to create export: ${err.message}`);
    }
  };

  // Handle Retry Failed Job
  const handleRetryJob = async (jobId) => {
    if (!activeTenant) return;
    setRetryingJobId(jobId);
    try {
      const res = await fetch(`/api/exports/${jobId}/retry?tenantId=${activeTenant.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to retry job');
      await refreshTenantData(activeTenant.id);
    } catch (err) {
      alert(`Retry error: ${err.message}`);
    } finally {
      setRetryingJobId(null);
    }
  };

  // Handle Feedback Submission
  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!activeTenant || !feedbackForm.title.trim()) return;

    setSubmittingFeedback(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: activeTenant.id,
          userId: currentUser?.id || null,
          type: feedbackForm.type,
          severity: feedbackForm.severity,
          title: feedbackForm.title.trim(),
          description: feedbackForm.description.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit feedback');

      alert('Thank you! Feedback logged successfully in support portal.');
      setFeedbackForm({ type: 'ISSUE', severity: 'MEDIUM', title: '', description: '' });
      fetchPilotData();
    } catch (err) {
      alert(`Feedback submission error: ${err.message}`);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Handle Advance Workflow Stage
  const handleAdvanceStage = async (tenantId, currentStage) => {
    const stageOrder = ['DAY_0_INSTALLATION', 'DAY_1_FIRST_EXPORT', 'WEEK_1_REVIEW_USAGE', 'WEEK_2_COLLECT_FEEDBACK'];
    const currentIndex = stageOrder.indexOf(currentStage);
    const nextStage = stageOrder[currentIndex + 1] || 'WEEK_2_COLLECT_FEEDBACK';

    try {
      const res = await fetch(`/api/pilots/${tenantId}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: nextStage })
      });
      if (res.ok) {
        fetchPilotData();
      }
    } catch (err) {
      alert(`Stage transition error: ${err.message}`);
    }
  };

  // Handle Resolve Feedback
  const handleResolveFeedback = async (id) => {
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RESOLVED', resolution: 'Resolved by engineering pilot support' })
      });
      if (res.ok) {
        fetchPilotData();
      }
    } catch (err) {
      alert(`Error resolving feedback: ${err.message}`);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const primaryConnector = connectorsList[0] || null;
  const isTallyOnline = connectorStatus?.tallyConnectionStatus === 'CONNECTED' || primaryConnector?.status === 'ONLINE';

  // Customer Setup Checklist status calculations
  const setupStepTally = isTallyOnline || Boolean(connectorStatus?.activeCompany);
  const setupStepAgent = connectorsList.length > 0;
  const setupStepOnline = connectorsList.some((c) => c.status === 'ONLINE');
  const setupStepExport = exportJobs.some((j) => j.status === 'COMPLETED');

  const setupSteps = [
    { id: 1, label: 'Tally Connected', done: setupStepTally, desc: 'TallyPrime XML Server responsive on port 9000' },
    { id: 2, label: 'Agent Installed', done: setupStepAgent, desc: 'Windows background connector provisioned' },
    { id: 3, label: 'Connector Online', done: setupStepOnline, desc: 'Active telemetry heartbeat within 90s' },
    { id: 4, label: 'First Export Completed', done: setupStepExport, desc: 'Extracted & generated verified CSV dataset' }
  ];

  const completedStepsCount = setupSteps.filter((s) => s.done).length;
  const setupProgressPct = Math.round((completedStepsCount / setupSteps.length) * 100);

  return (
    <div className="app-container">
      {/* ============================================================== */}
      {/* Header                                                         */}
      {/* ============================================================== */}
      <header className="app-header">
        <div className="brand-wrapper">
          <div className="brand-logo">TC</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="brand-title">Tally Connect</span>
              <span className="badge-pill blue">Customer Pilot</span>
            </div>
            <p className="brand-subtitle">Automated TallyPrime Middleware Platform</p>
          </div>
        </div>

        <div className="header-actions">
          {/* Active Company Selector */}
          <div className="company-selector-wrapper">
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>🏢</span>
            <select
              value={activeTenant?.id || ''}
              onChange={(e) => {
                const selected = tenants.find((t) => t.id === e.target.value);
                if (selected) setActiveTenant(selected);
              }}
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.companyName}
                </option>
              ))}
            </select>
          </div>

          {/* User Auth Info / Login Controls */}
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ textAlign: 'right', fontSize: 12 }}>
                <div style={{ color: '#fff', fontWeight: 600 }}>{currentUser.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{currentUser.email}</div>
              </div>
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={handleLogout}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => {
                  setAuthError('');
                  setShowAuthModal('login');
                }}
              >
                Sign In
              </button>
              <button
                className="btn btn-primary"
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => {
                  setAuthError('');
                  setShowAuthModal('signup');
                }}
              >
                Create Account
              </button>
            </div>
          )}

          {/* New Company Onboarding Button */}
          <button
            className="btn btn-secondary"
            onClick={() => {
              setWizardStep(1);
              setWizardCompany('');
              setShowOnboarding(true);
            }}
          >
            + New Company Setup
          </button>

          {/* Download Agent Button */}
          <a
            href="/api/agent/download"
            className="btn btn-primary"
            download
            style={{ textDecoration: 'none' }}
          >
            📥 Download Agent (.exe)
          </a>
        </div>
      </header>

      {/* ============================================================== */}
      {/* Navigation Tabs                                                */}
      {/* ============================================================== */}
      <nav className="tabs-nav">
        <button
          className={`tab-btn ${currentTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setCurrentTab('dashboard')}
        >
          📊 Dashboard
        </button>
        <button
          className={`tab-btn ${currentTab === 'connectors' ? 'active' : ''}`}
          onClick={() => setCurrentTab('connectors')}
        >
          🔌 Connectors ({connectorsList.length})
        </button>
        <button
          className={`tab-btn ${currentTab === 'exports' ? 'active' : ''}`}
          onClick={() => setCurrentTab('exports')}
        >
          📁 Export History ({exportJobs.length})
        </button>
        <button
          className={`tab-btn ${currentTab === 'pilots' ? 'active' : ''}`}
          onClick={() => {
            setCurrentTab('pilots');
            fetchPilotData();
          }}
        >
          🛡 Support & Pilots ({pilotsList.length})
        </button>
      </nav>

      {/* ============================================================== */}
      {/* TAB 1: DASHBOARD                                               */}
      {/* ============================================================== */}
      {currentTab === 'dashboard' && (
        <section>
          {/* Customer Setup Checklist */}
          <div className="checklist-card">
            <div className="checklist-header">
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>
                  🚀 Customer Setup Checklist ({activeTenant?.companyName || 'Getting Started'})
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Complete operational readiness steps for automated TallyPrime data sync
                </p>
              </div>
              <span className={`badge-pill ${setupProgressPct === 100 ? 'green' : 'amber'}`}>
                {setupProgressPct === 100 ? 'Ready for Production (100%)' : `${completedStepsCount} of ${setupSteps.length} Completed (${setupProgressPct}%)`}
              </span>
            </div>

            <div className="checklist-progress-bar">
              <div className="checklist-progress-fill" style={{ width: `${setupProgressPct}%` }} />
            </div>

            <div className="checklist-steps">
              {setupSteps.map((step) => (
                <div key={step.id} className={`checklist-step-item ${step.done ? 'done' : ''}`}>
                  <div className="checklist-check-icon">{step.done ? '✔' : step.id}</div>
                  <div>
                    <div style={{ color: step.done ? '#fff' : 'var(--text-secondary)' }}>{step.label}</div>
                    <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginTop: 2 }}>
                      {step.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Telemetry Summary Cards */}
          <div className="status-grid">
            {/* 1. Connector Status */}
            <div className="status-card">
              <div className="status-label">Desktop Connector</div>
              <div className="status-value">
                <span className={`status-dot ${isTallyOnline ? 'online' : 'offline'}`} />
                <span>{isTallyOnline ? 'Connected' : 'Offline'}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Host: {primaryConnector?.machineName || connectorStatus?.machineName || 'Customer PC'}
              </div>
            </div>

            {/* 2. Company Details */}
            <div className="status-card">
              <div className="status-label">Active Company</div>
              <div className="status-value" style={{ fontSize: 14 }}>
                {activeTenant?.companyName || 'No Company Selected'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--accent-blue)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                Tenant: {activeTenant?.id || '—'}
              </div>
            </div>

            {/* 3. TallyPrime Status */}
            <div className="status-card">
              <div className="status-label">TallyPrime Link</div>
              <div className="status-value">
                <span className={`status-dot ${isTallyOnline ? 'online' : 'offline'}`} />
                <span style={{ fontSize: 14 }}>Port 9000 (XML)</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {connectorStatus?.activeCompany || primaryConnector?.activeCompany || 'National Trading Corporation'}
              </div>
            </div>

            {/* 4. Last Sync / Heartbeat */}
            <div className="status-card">
              <div className="status-label">Last Heartbeat</div>
              <div className="status-value" style={{ fontSize: 14 }}>
                {primaryConnector?.lastHeartbeat
                  ? formatTimeAgo(primaryConnector.lastHeartbeat)
                  : 'Awaiting pulse'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--accent-green)', marginTop: 4 }}>
                Pulse: Every 30s (&lt; 90s cutoff)
              </div>
            </div>
          </div>

          {/* Quick Dataset Exports Section */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Dataset Export Cockpit</h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Request live extractions from local TallyPrime and export into standardized formats
                </p>
              </div>
            </div>

            <div className="datasets-grid">
              {DATASETS.map((ds) => (
                <div key={ds.key} className="dataset-card">
                  <div className="dataset-header">
                    <span className="dataset-badge">{ds.badge}</span>
                    <span className="dataset-cols">{ds.columnsCount} Columns</span>
                  </div>
                  <h3 className="dataset-title">{ds.name}</h3>
                  <p className="dataset-desc">{ds.desc}</p>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: 'auto' }}
                    disabled={exportingKey === ds.key}
                    onClick={() => triggerQuickExport(ds.key)}
                  >
                    {exportingKey === ds.key ? (
                      <>
                        <div className="spinner" />
                        <span>Extracting...</span>
                      </>
                    ) : (
                      <>
                        <span>⚡ Export {ds.name}</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* TAB 2: CONNECTORS                                              */}
      {/* ============================================================== */}
      {currentTab === 'connectors' && (
        <section className="card-table-container">
          <div className="section-top-bar">
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Provisioned Connectors & Health Telemetry</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Registered desktop connector instances linked to {activeTenant?.companyName}
              </p>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setWizardStep(2);
                setShowOnboarding(true);
              }}
            >
              + Provision New Connector
            </button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Connector ID</th>
                  <th>Machine Name</th>
                  <th>Status</th>
                  <th>Agent Version</th>
                  <th>Last Seen</th>
                  <th>Health & Reason</th>
                  <th>Active Company</th>
                </tr>
              </thead>
              <tbody>
                {connectorsList.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-state">
                      <div className="empty-icon">🔌</div>
                      No connectors provisioned yet for this company.
                    </td>
                  </tr>
                ) : (
                  connectorsList.map((c) => (
                    <tr key={c.id || c.connectorId}>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)', fontWeight: 600 }}>
                        {c.connectorId}
                      </td>
                      <td>{c.machineName || 'Pending First Connect'}</td>
                      <td>
                        <span className={`badge-pill ${c.status === 'ONLINE' ? 'green' : 'red'}`}>
                          {c.status || 'OFFLINE'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                          {c.agentVersion || '1.0.0-beta'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {c.lastHeartbeat ? (
                          <div>
                            <div>{formatTimeAgo(c.lastHeartbeat)}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              {new Date(c.lastHeartbeat).toLocaleTimeString()}
                            </div>
                          </div>
                        ) : (
                          'Never'
                        )}
                      </td>
                      <td>
                        {c.lastError ? (
                          <span style={{ color: 'var(--accent-red)', fontSize: 12 }}>
                            ⚠ {c.lastError}
                          </span>
                        ) : c.status === 'OFFLINE' ? (
                          <span style={{ color: 'var(--accent-amber)', fontSize: 12 }}>
                            Timed out (&gt;90s without pulse)
                          </span>
                        ) : (
                          <span style={{ color: 'var(--accent-green)', fontSize: 12 }}>
                            ✔ Operational
                          </span>
                        )}
                      </td>
                      <td>{c.activeCompany || 'TallyPrime 4.1'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* TAB 3: EXPORTS                                                 */}
      {/* ============================================================== */}
      {currentTab === 'exports' && (
        <section className="card-table-container">
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Export History & Downloads</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Submit new extraction requests, search export runs, and download streaming CSV records (7-day download retention).
            </p>

            <form onSubmit={handleCreateCustomExport} className="filters-bar">
              <div>
                <label className="form-label">Target Dataset</label>
                <select
                  className="form-input"
                  style={{ width: 180 }}
                  value={newExportForm.dataset}
                  onChange={(e) => setNewExportForm({ ...newExportForm, dataset: e.target.value })}
                >
                  {DATASETS.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">From Date</label>
                <input
                  type="date"
                  className="form-input"
                  style={{ width: 140 }}
                  value={newExportForm.fromDate}
                  onChange={(e) => setNewExportForm({ ...newExportForm, fromDate: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">To Date</label>
                <input
                  type="date"
                  className="form-input"
                  style={{ width: 140 }}
                  value={newExportForm.toDate}
                  onChange={(e) => setNewExportForm({ ...newExportForm, toDate: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">Connector</label>
                <select
                  className="form-input"
                  style={{ width: 200 }}
                  value={newExportForm.connectorId}
                  onChange={(e) => setNewExportForm({ ...newExportForm, connectorId: e.target.value })}
                >
                  {connectorsList.map((c) => (
                    <option key={c.connectorId} value={c.connectorId}>
                      {c.connectorId} ({c.status})
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ height: 42 }}>
                ⚡ Request Export
              </button>
            </form>
          </div>

          {/* Search & Filter Toolbar */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                className="form-input"
                placeholder="🔍 Search exports by Job ID or Dataset..."
                value={exportSearch}
                onChange={(e) => setExportSearch(e.target.value)}
              />
            </div>
            <div>
              <select
                className="form-input"
                style={{ width: 160 }}
                value={exportStatusFilter}
                onChange={(e) => setExportStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="PROCESSING">Processing</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Dataset</th>
                  <th>Filters / Period</th>
                  <th>Status</th>
                  <th>Rows</th>
                  <th>Expiry / Retention</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {exportJobs.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="empty-state">
                      <div className="empty-icon">📁</div>
                      No matching export runs found.
                    </td>
                  </tr>
                ) : (
                  exportJobs.map((j) => {
                    const isExpired = j.isDownloadExpired || (j.expiresAt && new Date(j.expiresAt) < new Date());
                    return (
                      <tr key={j.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
                          {j.id}
                        </td>
                        <td>
                          <span className="badge-pill blue">{j.dataset}</span>
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {j.filters?.fromDate && j.filters?.toDate
                            ? `${j.filters.fromDate} to ${j.filters.toDate}`
                            : 'All Records'}
                        </td>
                        <td>
                          <span
                            className={`badge-pill ${
                              j.status === 'COMPLETED' ? 'green' : j.status === 'PROCESSING' ? 'amber' : 'red'
                            }`}
                          >
                            {j.status}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{j.rowCount != null ? j.rowCount.toLocaleString() : '—'}</td>
                        <td style={{ fontSize: 11 }}>
                          {j.status === 'COMPLETED' ? (
                            isExpired ? (
                              <span className="badge-pill red">Expired</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>
                                {j.expiresAt ? `Valid till ${new Date(j.expiresAt).toLocaleDateString()}` : '7 Days'}
                              </span>
                            )
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{new Date(j.createdAt).toLocaleTimeString()}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {j.status === 'COMPLETED' && (
                              <>
                                {isExpired ? (
                                  <button
                                    className="btn btn-secondary"
                                    disabled
                                    style={{ padding: '4px 10px', fontSize: 11, opacity: 0.5 }}
                                    title="Export file download has expired"
                                  >
                                    Expired
                                  </button>
                                ) : (
                                  <a
                                    href={`/api/exports/${j.id}/download`}
                                    download={j.filename || `${j.dataset}.csv`}
                                    className="btn btn-download"
                                    style={{ padding: '4px 10px', fontSize: 11 }}
                                  >
                                    ⬇ Download CSV
                                  </a>
                                )}
                                {j.preview && j.preview.length > 0 && (
                                  <button
                                    className="btn btn-secondary"
                                    style={{ padding: '4px 8px', fontSize: 11 }}
                                    onClick={() => setPreviewJob(j)}
                                  >
                                    👁 Preview
                                  </button>
                                )}
                              </>
                            )}

                            {j.status === 'PROCESSING' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--accent-amber)' }}>
                                <div className="spinner" />
                                <span>Processing...</span>
                              </div>
                            )}

                            {j.status === 'FAILED' && (
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '4px 10px', fontSize: 11, color: 'var(--accent-amber)', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                                disabled={retryingJobId === j.id}
                                onClick={() => handleRetryJob(j.id)}
                              >
                                {retryingJobId === j.id ? 'Retrying...' : '🔄 Retry Export'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* TAB 4: SUPPORT & PILOTS (Phase 3 Step 2)                       */}
      {/* ============================================================== */}
      {currentTab === 'pilots' && (
        <section>
          {/* Operational Metrics Bar */}
          <div className="support-metrics-grid">
            <div className="support-metric-card">
              <div className="metric-label">Active Pilot Customers</div>
              <div className="metric-val">
                <span>{pilotMetrics?.totalPilots || pilotsList.length}</span>
                <span className="badge-pill green" style={{ fontSize: 11 }}>10 Pilot Target</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {supportDashboard?.summary?.activePilotsCount || 0} online / {supportDashboard?.summary?.offlineConnectorsCount || 0} offline
              </div>
            </div>

            <div className="support-metric-card">
              <div className="metric-label">Activation Rate</div>
              <div className="metric-val">
                <span style={{ color: 'var(--accent-green)' }}>{pilotMetrics?.activationRate || 0}%</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Installed & online on Day 0
              </div>
            </div>

            <div className="support-metric-card">
              <div className="metric-label">Time to First Export</div>
              <div className="metric-val">
                <span style={{ color: 'var(--accent-blue)' }}>{pilotMetrics?.avgTimeToFirstExportMinutes || 0}m</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Average setup-to-data duration
              </div>
            </div>

            <div className="support-metric-card">
              <div className="metric-label">Export Success Rate</div>
              <div className="metric-val">
                <span style={{ color: 'var(--accent-cyan)' }}>{pilotMetrics?.exportSuccessRate || 100}%</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {pilotMetrics?.completedExports || 0} completed / {pilotMetrics?.failedExports || 0} failed
              </div>
            </div>
          </div>

          {/* 14-Day Pilot Onboarding Workflow Tracker */}
          <div className="workflow-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>
                  📅 14-Day Pilot Onboarding Workflow Stages
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Standard operating sequence for external customer onboarding & feedback graduation
                </p>
              </div>
            </div>

            <div className="workflow-stages-container">
              <div className="workflow-stage-box active">
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase' }}>
                  Day 0
                </div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: 14, margin: '4px 0' }}>
                  Installation ({pilotMetrics?.stageCounts?.DAY_0_INSTALLATION || 0})
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Desktop agent provisioned as Windows background service
                </div>
              </div>

              <div className="workflow-stage-box active">
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-green)', textTransform: 'uppercase' }}>
                  Day 1
                </div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: 14, margin: '4px 0' }}>
                  First Export ({pilotMetrics?.stageCounts?.DAY_1_FIRST_EXPORT || 0})
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  First ledger master extract & CSV validation
                </div>
              </div>

              <div className="workflow-stage-box active">
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-amber)', textTransform: 'uppercase' }}>
                  Week 1
                </div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: 14, margin: '4px 0' }}>
                  Review Usage ({pilotMetrics?.stageCounts?.WEEK_1_REVIEW_USAGE || 0})
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Scheduled sync, sales register & large dataset audit
                </div>
              </div>

              <div className="workflow-stage-box active">
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>
                  Week 2
                </div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: 14, margin: '4px 0' }}>
                  Collect Feedback ({pilotMetrics?.stageCounts?.WEEK_2_COLLECT_FEEDBACK || 0})
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Issue triage, feature requests & commercial graduation
                </div>
              </div>
            </div>
          </div>

          {/* Pilot Customers Tracking Table */}
          <div className="card-table-container" style={{ marginBottom: 24 }}>
            <div className="section-top-bar">
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>
                  👥 Pilot Customer Tracking Roster ({pilotsList.length} Accounts)
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Tracking Tally versions, data volumes, connection health, and workflow stages
                </p>
              </div>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Customer / Company</th>
                    <th>Industry</th>
                    <th>Tally Version</th>
                    <th>Data Volume</th>
                    <th>Connector Status</th>
                    <th>First Export</th>
                    <th>Workflow Stage</th>
                    <th>Issues</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pilotsList.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="empty-state">
                        <div className="empty-icon">👥</div>
                        No pilot customers registered yet. Run simulation to populate.
                      </td>
                    </tr>
                  ) : (
                    pilotsList.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: '#fff' }}>{p.companyName}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.customerName} ({p.contactEmail})</div>
                        </td>
                        <td style={{ fontSize: 12 }}>{p.industry}</td>
                        <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{p.tallyVersion}</td>
                        <td style={{ fontSize: 12 }}>{p.dataSizeCategory}</td>
                        <td>
                          <span className={`badge-pill ${p.connectorLiveStatus === 'ONLINE' ? 'green' : p.connectorLiveStatus === 'DEGRADED' ? 'amber' : 'red'}`}>
                            {p.connectorLiveStatus}
                          </span>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {p.firstExportAt ? new Date(p.firstExportAt).toLocaleDateString() : 'Pending'}
                        </td>
                        <td>
                          <span className="badge-pill blue" style={{ fontSize: 10 }}>
                            {p.stage.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: p.issuesCount > 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                          {p.issuesCount}
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '3px 8px', fontSize: 11 }}
                            onClick={() => handleAdvanceStage(p.tenantId, p.stage)}
                          >
                            Advance ➡
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Feedback & Support Desk Grid */}
          <div className="feedback-grid">
            {/* Feedback Submission Card */}
            <div style={{ background: 'var(--bg-secondary)', padding: 20, borderRadius: 10, border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                📝 Log Customer Feedback / Issue
              </h4>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                Record bug reports, feedback notes, or feature requests for {activeTenant?.companyName}
              </p>

              <form onSubmit={handleSubmitFeedback}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-input"
                    value={feedbackForm.type}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, type: e.target.value })}
                  >
                    <option value="ISSUE">Issue / Bug Report</option>
                    <option value="FEEDBACK">Feedback Note</option>
                    <option value="FEATURE_REQUEST">Feature Request</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Severity</label>
                  <select
                    className="form-input"
                    value={feedbackForm.severity}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, severity: e.target.value })}
                  >
                    <option value="LOW">Low - General query</option>
                    <option value="MEDIUM">Medium - Non-blocking inconvenience</option>
                    <option value="HIGH">High - Export delay / partial data</option>
                    <option value="CRITICAL">Critical - Connector crash / sync blocked</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Title / Summary</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Brief description..."
                    required
                    value={feedbackForm.title}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, title: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Detailed Notes</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    placeholder="Details, steps to reproduce, or request..."
                    required
                    value={feedbackForm.description}
                    onChange={(e) => setFeedbackForm({ ...feedbackForm, description: e.target.value })}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 8 }}
                  disabled={submittingFeedback}
                >
                  {submittingFeedback ? 'Logging...' : 'Submit to Support Desk'}
                </button>
              </form>
            </div>

            {/* Feedback & Open Issues List */}
            <div className="card-table-container">
              <div className="section-top-bar">
                <h4 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>
                  🎫 Customer Feedback & Open Issues ({feedbackList.length})
                </h4>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Severity</th>
                      <th>Company & Summary</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedbackList.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="empty-state">
                          <div className="empty-icon">✔</div>
                          No issues reported yet. All pilot systems running cleanly.
                        </td>
                      </tr>
                    ) : (
                      feedbackList.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <span className="badge-pill blue" style={{ fontSize: 10 }}>
                              {item.type}
                            </span>
                          </td>
                          <td>
                            <span className={`badge-pill ${item.severity === 'CRITICAL' || item.severity === 'HIGH' ? 'red' : 'amber'}`} style={{ fontSize: 10 }}>
                              {item.severity}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: '#fff' }}>{item.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {item.companyName || 'Pilot Tenant'} — {item.description}
                            </div>
                          </td>
                          <td>
                            <span className={`badge-pill ${item.status === 'RESOLVED' ? 'green' : 'amber'}`}>
                              {item.status}
                            </span>
                          </td>
                          <td>
                            {item.status !== 'RESOLVED' && (
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '3px 8px', fontSize: 11 }}
                                onClick={() => handleResolveFeedback(item.id)}
                              >
                                Resolve ✔
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* DATA PREVIEW MODAL                                             */}
      {/* ============================================================== */}
      {previewJob && (
        <div className="modal-overlay" onClick={() => setPreviewJob(null)}>
          <div className="modal-content" style={{ maxWidth: 840 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Dataset Preview: {previewJob.dataset}</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Showing top 5 rows exported by agent</p>
              </div>
              <button className="modal-close" onClick={() => setPreviewJob(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      {previewJob.preview && previewJob.preview[0] &&
                        Object.keys(previewJob.preview[0]).map((col) => <th key={col}>{col}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {previewJob.preview?.map((row, idx) => (
                      <tr key={idx}>
                        {Object.values(row).map((val, i) => (
                          <td key={i}>{String(val)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <a
                  href={`/api/exports/${previewJob.id}/download`}
                  download={previewJob.filename}
                  className="btn btn-download"
                >
                  Download Complete CSV ({previewJob.rowCount} rows)
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* USER AUTH MODAL (Login & Signup)                               */}
      {/* ============================================================== */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(null)}>
          <div className="modal-content" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {showAuthModal === 'login' ? 'Customer Account Sign In' : 'Create Beta Customer Account'}
              </h3>
              <button className="modal-close" onClick={() => setShowAuthModal(null)}>✕</button>
            </div>

            <div className="modal-body">
              {authError && (
                <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 6, color: '#f87171', fontSize: 13, marginBottom: 16 }}>
                  {authError}
                </div>
              )}

              {showAuthModal === 'login' ? (
                <form onSubmit={handleLogin}>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-input"
                      required
                      placeholder="admin@company.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-input"
                      required
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>
                    Sign In
                  </button>
                  <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>
                    New beta customer?{' '}
                    <span
                      style={{ color: 'var(--accent-blue)', cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => setShowAuthModal('signup')}
                    >
                      Create company account
                    </span>
                  </p>
                </form>
              ) : (
                <form onSubmit={handleSignup}>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      placeholder="e.g. Vikram Mehta"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Company Legal Name</label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      placeholder="e.g. Apex Industrial Solutions Ltd"
                      value={authCompany}
                      onChange={(e) => setAuthCompany(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Work Email</label>
                    <input
                      type="email"
                      className="form-input"
                      required
                      placeholder="vikram@apex-industries.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-input"
                      required
                      placeholder="Minimum 8 characters"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>
                    Create Account & Company Tenant
                  </button>
                  <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>
                    Already have an account?{' '}
                    <span
                      style={{ color: 'var(--accent-blue)', cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => setShowAuthModal('login')}
                    >
                      Sign In
                    </span>
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ONBOARDING WIZARD MODAL                                        */}
      {/* ============================================================== */}
      {showOnboarding && (
        <div className="modal-overlay" onClick={() => setShowOnboarding(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Customer Onboarding Wizard</h3>
              <button className="modal-close" onClick={() => setShowOnboarding(false)}>✕</button>
            </div>

            <div className="modal-body">
              {/* Step indicator */}
              <div className="steps-indicator">
                <div className={`step-item ${wizardStep >= 1 ? 'active' : ''} ${wizardStep > 1 ? 'completed' : ''}`}>
                  <div className="step-bubble">{wizardStep > 1 ? '✔' : '1'}</div>
                  <span className="step-name">Company</span>
                </div>
                <div className={`step-item ${wizardStep >= 2 ? 'active' : ''} ${wizardStep > 2 ? 'completed' : ''}`}>
                  <div className="step-bubble">{wizardStep > 2 ? '✔' : '2'}</div>
                  <span className="step-name">Credentials</span>
                </div>
                <div className={`step-item ${wizardStep >= 3 ? 'active' : ''} ${wizardStep > 3 ? 'completed' : ''}`}>
                  <div className="step-bubble">{wizardStep > 3 ? '✔' : '3'}</div>
                  <span className="step-name">Download</span>
                </div>
                <div className={`step-item ${wizardStep >= 4 ? 'active' : ''}`}>
                  <div className="step-bubble">4</div>
                  <span className="step-name">Connect</span>
                </div>
              </div>

              {/* Wizard Step 1: Create Account & Company */}
              {wizardStep === 1 && (
                <form onSubmit={handleOnboardingCreateCompany}>
                  <div className="form-group">
                    <label className="form-label">Company Legal Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Apex Industrial Solutions Ltd"
                      value={wizardCompany}
                      onChange={(e) => setWizardCompany(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Admin Contact Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Rajesh Sharma"
                      value={wizardUser}
                      onChange={(e) => setWizardUser(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Work Email</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="e.g. rajesh@apex-industries.com"
                      value={wizardEmail}
                      onChange={(e) => setWizardEmail(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 12 }}>
                    Continue to Connector Setup →
                  </button>
                </form>
              )}

              {/* Wizard Step 2: Credentials */}
              {wizardStep === 2 && provisionedConnector && (
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                    Connector Credentials Generated
                  </h4>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Save these credentials. The secret token is stored securely as a cryptographic hash and cannot be recovered later.
                  </p>

                  <div className="form-group" style={{ marginTop: 16 }}>
                    <label className="form-label">Connector ID</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        className="form-input"
                        readOnly
                        value={provisionedConnector.connectorId}
                      />
                      <button
                        className="btn btn-secondary"
                        onClick={() => copyToClipboard(provisionedConnector.connectorId)}
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Secret Token</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        className="form-input"
                        readOnly
                        value={provisionedConnector.token}
                      />
                      <button
                        className="btn btn-secondary"
                        onClick={() => copyToClipboard(provisionedConnector.token)}
                      >
                        {copiedToken ? '✔ Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: 12 }}
                    onClick={() => setWizardStep(3)}
                  >
                    Proceed to Download Agent →
                  </button>
                </div>
              )}

              {/* Wizard Step 3: Download Agent */}
              {wizardStep === 3 && (
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                    Download Tally Connect Agent
                  </h4>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Install this lightweight agent on the Windows machine where TallyPrime is running.
                  </p>

                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <a
                      href="/api/agent/download"
                      className="btn btn-primary"
                      download
                      style={{ padding: '12px 28px', fontSize: 15, textDecoration: 'none' }}
                    >
                      📥 Download TallyConnectAgentSetup.exe
                    </a>
                  </div>

                  <div className="code-box">
                    <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}># Quick-run CLI command:</div>
                    <code>
                      ./TallyConnectAgentSetup.exe --connector-id {provisionedConnector?.connectorId} --secret {provisionedConnector?.token}
                    </code>
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: 8 }}
                    onClick={() => setWizardStep(4)}
                  >
                    I Have Started the Agent →
                  </button>
                </div>
              )}

              {/* Wizard Step 4: Live Detection */}
              {wizardStep === 4 && (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  {wizardDetecting ? (
                    <div>
                      <div className="spinner" style={{ width: 36, height: 36, margin: '0 auto 16px', borderWidth: 3 }} />
                      <h4 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
                        Waiting for Agent Connection...
                      </h4>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        Probing TallyPrime on port 9000 from host machine. This will update automatically.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 42, marginBottom: 12 }}>🎉</div>
                      <h4 style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-green)', marginBottom: 8 }}>
                        TallyPrime Successfully Connected!
                      </h4>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                        Connector <strong>{provisionedConnector?.connectorId}</strong> is online and verified with company{' '}
                        <strong>{activeTenant?.companyName}</strong>.
                      </p>
                      <button
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                        onClick={() => setShowOnboarding(false)}
                      >
                        Enter Beta Dashboard →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
