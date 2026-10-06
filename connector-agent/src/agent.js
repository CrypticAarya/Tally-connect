import fs from 'fs';
import path from 'path';
import os from 'os';
import { TallyClient } from './tallyClient.js';
import { CloudClient } from './cloudClient.js';
import { HeartbeatService } from './heartbeat.js';
import { JobProcessor } from './jobProcessor.js';
import { SyncWorker } from './syncWorker.js';
import { logger } from './logger.js';
import { resolveCloudUrl } from './cloudConfig.js';

export const AGENT_VERSION = '1.0.0-beta';

export class ConnectorAgent {
  constructor(configPath = path.resolve(process.cwd(), 'config.json')) {
    this.configPath = path.resolve(configPath);
    this.configDir = path.dirname(this.configPath);
    this.config = null;
    this.machineName = os.hostname();
    this.version = AGENT_VERSION;
    this.tallyClient = null;
    this.cloudClient = null;
    this.heartbeatService = null;
    this.jobProcessor = null;
    this.isRunning = false;

    // Ensure logger writes to logs/ relative to config or current dir
    logger.setLogsDir(path.join(this.configDir, 'logs'));
  }

  /**
   * Loads and validates config.json
   */
  loadConfig() {
    if (!fs.existsSync(this.configPath)) {
      throw new Error(`Configuration file missing at: ${this.configPath}. Please run the installer first.`);
    }

    try {
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      this.config = JSON.parse(raw);

      // Architectural Rule: Separate Cloud Tenant Identity from TallyPrime Company Identity
      // Migrate legacy config.companyName -> config.tenantName and purge companyName from file
      if (this.config.companyName && !this.config.tenantName) {
        this.config.tenantName = this.config.companyName;
        delete this.config.companyName;
        try {
          fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
        } catch (_) { }
      } else if (this.config.companyName) {
        delete this.config.companyName;
        try {
          fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
        } catch (_) { }
      }
    } catch (err) {
      throw new Error(`Failed to parse config.json: ${err.message}`);
    }

    const hasNewAuth = Boolean(this.config.connectionId && this.config.agentToken);
    const hasLegacyAuth = Boolean(this.config.connectorId && this.config.secret);

    if (!this.config.cloudUrl) {
      this.config.cloudUrl = resolveCloudUrl(null, this.configPath);
    }

    if (!this.config.cloudUrl || (!hasNewAuth && !hasLegacyAuth)) {
      throw new Error('config.json missing required connection credentials');
    }

    return this.config;
  }

  /**
   * Activates the agent with a 6-character activation code (e.g. TC-4829)
   */
  async activate(activationCode, options = {}) {
    if (!activationCode) {
      throw new Error('Activation code required (e.g. TC-4829)');
    }

    const code = activationCode.trim().toUpperCase();
    const cloudUrl = resolveCloudUrl(options.cloudUrl, this.configPath);
    const tallyHost = options.tallyHost || '127.0.0.1';
    const tallyPort = Number(options.tallyPort || 9000);

    logger.info(`Agent activation initiated with code: ${code}`);

    this.tallyClient = new TallyClient({
      host: tallyHost,
      port: tallyPort
    });
    const tallyInfo = await this.tallyClient.checkStatus();

    this.cloudClient = new CloudClient({ cloudUrl });
    const activation = await this.cloudClient.activateWithCode(
      code,
      this.machineName,
      tallyInfo.online ? tallyInfo.activeCompany : null
    );

    if (!activation.success) {
      const err = `Activation failed: ${activation.error}`;
      logger.error(err);
      throw new Error(err);
    }

    const tenantName = activation.companyName || activation.tenantName || 'Customer Account';
    logger.info(`Agent activated successfully: connection_id=${activation.connectionId}, agent_id=${activation.agentId}, tenant="${tenantName}"`);

    // Output required customer confirmation
    console.log('\n======================================================');
    console.log('Connected Successfully.');
    console.log('======================================================\n');

    this.config = {
      cloudUrl,
      connectionId: activation.connectionId,
      agentId: activation.agentId,
      agentToken: activation.agentToken,
      tenantName,
      status: 'ACTIVE',
      machineName: this.machineName,
      tallyHost,
      tallyPort,
      heartbeatIntervalSeconds: 30,
      activatedAt: new Date().toISOString()
    };

    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    logger.info(`Local credentials saved to ${this.configPath}`);

    this.cloudClient.connectionId = activation.connectionId;
    this.cloudClient.agentId = activation.agentId;
    this.cloudClient.agentToken = activation.agentToken;

    // Start silent heartbeat
    this.startSilentHeartbeat();

    return {
      success: true,
      connectionId: activation.connectionId,
      agentId: activation.agentId,
      companyName: activation.companyName
    };
  }

  /**
   * Starts recurring heartbeat loop
   */
  startSilentHeartbeat(intervalMs = 30000) {
    if (this.heartbeatService) {
      this.heartbeatService.stop();
    }

    this.heartbeatService = new HeartbeatService({
      tallyClient: this.tallyClient,
      cloudClient: this.cloudClient,
      config: this.config,
      machineName: this.machineName
    });

    this.heartbeatService.start();
  }

  /**
   * Starts the agent lifecycle:
   * 1. Load config
   * 2. Log startup / recovery event
   * 3. Initialize Clients
   * 4. Probe local Tally
   * 5. Start heartbeat loop
   */
  async start() {
    logger.info('======================================================');
    logger.info('🚀 Tally Connect Desktop Agent daemon started');
    logger.info(`💻 Machine Hostname: ${this.machineName}`);
    logger.info(`💻 Operating System: ${os.type()} ${os.release()} (${os.arch()})`);
    logger.info('======================================================');

    // 1. Load config
    this.loadConfig();
    const connLabel = this.config.connectionId || this.config.connectorId;
    logger.info(`[Startup] Restored session from config.json (Connection: ${connLabel}, Tenant: "${this.config.tenantName || 'None'}")`);
    logger.info(`[Startup] Target Cloud: ${this.config.cloudUrl}`);
    logger.info(`[Startup] Target Tally: http://${this.config.tallyHost || '127.0.0.1'}:${this.config.tallyPort || 9000}`);

    // 2. Initialize Clients
    this.tallyClient = new TallyClient({
      host: this.config.tallyHost || '127.0.0.1',
      port: this.config.tallyPort || 9000,
      simulateIfOffline: process.env.TALLY_SIMULATE === 'true'
    });

    this.cloudClient = new CloudClient({
      cloudUrl: this.config.cloudUrl,
      connectorId: this.config.connectorId,
      secret: this.config.secret,
      connectionId: this.config.connectionId,
      agentId: this.config.agentId,
      agentToken: this.config.agentToken
    });

    // 3. Probe Tally availability (resilient: does not crash if offline)
    try {
      const tallyInfo = await this.tallyClient.checkStatus();
      if (tallyInfo.online) {
        logger.info(`  ✔ TallyPrime detected online on port ${tallyInfo.port} (${tallyInfo.latencyMs}ms), Company: "${tallyInfo.activeCompany}"`);
      } else {
        logger.warn(`Tally connection issue: TallyPrime is closed / offline on port ${tallyInfo.port}. Heartbeat will report OFFLINE until Tally is opened.`);
      }
    } catch (err) {
      logger.warn(`Tally connection issue: ${err.message}`);
    }

    // 4. Start Heartbeat Service
    logger.info('Starting background heartbeat telemetry...');
    this.heartbeatService = new HeartbeatService({
      tallyClient: this.tallyClient,
      cloudClient: this.cloudClient,
      config: this.config,
      machineName: this.machineName
    });
    this.heartbeatService.start();

    // 5. Start Job Processor if legacy connectorId is present
    if (this.config.connectorId && this.config.secret) {
      this.jobProcessor = new JobProcessor({
        cloudClient: this.cloudClient,
        config: this.config,
        pollIntervalSeconds: this.config.pollIntervalSeconds || 10
      });
      this.jobProcessor.start();
    }

    // 6. Start Sync Worker for Modern SaaS Integration
    if (this.config.connectionId) {
      this.syncWorker = new SyncWorker({
        cloudClient: this.cloudClient,
        config: this.config,
        pollIntervalSeconds: 30
      });
      this.syncWorker.start();
    }

    this.isRunning = true;
    logger.info('✔ Tally Connect Agent is ONLINE and running silently in the background.');
  }

  /**
   * Triggers an immediate synchronization for all permitted entities or a specific entity
   */
  async syncNow(entityType = null) {
    if (!this.syncWorker) {
      this.syncWorker = new SyncWorker({
        cloudClient: this.cloudClient,
        config: this.config
      });
    }
    return entityType ? this.syncWorker.syncEntity(entityType) : this.syncWorker.pollAndSync();
  }

  /**
   * Graceful shutdown
   */
  stop() {
    logger.info('Shutting down connector agent...');
    if (this.heartbeatService) {
      this.heartbeatService.stop();
    }
    if (this.jobProcessor) {
      this.jobProcessor.stop();
    }
    if (this.syncWorker) {
      this.syncWorker.stop();
    }
    this.isRunning = false;
    logger.info('Connector agent shutdown complete.');
  }
}

// Global safety catchers to ensure zero crashing during unexpected network glitches
process.on('uncaughtException', (err) => {
  logger.error('CRITICAL: Uncaught Exception caught by agent daemon:', err);
});

process.on('unhandledRejection', (reason) => {
  logger.error('CRITICAL: Unhandled Rejection caught by agent daemon:', reason);
});

// Auto-run when executed directly from CLI
if (process.argv[1] && process.argv[1].endsWith('agent.js')) {
  const agent = new ConnectorAgent();

  const codeArgIdx = process.argv.findIndex(arg => arg === '--code' || arg === '-c');
  const codeArg = codeArgIdx !== -1 ? process.argv[codeArgIdx + 1] : process.argv.find(arg => arg.startsWith('TC-'));

  if (codeArg) {
    agent.activate(codeArg).catch(err => {
      logger.error('Fatal activation error:', err);
      process.exit(1);
    });
  } else {
    agent.start().catch(err => {
      logger.error('Fatal agent startup error:', err);
      process.exit(1);
    });
  }

  process.on('SIGINT', () => {
    agent.stop();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    agent.stop();
    process.exit(0);
  });
}
