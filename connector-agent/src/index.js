import path from 'path';
import { ConnectorAgent } from './agent.js';
import { Installer } from './installer.js';
import { TallyClient } from './tallyClient.js';
import { CloudClient } from './cloudClient.js';
import { windowsService } from './windowsService.js';
import fs from 'fs';

async function main() {
  const args = process.argv.slice(2);
  const isInstall = args.includes('--install') || (process.argv[1] && process.argv[1].includes('Setup'));
  const isStatus = args.includes('--status');
  const isHelp = args.includes('--help') || args.includes('-h');

  if (isHelp) {
    console.log(`
Tally Connect Agent — Command Line Interface

Usage:
  tally-connect-agent.exe [command] [options]

Commands:
  (default)            Start the agent background daemon
  --install            Launch interactive setup wizard
  --status             Display local TallyPrime and Cloud connection diagnostics
  --help               Display this help text

Options:
  --connector-id <id>  Connector ID (for installer)
  --secret <token>     Tenant secret token (for installer)
  --cloud-url <url>    Tally Connect Cloud URL (default: http://localhost:5001)
  --background         Run silently in background service mode
  --non-interactive    Run installer without terminal prompts
    `);
    process.exit(0);
  }

  if (isStatus) {
    console.log('\n--- Tally Connect Agent Diagnostics ---');
    const configPath = path.resolve(process.cwd(), 'config.json');
    if (!fs.existsSync(configPath)) {
      console.log('✖ Configuration not found. Please run --install first.');
      process.exit(1);
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    console.log(`Connector ID: ${config.connectorId}`);
    console.log(`Cloud Target: ${config.cloudUrl}`);

    const tallyClient = new TallyClient({ host: config.tallyHost, port: config.tallyPort });
    const tallyStatus = await tallyClient.checkStatus();
    console.log(`Tally Status: ${tallyStatus.online ? 'ONLINE' : 'OFFLINE'} (Port: ${tallyStatus.port})`);
    if (tallyStatus.activeCompany) console.log(`Active Company: "${tallyStatus.activeCompany}"`);

    const cloudClient = new CloudClient({ cloudUrl: config.cloudUrl, connectorId: config.connectorId, secret: config.secret });
    const cloudRes = await cloudClient.register(process.env.COMPUTERNAME || 'Diagnostics');
    console.log(`Cloud Auth: ${cloudRes.success ? 'AUTHENTICATED' : 'FAILED: ' + cloudRes.error}`);
    console.log(`Auto-Start Enabled: ${windowsService.isAutoStartEnabled()}`);
    process.exit(0);
  }

  if (isInstall) {
    const installArgs = {};
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--connector-id') installArgs.connectorId = args[++i];
      if (args[i] === '--secret') installArgs.secret = args[++i];
      if (args[i] === '--cloud-url') installArgs.cloudUrl = args[++i];
      if (args[i] === '--non-interactive') installArgs.interactive = false;
    }
    const installer = new Installer({ interactive: installArgs.interactive !== false });
    await installer.run(installArgs);
    return;
  }

  // Default: Run Agent Daemon
  const agent = new ConnectorAgent();
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
  console.error('\n✖ Fatal agent error:', err.message);
  process.exit(1);
});
