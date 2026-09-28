import fs from 'fs';
import path from 'path';
import os from 'os';
import { TallyClient } from './tallyClient.js';
import { CloudClient } from './cloudClient.js';
import { HeartbeatService } from './heartbeat.js';
import { JobProcessor } from './jobProcessor.js';
import { logger } from './logger.js';

export class ConnectorAgent {
  constructor(configPath = path.resolve(process.cwd(), 'config.json')) {
    this.configPath = configPath;
    this.config = null;
    this.machineName = os.hostname();
    this.tallyClient = null;
    this.cloudClient = null;
    this.heartbeatService = null;
    this.jobProcessor = null;
    this.isRunning = false;
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
    } catch (err) {
      throw new Error(`Failed to parse config.json: ${err.message}`);
    }

    if (!this.config.cloudUrl || !this.config.connectorId || !this.config.secret) {
      throw new Error('config.json missing required fields: "cloudUrl", "connectorId", or "secret"');
    }

    return this.config;
  }

  /**
   * Starts the agent lifecycle:
   * 1. Load config
   * 2. Probe local Tally
   * 3. Register with Cloud
   * 4. Start heartbeat loop
   * 5. Start job processor loop
   */
  async start() {
    logger.info('======================================================');
    logger.info('🚀 Tally Connect Desktop Agent (Production Daemon)');
    logger.info(`💻 Machine Hostname: ${this.machineName}`);
    logger.info(`💻 Operating System: ${os.type()} ${os.release()} (${os.arch()})`);
    logger.info('======================================================');

    // 1. Load config
    logger.info('[1/5] Loading configuration...');
    this.loadConfig();
    logger.info(`  ✔ Connector ID: ${this.config.connectorId}`);
    logger.info(`  ✔ Cloud Target: ${this.config.cloudUrl}`);
    logger.info(`  ✔ Tally Target: http://${this.config.tallyHost || '127.0.0.1'}:${this.config.tallyPort || 9000}`);

    // 2. Initialize Clients
    this.tallyClient = new TallyClient({
      host: this.config.tallyHost,
      port: this.config.tallyPort,
      simulateIfOffline: true
    });

    this.cloudClient = new CloudClient({
      cloudUrl: this.config.cloudUrl,
      connectorId: this.config.connectorId,
      secret: this.config.secret
    });

    // 3. Probe Tally availability
    logger.info('[2/5] Probing local TallyPrime XML interface...');
    try {
      const tallyInfo = await this.tallyClient.checkStatus();
      if (tallyInfo.online) {
        logger.info(`  ✔ TallyPrime detected on port ${tallyInfo.port} (${tallyInfo.latencyMs}ms)`);
        logger.info(`  ✔ Active Company: "${tallyInfo.activeCompany}"`);
      } else {
        logger.warn(`  ⚠ TallyPrime is currently OFFLINE: ${tallyInfo.error}`);
        logger.warn(`    The agent will continue running and auto-detect when Tally is launched.`);
      }
    } catch (err) {
      logger.warn(`  ⚠ Initial Tally check note: ${err.message}`);
    }

    // 4. Register with Cloud
    logger.info('[3/5] Registering connector with Tally Connect Cloud...');
    try {
      const regResult = await this.cloudClient.register(this.machineName);
      if (regResult.success) {
        logger.info(`  ✔ Connector registered successfully with cloud (Tenant: ${regResult.data?.tenantId || 'Active'})`);
      } else {
        logger.warn(`  ⚠ Cloud registration notice: ${regResult.error}. Will retry via heartbeat.`);
      }
    } catch (err) {
      logger.warn(`  ⚠ Initial Cloud registration network error: ${err.message}`);
    }

    // 5. Start Heartbeat Service
    logger.info('[4/5] Starting heartbeat telemetry...');
    this.heartbeatService = new HeartbeatService({
      tallyClient: this.tallyClient,
      cloudClient: this.cloudClient,
      config: this.config,
      machineName: this.machineName
    });
    this.heartbeatService.start();

    // 6. Start Job Processor
    logger.info('[5/5] Starting export job polling...');
    this.jobProcessor = new JobProcessor({
      cloudClient: this.cloudClient,
      config: this.config,
      pollIntervalSeconds: this.config.pollIntervalSeconds || 10
    });
    this.jobProcessor.start();

    this.isRunning = true;
    logger.info('✔ Desktop Connector Agent is now ONLINE and monitoring TallyPrime.');
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
  const isBackground = process.argv.includes('--background');
  if (isBackground) {
    logger.info('Starting agent in silent background mode...');
  }

  const agent = new ConnectorAgent();
  agent.start().catch(err => {
    logger.error('Fatal agent startup error:', err);
    process.exit(1);
  });

  process.on('SIGINT', () => {
    agent.stop();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    agent.stop();
    process.exit(0);
  });
}
