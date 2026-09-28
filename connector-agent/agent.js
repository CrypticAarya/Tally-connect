import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { TallyClient } from './tallyClient.js';
import { CloudClient } from './cloudClient.js';
import { HeartbeatService } from './heartbeat.js';
import { JobProcessor } from './jobProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const AGENT_VERSION = '1.0.0-beta';

export class ConnectorAgent {
  constructor(configPath = path.join(__dirname, 'config.json')) {
    this.configPath = configPath;
    this.config = null;
    this.machineName = os.hostname();
    this.version = AGENT_VERSION;
    this.tallyClient = null;
    this.cloudClient = null;
    this.heartbeatService = null;
    this.jobProcessor = null;
  }

  /**
   * Step 1: Loads and validates config.json
   */
  loadConfig() {
    if (!fs.existsSync(this.configPath)) {
      throw new Error(`Configuration file missing at: ${this.configPath}`);
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
   * 2. Check Tally availability
   * 3. Connect/register with Cloud
   * 4. Start heartbeat loop
   */
  async start() {
    console.log('\n======================================================');
    console.log('🚀 Tally Connect Desktop Agent (Customer Host)');
    console.log(`💻 Machine Hostname: ${this.machineName}`);
    console.log(`OS: ${os.type()} ${os.release()} (${os.arch()})`);
    console.log('======================================================\n');

    // 1. Load config
    console.log('[1/4] Loading configuration...');
    this.loadConfig();
    console.log(`  ✔ Connector ID: ${this.config.connectorId}`);
    console.log(`  ✔ Cloud Target: ${this.config.cloudUrl}`);
    console.log(`  ✔ Tally Target: http://${this.config.tallyHost || '127.0.0.1'}:${this.config.tallyPort || 9000}`);

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
    console.log('\n[2/4] Probing local TallyPrime XML interface...');
    const tallyInfo = await this.tallyClient.checkStatus();
    if (tallyInfo.online) {
      console.log(`  ✔ TallyPrime detected on port ${tallyInfo.port} (${tallyInfo.latencyMs}ms)`);
      console.log(`  ✔ Active Company: "${tallyInfo.activeCompany}"`);
    } else {
      console.warn(`  ⚠ TallyPrime is currently OFFLINE: ${tallyInfo.error}`);
      console.warn(`    The agent will continue running and auto-detect when Tally is launched.`);
    }

    // 4. Version Check & Registration with Cloud
    console.log(`\n[3/5] Verifying agent version compatibility (v${this.version})...`);
    const versionCheck = await this.cloudClient.checkVersion(this.version);
    if (versionCheck.success && versionCheck.versionInfo) {
      const v = versionCheck.versionInfo;
      if (!v.isSupported) {
        console.error(`  ✖ CRITICAL: Agent version ${this.version} is below minimum supported version (${v.minSupportedVersion}). Upgrade required.`);
      } else if (v.isUpdateAvailable) {
        console.log(`  ℹ Newer agent version v${v.latestVersion} available. (Current: v${this.version})`);
        console.log(`    Notes: ${v.releaseNotes}`);
      } else {
        console.log(`  ✔ Agent version v${this.version} is up-to-date and fully supported.`);
      }
    }

    console.log('\n[4/5] Registering connector with Tally Connect Cloud...');
    const regResult = await this.cloudClient.register(this.machineName, this.version);
    if (regResult.success) {
      console.log(`  ✔ Connector registered successfully with cloud backend`);
    } else {
      console.warn(`  ⚠ Cloud registration notice: ${regResult.error}`);
      console.warn(`    Agent will proceed with heartbeat recovery loop.`);
    }

    // 5. Start Heartbeat Service
    console.log('\n[4/5] Starting heartbeat telemetry...');
    this.heartbeatService = new HeartbeatService({
      tallyClient: this.tallyClient,
      cloudClient: this.cloudClient,
      config: this.config,
      machineName: this.machineName
    });

    this.heartbeatService.start();

    // 6. Start Job Processor
    console.log('\n[5/5] Starting export job polling...');
    this.jobProcessor = new JobProcessor({
      cloudClient: this.cloudClient,
      config: this.config,
      pollIntervalSeconds: 10
    });
    this.jobProcessor.start();

    console.log('\n✔ Desktop Connector Agent is now ONLINE and monitoring TallyPrime.\n');
  }

  /**
   * Graceful shutdown
   */
  stop() {
    console.log('\n[Agent] Shutting down connector agent...');
    if (this.heartbeatService) {
      this.heartbeatService.stop();
    }
    if (this.jobProcessor) {
      this.jobProcessor.stop();
    }
    console.log('[Agent] Shutdown complete.');
  }
}

// Auto-run when executed directly from CLI
if (process.argv[1] && process.argv[1].endsWith('agent.js')) {
  const agent = new ConnectorAgent();
  agent.start().catch(err => {
    console.error('Fatal agent error:', err.message);
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
