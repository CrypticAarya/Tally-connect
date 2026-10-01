import express from 'express';
import fs from 'fs';
import path from 'path';
import { connectorService } from '../connector/index.js';
import { Repository } from '../db/repository.js';
import { authenticateConnector } from '../middleware/connectorAuth.js';
import { authenticateUser } from '../middleware/userAuth.js';
import { AgentVersionService } from '../services/agentVersionService.js';
import { getActiveEnvironment, ENVIRONMENTS } from '../config/environments.js';
import { PilotService, WORKFLOW_STAGES } from '../services/pilotService.js';

const router = express.Router();

// ==========================================
// 1. USER AUTHENTICATION & SESSIONS
// ==========================================

/**
 * POST /api/auth/signup
 * Customer signs up -> Creates Tenant -> Creates User -> Generates Session Token
 */
router.post('/auth/signup', async (req, res) => {
  const { name, email, password, companyName } = req.body || {};
  if (!name || !email || !password || !companyName) {
    return res.status(400).json({
      error: 'Missing required signup fields: "name", "email", "password", and "companyName"'
    });
  }

  try {
    const existing = await Repository.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: `An account with email "${email}" already exists` });
    }

    const tenant = await Repository.createTenant(companyName);
    const user = await Repository.createUser({
      tenantId: tenant.id,
      name,
      email,
      password,
      role: 'admin'
    });
    const session = await Repository.createSession(user.id, tenant.id);

    // Audit log
    await Repository.logAudit({
      tenantId: tenant.id,
      userId: user.id,
      action: 'signup',
      metadata: { email, companyName, role: user.role }
    });

    return res.status(201).json({
      success: true,
      user,
      tenant,
      token: session.id
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/login
 * Customer signs in with email and password (tracks 'login' audit log)
 */
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  try {
    const user = await Repository.authenticateUser(email, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const tenant = await Repository.getTenant(user.tenantId);
    const session = await Repository.createSession(user.id, user.tenantId);

    // Track Requirement 1: login audit log
    await Repository.logAudit({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'login',
      metadata: {
        email,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    return res.json({
      success: true,
      user,
      tenant,
      token: session.id
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/logout
 * Terminates user session (tracks 'logout' audit log)
 */
router.post('/auth/logout', async (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/, '') || req.body?.token;
  if (token) {
    const session = await Repository.getSession(token);
    if (session) {
      // Track Requirement 1: logout audit log
      await Repository.logAudit({
        tenantId: session.tenantId,
        userId: session.userId,
        action: 'logout',
        metadata: {
          sessionToken: `${token.slice(0, 8)}...`,
          terminatedAt: new Date().toISOString()
        }
      });
    }
    await Repository.deleteSession(token);
  }
  return res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * GET /api/auth/me
 * Returns current authenticated user and tenant profile
 */
router.get('/auth/me', authenticateUser, (req, res) => {
  return res.json({
    user: req.user,
    tenant: req.tenant
  });
});

// ==========================================
// 2. TENANT MANAGEMENT & PROVISIONING ROUTES
// ==========================================

/**
 * POST /api/tenants
 * Registers a new customer tenant
 */
router.post('/tenants', async (req, res) => {
  const { companyName } = req.body || {};
  if (!companyName) {
    return res.status(400).json({ error: 'Missing required field: "companyName"' });
  }

  try {
    const tenant = await Repository.createTenant(companyName);
    return res.status(201).json({ success: true, tenant });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/tenants
 * Lists all registered tenants
 */
router.get('/tenants', async (req, res) => {
  try {
    const tenants = await Repository.listTenants();
    return res.json({ tenants });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/tenants/:tenantId
 * Retrieves tenant info by ID
 */
router.get('/tenants/:tenantId', async (req, res) => {
  const { tenantId } = req.params;
  try {
    const tenant = await Repository.getTenant(tenantId);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    return res.json({ tenant });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/tenants/:tenantId/connectors
 * Lists all connectors provisioned for this tenant with offline detection and error reasons
 */
router.get('/tenants/:tenantId/connectors', async (req, res) => {
  const { tenantId } = req.params;
  try {
    const connectors = await Repository.listConnectorsForTenant(tenantId);
    return res.json({ connectors });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/tenants/:tenantId/connectors
 * Provisions a new connector and returns the secret token
 */
router.post('/tenants/:tenantId/connectors', async (req, res) => {
  const { tenantId } = req.params;
  const { connectorId } = req.body || {};

  try {
    const provision = await Repository.provisionConnector(tenantId, connectorId);
    return res.status(201).json({
      success: true,
      ...provision
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 3. CONNECTOR AGENT LIFECYCLE & POLLING
// ==========================================

/**
 * GET /api/connector/status
 * Returns real-time desktop connector and TallyPrime connection status
 */
router.get('/connector/status', (req, res) => {
  try {
    const status = connectorService.getStatus();
    return res.json(status);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/connector/register
 * Handles enrollment/registration from desktop connector agent (tracks 'connector_registration' audit log)
 */
router.post('/connector/register', authenticateConnector, async (req, res) => {
  const { machineName, agentVersion } = req.body || {};
  const clientVersion = agentVersion || req.connector.agentVersion || '1.0.0-beta';
  const versionEval = AgentVersionService.evaluateVersion(clientVersion);

  try {
    const result = await connectorService.handleRegister({
      connectorId: req.connector.connectorId,
      machineName: machineName || req.connector.machineName,
      agentVersion: clientVersion,
      tenantId: req.connector.tenantId
    });

    // Track Requirement 1: connector registration audit log
    await Repository.logAudit({
      tenantId: req.connector.tenantId,
      userId: null,
      action: 'connector_registration',
      metadata: {
        connectorId: req.connector.connectorId,
        machineName: machineName || req.connector.machineName,
        agentVersion: clientVersion,
        isSupported: versionEval.isSupported,
        isUpdateAvailable: versionEval.isUpdateAvailable
      }
    });

    // Auto-advance pilot workflow stage to Day 1: First Export
    await Repository.updatePilotStage(req.connector.tenantId, 'DAY_1_FIRST_EXPORT');

    return res.status(200).json({
      success: true,
      registered: true,
      connectorId: req.connector.connectorId,
      tenantId: req.connector.tenantId,
      companyName: req.connector.companyName,
      cloudTime: result.cloudTime,
      versionInfo: versionEval
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/connector/heartbeat
 * Receives recurring telemetry heartbeats from desktop connector agent
 */
router.post('/connector/heartbeat', authenticateConnector, async (req, res) => {
  const { machineName, tallyStatus, activeCompany, port, timestamp, agentVersion, lastError } = req.body || {};
  const clientVersion = agentVersion || req.connector.agentVersion || '1.0.0-beta';
  const versionEval = AgentVersionService.evaluateVersion(clientVersion);

  try {
    const result = await connectorService.handleHeartbeat({
      connectorId: req.connector.connectorId,
      tenantId: req.connector.tenantId,
      machineName,
      tallyStatus,
      activeCompany,
      port,
      timestamp,
      agentVersion: clientVersion,
      lastError
    });

    return res.status(200).json({
      ...result,
      tenantId: req.connector.tenantId,
      versionInfo: versionEval
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/connector/jobs
 * Returns pending export jobs strictly matching the authenticated connector & tenant
 */
router.get('/connector/jobs', authenticateConnector, async (req, res) => {
  try {
    const jobs = await connectorService.getPendingJobs(
      req.connector.connectorId,
      req.connector.tenantId
    );
    return res.json({ jobs });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/connector/jobs/:id/status
 * Updates job execution status (tracks 'export_completion' audit log)
 */
router.post('/connector/jobs/:id/status', authenticateConnector, async (req, res) => {
  const { id } = req.params;

  try {
    const updated = await connectorService.updateJobStatus(
      id,
      req.body,
      req.connector.connectorId,
      req.connector.tenantId
    );

    // Track Requirement 1: export completion audit log
    if (req.body?.status === 'COMPLETED') {
      await Repository.logAudit({
        tenantId: req.connector.tenantId,
        userId: null,
        action: 'export_completion',
        metadata: {
          jobId: id,
          dataset: updated.dataset,
          rowCount: updated.rowCount,
          filename: updated.filename,
          sizeBytes: updated.sizeBytes
        }
      });

      // Auto-record first export timestamp and advance workflow stage
      await Repository.updatePilotFirstExport(req.connector.tenantId);
    }

    return res.json({ success: true, job: updated });
  } catch (err) {
    if (err.code === 'TENANT_ISOLATION_VIOLATION') {
      return res.status(403).json({ error: err.message });
    }
    return res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
  }
});

/**
 * POST /api/connector/jobs/create
 * Creates an asynchronous export job for a target connector & tenant (tracks 'export_creation' audit log)
 */
router.post('/connector/jobs/create', async (req, res) => {
  const { dataset, filters, connectorId, tenantId, userId } = req.body || {};
  if (!dataset) {
    return res.status(400).json({ error: 'Missing required parameter: "dataset"' });
  }

  try {
    const job = await connectorService.createExportJob(dataset, filters, connectorId, tenantId);

    // Track Requirement 1: export creation audit log
    await Repository.logAudit({
      tenantId: job.tenantId,
      userId: userId || null,
      action: 'export_creation',
      metadata: {
        jobId: job.id,
        dataset: job.dataset,
        connectorId: job.connectorId,
        filters: job.filters
      }
    });

    return res.status(201).json({
      success: true,
      job: {
        id: job.id,
        tenantId: job.tenantId,
        connectorId: job.connectorId,
        dataset: job.dataset,
        filters: job.filters,
        status: job.status,
        createdAt: job.createdAt
      }
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/connector/toggle
 * Simulates disconnecting or reconnecting the desktop connector for demo purposes
 */
router.post('/connector/toggle', (req, res) => {
  try {
    const status = connectorService.toggleConnection();
    return res.json({
      message: `Connector toggled to ${status.status}`,
      status
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. EXPORTS, DOWNLOADS & RETRY
// ==========================================

/**
 * POST /api/exports/:id/retry
 * Resets a failed export job to PENDING for automatic re-execution by agent
 */
router.post('/exports/:id/retry', async (req, res) => {
  const { id } = req.params;
  const tenantId = req.query.tenantId || req.body?.tenantId;

  try {
    const job = await Repository.retryFailedJob(id, tenantId);
    return res.json({
      success: true,
      message: `Job ${id} reset to PENDING for retry`,
      job
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/exports/:jobId
 * Returns metadata and status for a specific export job
 */
router.get('/exports/:jobId', async (req, res) => {
  const { jobId } = req.params;
  try {
    const job = await connectorService.getJob(jobId);
    return res.json(job);
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }
});

/**
 * GET /api/exports/:jobId/download
 * Streams the generated CSV directly to the client browser (tracks 'csv_download' audit log)
 */
router.get('/exports/:jobId/download', async (req, res) => {
  const { jobId } = req.params;

  try {
    const { stream, job } = await connectorService.getJobReadStream(jobId);

    // Download expiry check (7 days)
    if (job.isDownloadExpired) {
      return res.status(410).json({
        error: 'Export download has expired. Export files are available for download for 7 days.'
      });
    }

    // Track Requirement 1: CSV download audit log
    await Repository.logAudit({
      tenantId: job.tenantId,
      userId: null,
      action: 'csv_download',
      metadata: {
        jobId: job.id,
        filename: job.filename,
        sizeBytes: job.sizeBytes,
        dataset: job.dataset
      }
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`);
    if (job.sizeBytes) {
      res.setHeader('Content-Length', job.sizeBytes);
    }

    stream.on('error', (streamErr) => {
      if (!res.headersSent) {
        res.status(500).json({ error: `Stream error: ${streamErr.message}` });
      }
    });

    stream.pipe(res);
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }
});

/**
 * GET /api/exports
 * Returns list of export jobs with search, filtering, and expiry metadata
 */
router.get('/exports', async (req, res) => {
  try {
    const { tenantId, dataset, status, search, limit } = req.query;
    const jobs = await Repository.searchExportJobs({
      tenantId: tenantId || null,
      dataset: dataset || null,
      status: status || null,
      search: search || null,
      limit: limit ? parseInt(limit, 10) : 50
    });
    return res.json(jobs);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. AUDIT LOGGING & TELEMETRY (Phase 3 Step 1)
// ==========================================

/**
 * GET /api/audit-logs
 * Retrieves audit log entries for a tenant
 */
router.get('/audit-logs', async (req, res) => {
  try {
    const { tenantId, action, limit } = req.query;
    const logs = await Repository.getAuditLogs({
      tenantId: tenantId || null,
      action: action || null,
      limit: limit ? parseInt(limit, 10) : 50
    });
    return res.json({ auditLogs: logs });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/logs
 * Returns telemetry/activity logs from the connector service
 */
router.get('/logs', (req, res) => {
  try {
    const logs = connectorService.getActivityLogs();
    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. AGENT VERSION MANAGEMENT (Phase 3 Step 1)
// ==========================================

/**
 * GET /api/agent/version-check
 * Checks agent compatibility, minimum supported version, and update availability
 */
router.get('/agent/version-check', (req, res) => {
  const version = req.query.version || req.headers['x-agent-version'] || '1.0.0-beta';
  const evalResult = AgentVersionService.evaluateVersion(version);
  return res.json(evalResult);
});

/**
 * GET /api/agent/download
 * Serves the compiled TallyConnectAgentSetup.exe installer
 */
router.get('/agent/download', (req, res) => {
  const candidateExePaths = [
    path.resolve(process.cwd(), 'connector-agent/dist/TallyConnectAgentSetup.exe'),
    path.resolve(process.cwd(), '../connector-agent/dist/TallyConnectAgentSetup.exe')
  ];
  const candidateBatPaths = [
    path.resolve(process.cwd(), 'connector-agent/scripts/install.bat'),
    path.resolve(process.cwd(), '../connector-agent/scripts/install.bat')
  ];

  const exePath = candidateExePaths.find(p => fs.existsSync(p));
  const batPath = candidateBatPaths.find(p => fs.existsSync(p));

  if (exePath) {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="TallyConnectAgentSetup.exe"');
    return fs.createReadStream(exePath).pipe(res);
  } else if (batPath) {
    res.setHeader('Content-Type', 'application/x-bat');
    res.setHeader('Content-Disposition', 'attachment; filename="install.bat"');
    return fs.createReadStream(batPath).pipe(res);
  } else {
    return res.status(404).json({ error: 'Installer binary not found' });
  }
});

// ==========================================
// 7. ENVIRONMENT CONFIGURATION INSPECTION (Phase 3 Step 1)
// ==========================================

/**
 * GET /api/system/environment
 * Inspects active environment separation profile
 */
router.get('/system/environment', (req, res) => {
  const active = getActiveEnvironment();
  return res.json({
    activeEnvironment: active.name,
    displayName: active.displayName,
    urls: active.urls,
    connectorMode: active.connector.mode,
    database: {
      host: active.database.host,
      port: active.database.port,
      database: active.database.database,
      ssl: active.database.ssl
    },
    environments: Object.keys(ENVIRONMENTS).map(key => ({
      name: key,
      displayName: ENVIRONMENTS[key].displayName,
      apiUrl: ENVIRONMENTS[key].urls.apiUrl,
      agentEndpoint: ENVIRONMENTS[key].urls.agentEndpoint
    }))
  });
});

// ==========================================
// 8. PILOT TRACKING & SUPPORT DASHBOARD (Phase 3 Step 2)
// ==========================================

/**
 * GET /api/pilots
 * Lists all pilot customer records with live connector status & workflow stage
 */
router.get('/pilots', async (req, res) => {
  try {
    const pilots = await Repository.listPilotCustomers();
    return res.json({ pilots });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/pilots
 * Onboards or updates a pilot customer profile
 */
router.post('/pilots', async (req, res) => {
  const { tenantId, customerName, companyName, contactEmail, industry, tallyVersion, dataSizeBytes, dataSizeCategory, stage, notes } = req.body || {};
  if (!tenantId || !customerName || !companyName) {
    return res.status(400).json({ error: 'Missing required pilot fields: "tenantId", "customerName", "companyName"' });
  }

  try {
    const pilot = await Repository.upsertPilotCustomer({
      tenantId,
      customerName,
      companyName,
      contactEmail: contactEmail || 'admin@' + companyName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com',
      industry,
      tallyVersion,
      dataSizeBytes,
      dataSizeCategory,
      stage,
      notes
    });

    await Repository.logAudit({
      tenantId,
      userId: null,
      action: 'pilot_onboarding',
      metadata: { customerName, companyName, industry, stage }
    });

    return res.status(201).json({ success: true, pilot });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/pilots/:tenantId/stage
 * Advances or transitions the pilot customer workflow stage
 */
router.post('/pilots/:tenantId/stage', async (req, res) => {
  const { tenantId } = req.params;
  const { stage } = req.body || {};
  if (!stage || !WORKFLOW_STAGES[stage]) {
    return res.status(400).json({
      error: `Invalid workflow stage "${stage}". Valid: ${Object.keys(WORKFLOW_STAGES).join(', ')}`
    });
  }

  try {
    const updated = await Repository.updatePilotStage(tenantId, stage);
    if (!updated) return res.status(404).json({ error: 'Pilot customer not found' });

    await Repository.logAudit({
      tenantId,
      userId: null,
      action: 'pilot_stage_transition',
      metadata: { newStage: stage }
    });

    return res.json({ success: true, pilot: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/pilots/metrics
 * Returns real-time operational pilot metrics (activation rate, export success rate, time to first export)
 */
router.get('/pilots/metrics', async (req, res) => {
  try {
    const metrics = await PilotService.getPilotMetrics();
    return res.json(metrics);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/pilots/support-dashboard
 * Returns support cockpit data: active pilots, offline connectors, failed exports, and recent errors
 */
router.get('/pilots/support-dashboard', async (req, res) => {
  try {
    const cockpit = await PilotService.getSupportDashboard();
    return res.json(cockpit);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 9. CUSTOMER FEEDBACK & ISSUE REPORTING (Phase 3 Step 2)
// ==========================================

/**
 * GET /api/feedback
 * Lists reported issues, feedback notes, and feature requests
 */
router.get('/feedback', async (req, res) => {
  try {
    const { tenantId, type, status, limit } = req.query;
    const items = await Repository.listFeedback({
      tenantId: tenantId || null,
      type: type || null,
      status: status || null,
      limit: limit ? parseInt(limit, 10) : 50
    });
    return res.json({ feedback: items });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/feedback
 * Records an issue report, feedback note, or feature request
 */
router.post('/feedback', async (req, res) => {
  const { tenantId, userId, type, severity, title, description } = req.body || {};
  if (!tenantId || !title || !description) {
    return res.status(400).json({ error: 'Missing required feedback fields: "tenantId", "title", "description"' });
  }

  try {
    const item = await Repository.createFeedback({
      tenantId,
      userId: userId || null,
      type: type || 'ISSUE',
      severity: severity || 'MEDIUM',
      title,
      description
    });

    await Repository.logAudit({
      tenantId,
      userId: userId || null,
      action: 'feedback_submission',
      metadata: { feedbackId: item.id, type: item.type, severity: item.severity, title }
    });

    return res.status(201).json({ success: true, feedback: item });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/feedback/:id
 * Updates issue or feedback status and resolution
 */
router.patch('/feedback/:id', async (req, res) => {
  const { id } = req.params;
  const { status, resolution } = req.body || {};
  if (!status) {
    return res.status(400).json({ error: 'Missing "status" field' });
  }

  try {
    const updated = await Repository.updateFeedbackStatus(id, { status, resolution });
    if (!updated) return res.status(404).json({ error: 'Feedback item not found' });

    await Repository.logAudit({
      tenantId: updated.tenantId,
      userId: null,
      action: 'feedback_resolution',
      metadata: { feedbackId: id, status, resolution }
    });

    return res.json({ success: true, feedback: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
