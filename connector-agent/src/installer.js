import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
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

    // Ensure logger uses this target directory's logs folder and keep console clean
    logger.setLogsDir(this.logsDir);
    logger.consoleOutput = false;
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
   * Executes the customer-facing simplified installation flow:
   * 1. Welcome
   * 2. Enter activation code (TC-XXXX)
   * 3. Check cloud connection
   * 4. Check TallyPrime availability
   * 5. Activate agent
   * 6. Save local credentials
   * 7. Configure auto-start
   * 8. Complete ("Connected Successfully.")
   */
  async run(installArgs = {}) {
    // -------------------------------------------------------------
    // Step 1: Welcome
    // -------------------------------------------------------------
    console.log('\n===============================================================');
    console.log('📦 Tally Connect Setup');
    console.log('===============================================================');
    console.log('Welcome! This setup will link your TallyPrime in a few moments.\n');

    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }

    logger.info('Setup wizard initiated.');
    logger.info(`Target installation directory: ${this.targetDir}`);

    // -------------------------------------------------------------
    // Step 2: Enter activation code
    // -------------------------------------------------------------
    let activationCode = installArgs.activationCode || installArgs.code;
    let cloudUrl = installArgs.cloudUrl || process.env.AGENT_CLOUD_URL || process.env.CLOUD_URL || (process.env.API_DOMAIN ? `https://${process.env.API_DOMAIN}` : 'http://127.0.0.1:5001');
    let tallyHost = installArgs.tallyHost || '127.0.0.1';
    let tallyPort = Number(installArgs.tallyPort || 9000);

    if (this.interactive && !activationCode) {
      activationCode = await this._prompt('Enter the activation code shown on your screen (e.g. TC-4829)');
    }

    if (!activationCode) {
      const err = 'Please provide your activation code to continue.';
      logger.error('Installation aborted: No activation code provided.');
      throw new Error(err);
    }

    activationCode = activationCode.trim().toUpperCase();
    console.log(`\nActivation Code: ${activationCode}`);
    logger.info(`Activation code entered: ${activationCode}`);

    // -------------------------------------------------------------
    // Step 3: Check cloud connection
    // -------------------------------------------------------------
    console.log('\n[1/5] Connecting to cloud service...');
    const cloudClient = new CloudClient({ cloudUrl });
    const health = await cloudClient.checkHealth();
    if (!health.success) {
      const errMsg = 'Unable to connect to the cloud service. Please check your internet connection and try again.';
      logger.error(`Cloud check failed: ${health.error} (${cloudUrl})`);
      throw new Error(errMsg);
    }
    console.log('  ✔ Connected to cloud service');
    logger.info(`Cloud connection verified at ${cloudUrl}`);

    // -------------------------------------------------------------
    // Step 4: Check TallyPrime availability
    // -------------------------------------------------------------
    console.log('\n[2/5] Checking TallyPrime...');
    const tallyClient = new TallyClient({
      host: tallyHost,
      port: tallyPort
    });
    const tallyStatus = await tallyClient.checkStatus();

    if (tallyStatus.online) {
      console.log('  ✔ TallyPrime detected');
      if (tallyStatus.activeCompany) {
        console.log(`  ✔ Active Company: "${tallyStatus.activeCompany}"`);
      }
      logger.info(`TallyPrime detected online on port ${tallyPort}, active company: "${tallyStatus.activeCompany || 'Default'}"`);
    } else {
      console.log('  ℹ Note: TallyPrime is not open right now.');
      console.log('    Setup will finish normally, and Tally Connect will link automatically when TallyPrime is opened.');
      logger.warn(`TallyPrime not detected on port ${tallyPort}. Agent will auto-detect when opened.`);
    }

    // -------------------------------------------------------------
    // Step 5: Activate agent
    // -------------------------------------------------------------
    console.log('\n[3/5] Verifying activation code...');
    const machineName = installArgs.machineName || os.hostname();
    const activationRes = await cloudClient.activateWithCode(
      activationCode,
      machineName,
      tallyStatus.online ? tallyStatus.activeCompany : null
    );

    if (!activationRes.success) {
      let friendlyError = 'The activation code could not be verified. Please check the code and try again.';
      if (activationRes.error && activationRes.error.toLowerCase().includes('expired')) {
        friendlyError = 'This activation code has expired. Please generate a new code from your dashboard.';
      } else if (activationRes.error && activationRes.error.toLowerCase().includes('already')) {
        friendlyError = 'This activation code has already been used. Please generate a new code if needed.';
      }
      logger.error(`Activation failed: ${activationRes.error}`);
      throw new Error(friendlyError);
    }

    console.log('  ✔ Activation code verified');
    console.log(`  ✔ Connected Company: "${activationRes.companyName}"`);
    logger.info(`Agent activated successfully: connection_id=${activationRes.connectionId}, agent_id=${activationRes.agentId}, company="${activationRes.companyName}"`);

    // -------------------------------------------------------------
    // Step 6: Save local credentials
    // -------------------------------------------------------------
    console.log('\n[4/5] Saving secure settings...');
    const configData = {
      cloudUrl,
      connectionId: activationRes.connectionId,
      agentId: activationRes.agentId,
      agentToken: activationRes.agentToken,
      companyName: activationRes.companyName,
      status: 'ACTIVE',
      machineName,
      tallyHost,
      tallyPort,
      heartbeatIntervalSeconds: 30,
      activatedAt: new Date().toISOString()
    };

    fs.writeFileSync(this.configPath, JSON.stringify(configData, null, 2), 'utf-8');
    console.log('  ✔ Settings saved securely');
    logger.info(`Credentials saved to ${this.configPath}`);

    // -------------------------------------------------------------
    // Step 7: Configure auto-start
    // -------------------------------------------------------------
    console.log('\n[5/5] Setting up automatic startup...');
    const exePath = process.execPath || process.argv[0];
    const autoStartRes = windowsService.enableAutoStart(exePath);
    console.log('  ✔ Automatic startup enabled (starts with Windows)');
    logger.info(`Windows auto-start configured via ${autoStartRes.method}`);

    // -------------------------------------------------------------
    // Step 8: Complete
    // -------------------------------------------------------------
    console.log('\n===============================================================');
    console.log('🎉 Connected Successfully!');
    console.log('Tally Connect is now linked to your company.');
    console.log('Everything is set up and running quietly in the background.');
    console.log('You can now return to your browser.');
    console.log('===============================================================\n');

    logger.info('Setup wizard completed successfully. Agent running.');

    if (installArgs.startAgent !== false) {
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
    if (process.argv[i] === '--code' || process.argv[i] === '-c') args.activationCode = process.argv[++i];
    if (process.argv[i] === '--cloud-url') args.cloudUrl = process.argv[++i];
    if (process.argv[i] === '--tally-port') args.tallyPort = process.argv[++i];
    if (process.argv[i] === '--non-interactive') args.interactive = false;
  }

  const installer = new Installer({ interactive: args.interactive !== false });
  installer.run(args).catch(err => {
    console.error('\n✖ Setup could not be completed:', err.message);
    process.exit(1);
  });
}
