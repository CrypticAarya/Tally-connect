import { tallyAdapter } from '../adapters/index.js';
import { Transformer, CsvExporter, normalizeDatasetKey, getSchema } from '../engine/index.js';
import { exportStorage } from '../storage/index.js';
import { config } from '../config.js';

export class ConnectorService {
  constructor(options = {}) {
    this.adapter = options.adapter || tallyAdapter;
    this.storage = options.storage || exportStorage;
    this.agentId = options.agentId || config.connector.agentId;
    this.agentVersion = options.agentVersion || config.connector.agentVersion;
    this.mode = options.mode || config.connector.mode;

    this.status = 'INITIALIZING';
    this.tallyConnectionStatus = 'DISCONNECTED';
    this.activeCompany = null;
    this.tallyVersion = null;
    this.tallyPort = config.connector.tallyPort;
    this.lastHeartbeat = new Date().toISOString();
    this.startTime = Date.now();

    // In-memory jobs registry (jobId -> JobRecord)
    this.jobs = new Map();
    // Audit log / activity telemetry
    this.activityLogs = [];
  }

  /**
   * Initializes the connector service and verifies Tally connectivity
   */
  async initialize() {
    this._log('info', `Initializing Connector Service (Mode: ${this.mode})...`);
    try {
      const health = await this.adapter.testConnection();
      if (health.available) {
        this.status = 'ONLINE';
        this.tallyConnectionStatus = 'CONNECTED';
        this.activeCompany = health.companyName;
        this.tallyVersion = health.version;
        this.tallyPort = health.port || 9000;
        this.lastHeartbeat = new Date().toISOString();
        this._log('info', `Connector ONLINE. Connected to Tally "${this.activeCompany}" on port ${this.tallyPort}`);
      } else {
        this.status = 'OFFLINE';
        this.tallyConnectionStatus = 'DISCONNECTED';
        this._log('warn', `Connector OFFLINE. Tally adapter returned unavailable.`);
      }
    } catch (err) {
      this.status = 'ERROR';
      this.tallyConnectionStatus = 'DISCONNECTED';
      this._log('error', `Failed to initialize connector: ${err.message}`);
    }
    return this.getStatus();
  }

  /**
   * Helper to log service activity
   */
  _log(level, message, meta = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta
    };
    this.activityLogs.unshift(entry);
    if (this.activityLogs.length > 100) this.activityLogs.pop();
    return entry;
  }

  /**
   * Returns current connector health & status
   */
  getStatus() {
    this.lastHeartbeat = new Date().toISOString();
    return {
      agentId: this.agentId,
      agentVersion: this.agentVersion,
      status: this.status,
      mode: this.mode,
      tallyConnectionStatus: this.tallyConnectionStatus,
      activeCompany: this.activeCompany,
      tallyVersion: this.tallyVersion,
      tallyPort: this.tallyPort,
      lastHeartbeat: this.lastHeartbeat,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000)
    };
  }

  /**
   * Handles incoming registration from a desktop connector agent
   */
  async handleRegister({ connectorId, machineName, tenantId = null }) {
    this.agentId = connectorId || this.agentId;
    this.machineName = machineName || 'Customer PC';
    this.status = 'ONLINE';
    this.lastHeartbeat = new Date().toISOString();
    this._log('info', `Desktop agent "${connectorId}" registered from host "${this.machineName}"`);

    return {
      success: true,
      registered: true,
      connectorId: this.agentId,
      tenantId,
      cloudTime: this.lastHeartbeat
    };
  }

  /**
   * Handles incoming heartbeat telemetry from a desktop connector agent
   */
  async handleHeartbeat({ connectorId, machineName, tallyStatus, activeCompany, port, timestamp, tenantId = null }) {
    this.agentId = connectorId || this.agentId;
    this.machineName = machineName || this.machineName;
    this.status = 'ONLINE';
    this.tallyConnectionStatus = tallyStatus === 'ONLINE' ? 'CONNECTED' : 'DISCONNECTED';
    if (activeCompany) {
      this.activeCompany = activeCompany;
    }
    if (port) {
      this.tallyPort = port;
    }
    this.lastHeartbeat = timestamp || new Date().toISOString();
    this._log('info', `Heartbeat from [${this.machineName}] -> Tally: ${tallyStatus} ("${this.activeCompany}")`);

    return {
      acknowledged: true,
      connectorId: this.agentId,
      tenantId,
      serverTime: new Date().toISOString()
    };
  }

  /**
   * Toggles simulated connection status (useful for live resilience demonstration)
   */
  toggleConnection() {
    if (this.status === 'ONLINE') {
      this.status = 'OFFLINE';
      this.tallyConnectionStatus = 'DISCONNECTED';
      this._log('warn', 'Simulated: Desktop Connector disconnected by user.');
    } else {
      this.status = 'ONLINE';
      this.tallyConnectionStatus = 'CONNECTED';
      this._log('info', 'Simulated: Desktop Connector reconnected.');
    }
    return this.getStatus();
  }

  /**
   * Core Pipeline Orchestration:
   * ConnectorService
   *      ↓
   * TallyAdapter
   *      ↓
   * Transformer
   *      ↓
   * CsvExporter
   *      ↓
   * ExportStorage
   */
  async executeExport(datasetInput, options = {}) {
    if (this.status === 'OFFLINE') {
      throw new Error('Cannot execute export: Connector is currently OFFLINE.');
    }

    const datasetKey = normalizeDatasetKey(datasetInput);
    if (!datasetKey) {
      throw new Error(`Invalid dataset "${datasetInput}". Supported datasets: CUSTOMER, CHART_OF_ACCOUNTS, SALES_REGISTER, TRIAL_BALANCE`);
    }

    const schema = getSchema(datasetKey);
    const jobId = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const previousStatus = this.status;
    this.status = 'BUSY';

    const jobLogs = [];
    const logStep = (msg) => {
      const entry = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
      jobLogs.push(entry);
      this._log('info', `[${jobId}] ${msg}`);
    };

    try {
      logStep(`Job started for dataset: ${schema.displayName} (${datasetKey})`);

      // 1. Fetch raw data from Tally Adapter
      logStep(`[Adapter] Querying TallyPrime for ${datasetKey}...`);
      let rawData = [];
      switch (datasetKey) {
        case 'CUSTOMER':
          rawData = await this.adapter.fetchCustomers(options);
          break;
        case 'CHART_OF_ACCOUNTS':
          rawData = await this.adapter.fetchChartOfAccounts(options);
          break;
        case 'SALES_REGISTER':
          rawData = await this.adapter.fetchSalesRegister(options);
          break;
        case 'TRIAL_BALANCE':
          rawData = await this.adapter.fetchTrialBalance(options);
          break;
        default:
          throw new Error(`Unsupported dataset ${datasetKey}`);
      }
      logStep(`[Adapter] Retrieved ${rawData.length} raw records from Tally`);

      // 2. Transform hierarchical data into flat schema rows
      logStep(`[Transformer] Unrolling & flattening into ${schema.columns.length}-column schema...`);
      const flatRows = Transformer.transform(datasetKey, rawData);
      logStep(`[Transformer] Produced ${flatRows.length} standardized rows`);

      // 3. Serialize and persist through CsvExporter into ExportStorage
      const filename = `${schema.fileNamePrefix}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${jobId.slice(-5)}.csv`;
      logStep(`[CsvExporter] Streaming to ExportStorage as "${filename}"...`);
      const exportResult = await CsvExporter.exportToStorage(datasetKey, flatRows, {
        filename,
        storage: this.storage
      });
      logStep(`[ExportStorage] File stored successfully (${exportResult.sizeBytes} bytes)`);

      const jobRecord = {
        jobId,
        dataset: datasetKey,
        datasetName: schema.displayName,
        status: 'COMPLETED',
        rowCount: exportResult.rowCount,
        fileKey: exportResult.fileKey,
        filename: exportResult.filename,
        sizeBytes: exportResult.sizeBytes,
        createdAt: exportResult.createdAt,
        downloadUrl: `/api/exports/${jobId}/download`,
        preview: exportResult.preview,
        columns: exportResult.columns,
        logs: jobLogs
      };

      this.jobs.set(jobId, jobRecord);
      this.status = previousStatus;
      logStep(`Job ${jobId} completed successfully`);

      return jobRecord;
    } catch (err) {
      this.status = previousStatus;
      const errorEntry = `[ERROR] Job failed: ${err.message}`;
      jobLogs.push(errorEntry);
      this._log('error', errorEntry);

      const failedJob = {
        jobId,
        dataset: datasetKey,
        status: 'FAILED',
        error: err.message,
        logs: jobLogs
      };
      this.jobs.set(jobId, failedJob);
      throw err;
    }
  }

  /**
   * Retrieves a job by ID
   */
  async getJob(jobId, tenantId = null) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job "${jobId}" not found`);
    }
    if (tenantId && job.tenantId && job.tenantId !== tenantId) {
      throw new Error(`Access denied: Job belongs to another tenant`);
    }
    job.downloadUrl = `/api/exports/${job.id}/download`;
    return job;
  }

  /**
   * Creates an asynchronous export job to be picked up by the connector agent
   */
  async createExportJob(datasetInput, filters = {}, targetConnectorId = null, tenantId = null) {
    const datasetKey = normalizeDatasetKey(datasetInput);
    if (!datasetKey) {
      throw new Error(`Invalid dataset "${datasetInput}". Supported datasets: CUSTOMER, CHART_OF_ACCOUNTS, SALES_REGISTER, TRIAL_BALANCE`);
    }

    const schema = getSchema(datasetKey);
    const connectorId = targetConnectorId || this.agentId;
    const effectiveTenantId = tenantId || 'ten_default';

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const jobRecord = {
      id: jobId,
      jobId,
      tenantId: effectiveTenantId,
      connectorId,
      dataset: datasetKey,
      datasetName: schema.displayName,
      filters: filters || {},
      status: 'PENDING',
      rowCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      downloadUrl: `/api/exports/${jobId}/download`
    };

    this.jobs.set(jobRecord.id, jobRecord);
    this._log('info', `Created export job "${jobRecord.id}" for "${datasetKey}" (Tenant: ${effectiveTenantId}, Connector: ${connectorId})`);
    return jobRecord;
  }

  /**
   * Returns list of pending jobs for a specific connector with tenant isolation
   */
  async getPendingJobs(connectorId = null, tenantId = null) {
    return Array.from(this.jobs.values()).filter(job => {
      const matchTenant = !tenantId || job.tenantId === tenantId;
      const matchConnector = !connectorId || job.connectorId === connectorId || job.connectorId === this.agentId;
      return matchTenant && matchConnector && job.status === 'PENDING';
    });
  }

  /**
   * Updates job status and stores result from connector agent
   */
  async updateJobStatus(jobId, payload = {}, connectorId = null, tenantId = null) {
    const { status, rowCount, filename, csvContent, preview, error } = payload;

    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job "${jobId}" not found`);
    }

    // Verify tenant isolation
    if (tenantId && job.tenantId && job.tenantId !== tenantId) {
      const err = new Error(`Job isolation violation: Job "${jobId}" belongs to tenant "${job.tenantId}", not "${tenantId}"`);
      err.code = 'TENANT_ISOLATION_VIOLATION';
      throw err;
    }

    let fileKey = job.fileKey || filename;
    let sizeBytes = job.sizeBytes;

    if (status === 'COMPLETED' && csvContent) {
      const safeFilename = filename || `${job.dataset}_${Date.now()}.csv`;
      const record = await this.storage.saveExport(safeFilename, csvContent, {
        dataset: job.dataset,
        rowCount: rowCount != null ? Number(rowCount) : 0,
        tenantId: job.tenantId
      });
      fileKey = record.fileKey;
      sizeBytes = record.sizeBytes;
    }

    job.status = status;
    job.rowCount = rowCount != null ? Number(rowCount) : job.rowCount;
    job.filename = filename || job.filename;
    job.fileKey = fileKey;
    job.sizeBytes = sizeBytes;
    job.preview = preview || job.preview;
    job.error = error || job.error;
    job.updatedAt = new Date().toISOString();
    if (status === 'COMPLETED') job.completedAt = new Date().toISOString();
    job.downloadUrl = `/api/exports/${jobId}/download`;

    this.jobs.set(jobId, job);
    return job;

    if (status === 'PROCESSING') {
      this._log('info', `Job "${jobId}" is now PROCESSING on connector "${job.connectorId}"`);
    } else if (status === 'COMPLETED') {
      this._log('info', `Job "${jobId}" COMPLETED (${updatedJob.rowCount} rows exported as "${updatedJob.filename}")`);
    } else if (status === 'FAILED') {
      this._log('error', `Job "${jobId}" FAILED: ${updatedJob.error}`);
    }

    return updatedJob;
  }

  /**
   * Returns a readable stream for downloading the exported CSV
   */
  async getJobReadStream(jobId, tenantId = null) {
    const job = await this.getJob(jobId, tenantId);
    if (job.status !== 'COMPLETED') {
      throw new Error(`Job "${jobId}" is not in COMPLETED state (status: ${job.status})`);
    }

    const stream = await this.storage.getReadStream(job.fileKey);
    return {
      stream,
      job
    };
  }

  /**
   * Returns list of recent jobs
   */
  listRecentJobs(limit = 10) {
    return Array.from(this.jobs.values())
      .reverse()
      .slice(0, limit);
  }

  /**
   * Returns recent activity logs
   */
  getActivityLogs(limit = 20) {
    return this.activityLogs.slice(0, limit);
  }
}

// Active singleton instance
export const connectorService = new ConnectorService();
