import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { TallyClient } from './tallyClient.js';
import { CloudClient } from './cloudClient.js';
import { HeartbeatService } from './heartbeat.js';
import { JobProcessor } from './jobProcessor.js';
import { SyncWorker } from './src/syncWorker.js';

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
    this.syncWorker = null;
    this.heartbeatTimer = null;
  }

  /**
   * Loads and validates config.json
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

    const hasNewAuth = Boolean(this.config.agentToken && this.config.connectionId);
    const hasLegacyAuth = Boolean(this.config.connectorId && this.config.secret);

    if (!this.config.cloudUrl || (!hasNewAuth && !hasLegacyAuth)) {
      throw new Error('config.json missing required connection credentials');
    }

    return this.config;
  }

  /**
   * Activates the agent with a simple 6-character activation code (Phase 3)
   * The customer only enters: TC-XXXX
   * After success shows: "Connected Successfully."
   * Stores credentials locally and runs silently.
   */
  async activate(activationCode) {
    if (!activationCode) {
      throw new Error('Activation code required (e.g. TC-4829)');
    }

    let cloudUrl = process.env.CLOUD_URL || 'http://localhost:5001';
    if (fs.existsSync(this.configPath)) {
      try {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.cloudUrl) cloudUrl = parsed.cloudUrl;
      } catch (_) {}
    }

    // Initialize local Tally client to detect active company
    this.tallyClient = new TallyClient({
      host: process.env.TALLY_HOST || '127.0.0.1',
      port: Number(process.env.TALLY_PORT) || 9000
    });
    const tallyInfo = await this.tallyClient.checkStatus();

    this.cloudClient = new CloudClient({ cloudUrl });

    // Call Cloud Agent Activation API
    const activation = await this.cloudClient.activateWithCode(
      activationCode,
      this.machineName,
      tallyInfo.online ? tallyInfo.activeCompany : null
    );

    if (!activation.success) {
      throw new Error(`Activation failed: ${activation.error}`);
    }

    // Required user-facing confirmation
    console.log('\n======================================================');
    console.log('Connected Successfully.');
    console.log('======================================================\n');

    // Store credentials locally
    this.config = {
      cloudUrl,
      connectionId: activation.connectionId,
      agentId: activation.agentId,
      agentToken: activation.agentToken,
      companyName: activation.companyName,
      status: 'ACTIVE',
      activatedAt: new Date().toISOString()
    };

    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');

    this.cloudClient.connectionId = activation.connectionId;
    this.cloudClient.agentId = activation.agentId;
    this.cloudClient.agentToken = activation.agentToken;

    // Run silently in background
    this.startSilentHeartbeat();

    return {
      success: true,
      connectionId: activation.connectionId,
      agentId: activation.agentId,
      companyName: activation.companyName
    };
  }

  /**
   * Starts silent recurring heartbeat loop
   */
  startSilentHeartbeat(intervalMs = 30000) {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    const sendPing = async () => {
      try {
        const tallyInfo = this.tallyClient ? await this.tallyClient.checkStatus() : { online: true };
        await this.cloudClient.sendHeartbeat({
          machineName: this.machineName,
          tallyStatus: tallyInfo.online ? 'ONLINE' : 'OFFLINE',
          activeCompany: tallyInfo.activeCompany || this.config?.companyName,
          port: tallyInfo.port || 9000,
          agentVersion: this.version
        });
      } catch (_) {
        // Runs silently without console noise
      }
    };

    sendPing();
    this.heartbeatTimer = setInterval(sendPing, intervalMs);
    if (this.heartbeatTimer.unref) this.heartbeatTimer.unref();
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
      host: this.config.tallyHost || '127.0.0.1',
      port: this.config.tallyPort || 9000,
      simulateIfOffline: process.env.TALLY_SIMULATE === 'true'
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
    // 6. Start Job Processor (Legacy export queue)
    if (this.config.connectorId) {
      console.log('\n[5/6] Starting export job polling...');
      this.jobProcessor = new JobProcessor({
        cloudClient: this.cloudClient,
        config: this.config,
        pollIntervalSeconds: 10
      });
      this.jobProcessor.start();
    }

    // 7. Start Sync Worker for Modern SaaS Integration
    if (this.config.connectionId) {
      console.log('\n[6/6] Starting permission-based JSON sync worker...');
      this.syncWorker = new SyncWorker({
        cloudClient: this.cloudClient,
        config: this.config,
        pollIntervalSeconds: 30
      });
      this.syncWorker.start();
    }

    console.log('\n✔ Desktop Connector Agent is now ONLINE and monitoring TallyPrime.\n');
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
    console.log('\n[Agent] Shutting down connector agent...');
    if (this.heartbeatService) {
      this.heartbeatService.stop();
    }
    if (this.jobProcessor) {
      this.jobProcessor.stop();
    }
    if (this.syncWorker) {
      this.syncWorker.stop();
    }
    console.log('[Agent] Shutdown complete.');
  }
}

// Auto-run when executed directly from CLI
if (process.argv[1] && process.argv[1].endsWith('agent.js')) {
  const agent = new ConnectorAgent();

  const codeArgIdx = process.argv.findIndex(arg => arg === '--code' || arg === '-c');
  const codeArg = codeArgIdx !== -1 ? process.argv[codeArgIdx + 1] : process.argv.find(arg => arg.startsWith('TC-'));

  if (codeArg) {
    agent.activate(codeArg).catch(err => {
      console.error('Activation error:', err.message);
      process.exit(1);
    });
  } else {
    agent.start().catch(err => {
      console.error('Fatal agent error:', err.message);
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
