import path from 'path';
import fs from 'fs';
import { ConnectorAgent } from './agent.js';
import { Installer } from './installer.js';
import { TallyClient } from './tallyClient.js';
import { CloudClient } from './cloudClient.js';
import { windowsService } from './windowsService.js';
import { logger } from './logger.js';

async function main() {
  const args = process.argv.slice(2);
  const execName = path.basename(process.execPath || process.argv[0] || '');
  const scriptName = path.basename(process.argv[1] || '');
  const configArgIdx = args.findIndex(a => a === '--config');
  let configPath = configArgIdx !== -1 ? path.resolve(args[configArgIdx + 1]) : path.resolve(process.cwd(), 'config.json');

  const targetDirIdx = args.findIndex(a => a === '--target-dir');
  if (targetDirIdx !== -1) {
    configPath = path.join(path.resolve(args[targetDirIdx + 1]), 'config.json');
  }

  const isHelp = args.includes('--help') || args.includes('-h');
  const isStatus = args.includes('--status');
  const hasCodeArg = args.includes('--code') || args.includes('-c') || args.some(a => /^TC-[A-Za-z0-9]{4,8}$/i.test(a));
  const isSetupExecutable = execName.includes('Setup') || scriptName.includes('Setup');
  const isInstall = args.includes('--install') || isSetupExecutable || hasCodeArg || !fs.existsSync(configPath);

  if (isHelp) {
    console.log(`
===============================================================
  Tally Connect Agent — Windows Application
===============================================================

Usage:
  TallyConnectAgentSetup.exe [options]
  TallyConnectAgent.exe [options]

Commands:
  (default)            Start background agent daemon
  --install            Launch customer setup wizard
  --status             Display local TallyPrime and Cloud connection diagnostics
  --help, -h           Display this help text

Options:
  --code <TC-XXXX>     6-character activation code (e.g. TC-4829)
  --cloud-url <url>    Tally Connect Cloud URL (default: http://localhost:5001)
  --tally-port <port>  TallyPrime XML port (default: 9000)
  --background         Run silently in background service mode
  --non-interactive    Run wizard in non-interactive / headless mode
  --no-start           Do not start background agent after setup
  --target-dir <dir>   Installation directory (default: current directory)
  --config <file>      Path to config.json
    `);
    process.exit(0);
  }

  if (isStatus) {
    console.log('\n--- Tally Connect Status ---');
    if (!fs.existsSync(configPath)) {
      console.log('✖ Setup has not been completed. Please run TallyConnectAgentSetup.exe.');
      process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    console.log(`Company:       ${config.companyName || 'Not configured'}`);
    console.log(`Status:        ${config.status || 'ACTIVE'}`);

    const tallyClient = new TallyClient({ host: config.tallyHost || '127.0.0.1', port: config.tallyPort || 9000 });
    const tallyStatus = await tallyClient.checkStatus();
    console.log(`TallyPrime:    ${tallyStatus.online ? 'Connected' : 'Not open'}`);
    if (tallyStatus.activeCompany) console.log(`Open Company:  ${tallyStatus.activeCompany}`);

    const cloudClient = new CloudClient({ cloudUrl: config.cloudUrl });
    const health = await cloudClient.checkHealth();
    console.log(`Cloud Service: ${health.success ? 'Connected' : 'Offline'}`);
    console.log(`Auto-Start:    ${windowsService.isAutoStartEnabled() ? 'Enabled' : 'Disabled'}`);
    process.exit(0);
  }

  // If setup mode (Setup.exe, --install, or no config.json)
  if (isInstall && !args.includes('--background')) {
    const installArgs = {};
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--code' || args[i] === '-c') installArgs.activationCode = args[++i];
      if (/^TC-[A-Za-z0-9]{4,8}$/i.test(args[i])) installArgs.activationCode = args[i];
      if (args[i] === '--cloud-url') installArgs.cloudUrl = args[++i];
      if (args[i] === '--tally-port') installArgs.tallyPort = args[++i];
      if (args[i] === '--target-dir') installArgs.targetDir = args[++i];
      if (args[i] === '--non-interactive') installArgs.interactive = false;
      if (args[i] === '--no-start' || args[i] === '--exit-after-install') installArgs.startAgent = false;
    }

    const installer = new Installer({
      targetDir: installArgs.targetDir || (targetDirIdx !== -1 ? path.resolve(args[targetDirIdx + 1]) : process.cwd()),
      interactive: installArgs.interactive !== false
    });

    await installer.run(installArgs);
    return;
  }

  // Default: Start silent background agent daemon
  const agent = new ConnectorAgent(configPath);
  await agent.start();

  process.on('SIGINT', () => {
    agent.stop();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    agent.stop();
    process.exit(0);
  });
}

main().catch(err => {
  logger.error('Fatal agent error:', err);
  process.exit(1);
});
