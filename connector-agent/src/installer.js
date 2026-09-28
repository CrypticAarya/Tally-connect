import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { CloudClient } from './cloudClient.js';
import { TallyClient } from './tallyClient.js';
import { windowsService } from './windowsService.js';
import { logger } from './logger.js';
import { ConnectorAgent } from './agent.js';

export class Installer {
  constructor(options = {}) {
    this.targetDir = options.targetDir || process.cwd();
    this.configPath = path.join(this.targetDir, 'config.json');
    this.logsDir = path.join(this.targetDir, 'logs');
    this.interactive = options.interactive ?? true;
  }

  /**
   * Helper to prompt user via console readline
   */
  async _prompt(query, defaultValue = '') {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const displayPrompt = defaultValue ? `${query} [${defaultValue}]: ` : `${query}: `;

    return new Promise(resolve => {
      rl.question(displayPrompt, answer => {
        rl.close();
        const trimmed = answer.trim();
        resolve(trimmed || defaultValue);
      });
    });
  }

  /**
   * Executes the 6-step installation flow
   */
  async run(installArgs = {}) {
    console.log('\n===============================================================');
    console.log('📦 Tally Connect Agent — Production Installation Wizard');
    console.log('===============================================================\n');

    // -------------------------------------------------------------
    // Step 1: Install application / directory verification
    // -------------------------------------------------------------
    console.log('[Step 1/6] Preparing installation environment...');
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
    console.log(`  ✔ Installation Directory: ${this.targetDir}`);
    console.log(`  ✔ Logs Directory: ${this.logsDir}`);

    // -------------------------------------------------------------
    // Step 2 & 3: Collect credentials & endpoints
    // -------------------------------------------------------------
    console.log('\n[Step 2/6] Configuring customer credentials...');
    let cloudUrl = installArgs.cloudUrl;
    let connectorId = installArgs.connectorId;
    let secret = installArgs.secret;
    let tallyHost = installArgs.tallyHost || '127.0.0.1';
    let tallyPort = installArgs.tallyPort || 9000;

    if (this.interactive && (!connectorId || !secret)) {
      if (!cloudUrl) {
        cloudUrl = await this._prompt('Enter Tally Connect Cloud URL', 'http://localhost:5001');
      }
      if (!connectorId) {
        connectorId = await this._prompt('Enter Connector ID (e.g. conn_acme_mumbai_01)');
      }
      if (!secret) {
        secret = await this._prompt('Enter Secret Token (tok_beta_...)');
      }
    }

    cloudUrl = cloudUrl || 'http://localhost:5001';

    if (!connectorId || !secret) {
      throw new Error('Installation aborted: "connectorId" and "secret" token are required.');
    }

    console.log(`  ✔ Connector ID: ${connectorId}`);
    console.log(`  ✔ Cloud Target: ${cloudUrl}`);

    // -------------------------------------------------------------
    // Step 4: Pre-flight check - Validate Cloud connection & token
    // -------------------------------------------------------------
    console.log('\n[Step 3/6] Validating credentials with Tally Connect Cloud...');
    const machineName = os.hostname();
    const cloudClient = new CloudClient({ cloudUrl, connectorId, secret });

    const cloudRes = await cloudClient.register(machineName);
    if (!cloudRes.success) {
      const errorMsg = `Cloud validation failed: ${cloudRes.error}`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    const tenantInfo = cloudRes.data;
    console.log(`  ✔ Successfully authenticated with Cloud!`);
    console.log(`  ✔ Linked Tenant: "${tenantInfo.companyName || 'Verified'}" (ID: ${tenantInfo.tenantId || 'ten_active'})`);

    // -------------------------------------------------------------
    // Step 5: Pre-flight check - Check local TallyPrime
    // -------------------------------------------------------------
    console.log('\n[Step 4/6] Checking local TallyPrime availability...');
    const tallyClient = new TallyClient({ host: tallyHost, port: tallyPort, simulateIfOffline: true });
    const tallyStatus = await tallyClient.checkStatus();

    if (tallyStatus.online) {
      console.log(`  ✔ TallyPrime detected on port ${tallyPort} (${tallyStatus.latencyMs}ms)`);
      console.log(`  ✔ Active Company: "${tallyStatus.activeCompany}"`);
    } else {
      console.warn(`  ⚠ Notice: TallyPrime not yet running on port ${tallyPort}.`);
      console.warn(`    The agent will automatically detect TallyPrime once opened.`);
    }

    // -------------------------------------------------------------
    // Step 6: Write configuration file
    // -------------------------------------------------------------
    console.log('\n[Step 5/6] Writing production configuration file...');
    const configData = {
      cloudUrl,
      connectorId,
      secret,
      tallyHost,
      tallyPort: Number(tallyPort),
      heartbeatIntervalSeconds: 30,
      pollIntervalSeconds: 10,
      installedAt: new Date().toISOString(),
      machineName
    };

    fs.writeFileSync(this.configPath, JSON.stringify(configData, null, 2), 'utf-8');
    console.log(`  ✔ Saved config to: ${this.configPath}`);

    // -------------------------------------------------------------
    // Step 7: Configure Windows Auto-Start
    // -------------------------------------------------------------
    console.log('\n[Step 6/6] Configuring automatic background start...');
    const exePath = process.argv[0];
    const autoStartRes = windowsService.enableAutoStart(exePath);
    console.log(`  ✔ Background auto-start registered (${autoStartRes.method})`);

    console.log('\n===============================================================');
    console.log('🎉 Tally Connect Agent successfully installed and ready!');
    console.log('===============================================================\n');

    // Optionally launch agent
    if (installArgs.startAgent !== false) {
      console.log('Starting background agent...\n');
      const agent = new ConnectorAgent(this.configPath);
      await agent.start();
      return { success: true, agent, config: configData };
    }

    return { success: true, config: configData };
  }
}

// Auto-run if executed directly via CLI
if (process.argv[1] && process.argv[1].endsWith('installer.js')) {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--connector-id') args.connectorId = process.argv[++i];
    if (process.argv[i] === '--secret') args.secret = process.argv[++i];
    if (process.argv[i] === '--cloud-url') args.cloudUrl = process.argv[++i];
    if (process.argv[i] === '--non-interactive') args.interactive = false;
  }

  const installer = new Installer({ interactive: args.interactive !== false });
  installer.run(args).catch(err => {
    console.error('\n✖ Installation failed:', err.message);
    process.exit(1);
  });
}
