import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { CloudClient } from './cloudClient.js';
import { TallyClient } from './tallyClient.js';
import { windowsService } from './windowsService.js';
import { logger } from './logger.js';
import { ConnectorAgent } from './agent.js';
import { resolveCloudUrl, getSystemErrorLogPath } from './cloudConfig.js';

export class Installer {
  constructor(options = {}) {
    // Default directory is executable directory when packaged, or cwd
    const defaultDir = (process.pkg && process.execPath) ? path.dirname(process.execPath) : process.cwd();
    this.targetDir = options.targetDir || defaultDir;
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

    const displayPrompt = defaultValue ? `${query} [${defaultValue}]: ` : (query ? `${query}: ` : '');

    return new Promise(resolve => {
      rl.question(displayPrompt, answer => {
        rl.close();
        const trimmed = answer.trim();
        resolve(trimmed || defaultValue);
      });
    });
  }

  /**
   * Logs technical error details to local and system error logs
   * %APPDATA%\TallyConnect\logs\errors.log
   */
  _logTechnicalError(title, details) {
    const timestamp = new Date().toISOString();
    let entry = `[${timestamp}] [INSTALLER_ERROR] ${title}\n`;
    if (details instanceof Error) {
      entry += `${details.stack || details.message}\n`;
    } else if (typeof details === 'object') {
      entry += `${JSON.stringify(details, null, 2)}\n`;
    } else {
      entry += `${details}\n`;
    }
    entry += '---------------------------------------------------------------\n';

    // 1. Write to target directory's logs
    try {
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
      fs.appendFileSync(path.join(this.logsDir, 'errors.log'), entry, 'utf-8');
    } catch (_) {}

    // 2. Write to system logs: %APPDATA%\TallyConnect\logs\errors.log
    try {
      const sysPath = getSystemErrorLogPath();
      const sysDir = path.dirname(sysPath);
      if (!fs.existsSync(sysDir)) {
        fs.mkdirSync(sysDir, { recursive: true });
      }
      fs.appendFileSync(sysPath, entry, 'utf-8');
    } catch (_) {}
  }

  /**
   * Handles failure with customer-safe messaging:
   * 1. Displays simple customer-friendly message (no stack traces, no internal URLs)
   * 2. Logs technical details to %APPDATA%\TallyConnect\logs\errors.log
   * 3. Keeps the console window open when interactive (press Enter to exit)
   * 4. Returns { success: false, error } or throws if requested
   */
  async _fail(friendlyMessage, technicalDetails, options = {}) {
    this._logTechnicalError(friendlyMessage, technicalDetails);

    console.log(`\n✖ ${friendlyMessage}`);
    const sysLogPath = getSystemErrorLogPath();
    console.log(`\nTechnical details have been saved to:\n  ${sysLogPath}`);

    if (this.interactive) {
      console.log('\nPress Enter to exit...');
      await this._prompt('');
    }

    if (options.throwOnError) {
      throw new Error(friendlyMessage);
    }

    return {
      success: false,
      error: friendlyMessage
    };
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
    let cloudUrl = resolveCloudUrl(installArgs.cloudUrl, this.configPath);
    let tallyHost = installArgs.tallyHost || '127.0.0.1';
    let tallyPort = Number(installArgs.tallyPort || 9000);

    if (this.interactive && !activationCode) {
      activationCode = await this._prompt('Enter the activation code shown on your screen (e.g. TC-4829)');
    }

    if (!activationCode) {
      const errMsg = 'Please provide your activation code to continue.';
      return await this._fail(errMsg, {
        step: 'activation_code_input',
        error: 'No activation code provided'
      }, { throwOnError: installArgs.throwOnError });
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
      const errMsg = "We couldn't connect to Tally Connect. Please check your internet connection and try again.";
      return await this._fail(errMsg, {
        step: 'cloud_health_check',
        cloudUrl,
        error: health.error,
        timeoutMs: cloudClient.timeoutMs
      }, { throwOnError: installArgs.throwOnError });
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
      return await this._fail(friendlyError, {
        step: 'agent_activation',
        activationCode,
        cloudUrl,
        error: activationRes.error
      }, { throwOnError: installArgs.throwOnError });
    }

    const tenantName = activationRes.companyName || activationRes.tenantName || 'Customer Account';
    console.log('  ✔ Activation code verified');
    console.log(`  ✔ Connected Cloud Tenant: "${tenantName}"`);
    logger.info(`Agent activated successfully: connection_id=${activationRes.connectionId}, agent_id=${activationRes.agentId}, tenant="${tenantName}"`);

    // -------------------------------------------------------------
    // Step 6: Save local credentials
    // -------------------------------------------------------------
    console.log('\n[4/5] Saving secure settings...');
    const configData = {
      cloudUrl,
      connectionId: activationRes.connectionId,
      agentId: activationRes.agentId,
      agentToken: activationRes.agentToken,
      tenantName,
      status: 'ACTIVE',
      machineName,
      tallyHost,
      tallyPort,
      heartbeatIntervalSeconds: 30,
      activatedAt: new Date().toISOString()
    };

    try {
      fs.writeFileSync(this.configPath, JSON.stringify(configData, null, 2), 'utf-8');
      console.log('  ✔ Settings saved securely');
      logger.info(`Credentials saved to ${this.configPath}`);
    } catch (saveErr) {
      return await this._fail('Unable to save settings. Please ensure you have permission to write to this directory.', {
        step: 'save_config',
        configPath: this.configPath,
        error: saveErr.message
      }, { throwOnError: installArgs.throwOnError });
    }

    // -------------------------------------------------------------
    // Step 7: Configure auto-start
    // -------------------------------------------------------------
    console.log('\n[5/5] Setting up automatic startup...');
    const exePath = process.execPath || process.argv[0];
    let targetExe = exePath;
    const dir = path.dirname(exePath);
    const agentExe = path.join(dir, 'TallyConnectAgent.exe');
    if (path.basename(exePath).includes('Setup') && fs.existsSync(agentExe)) {
      targetExe = agentExe;
    }
    const autoStartRes = windowsService.enableAutoStart(targetExe);
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
  installer.run(args).then(res => {
    if (!res || res.success === false) {
      process.exit(1);
    }
  }).catch(() => {
    process.exit(1);
  });
}
