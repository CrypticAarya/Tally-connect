// Suppress Node 18 ExperimentalWarning for fetch
const originalEmitWarning = process.emitWarning;
process.emitWarning = function(warning, ...args) {
  if (args[0] === 'ExperimentalWarning' || (typeof warning === 'string' && warning.includes('Fetch API')) || (warning && warning.name === 'ExperimentalWarning')) {
    return;
  }
  return originalEmitWarning.call(process, warning, ...args);
};

import path from 'path';
import fs from 'fs';
import { ConnectorAgent } from './agent.js';
import { Installer } from './installer.js';
import { TallyClient } from './tallyClient.js';
import { CloudClient } from './cloudClient.js';
import { windowsService } from './windowsService.js';
import { logger } from './logger.js';
import { DEFAULT_PUBLIC_CLOUD_URL } from './cloudConfig.js';
import { getAllEntities, getEntityById, isDateFilteredEntity } from './extraction/entityRegistry.js';
import { ExtractionService } from './extraction/extractionService.js';
import { InteractiveExporter } from './extraction/interactiveExporter.js';
import { LocalExportStorage, getDefaultExportDirectory } from './storage/localExportStorage.js';

async function main() {
  const args = process.argv.slice(2);
  const execPath = process.execPath || process.argv[0] || '';
  const exeDir = (process.pkg && execPath) ? path.dirname(execPath) : process.cwd();
  const execName = path.basename(execPath);
  const scriptName = path.basename(process.argv[1] || '');

  const configArgIdx = args.findIndex(a => a === '--config');
  const targetDirIdx = args.findIndex(a => a === '--target-dir');

  let configPath;
  if (configArgIdx !== -1) {
    configPath = path.resolve(args[configArgIdx + 1]);
  } else if (targetDirIdx !== -1) {
    configPath = path.join(path.resolve(args[targetDirIdx + 1]), 'config.json');
  } else if (fs.existsSync(path.join(exeDir, 'config.json'))) {
    configPath = path.join(exeDir, 'config.json');
  } else {
    configPath = path.resolve(process.cwd(), 'config.json');
  }

  const isHelp = args.includes('--help') || args.includes('-h');
  const isStatus = args.includes('--status');
  const isListDatasets = args.includes('--list-datasets') || args.includes('--datasets');
  const exportArgIdx = args.findIndex(a => a === '--export' || a === '-e');
  const isExport = exportArgIdx !== -1;
  const isDaemon = args.includes('--daemon') || args.includes('--background');

  const hasCodeArg = args.includes('--code') || args.includes('-c') || args.some(a => /^TC-[A-Za-z0-9]{4,8}$/i.test(a));
  // Mode 2 (SaaS Integration Mode) is ONLY activated via explicit CLI flags.
  // Neither TallyConnectAgent.exe nor TallyConnectAgentSetup.exe will require activation
  // unless explicitly invoked with --install, --cloud, --saas, or an activation code flag.
  const isInstall = args.includes('--install') || args.includes('--cloud') || args.includes('--saas') || hasCodeArg;

  // 1. HELP
  if (isHelp) {
    console.log(`
===============================================================
  TALLY CONNECT — Real TallyPrime to CSV Exporter
===============================================================

Usage:
  TallyConnectAgent.exe [options]
  TallyConnectAgentSetup.exe [options]

Mode 1: Local Tally Extraction (Default, No Activation Required):
  (no arguments)              Launch interactive dataset extraction UI
  --export <list>             Extract specified datasets to CSV (e.g. ledgers,customers,trial_balance)
  --list-datasets             List all 15 available Tally datasets
  --from-date <YYYY-MM-DD>    Start date for reports (default: 2026-04-01)
  --to-date <YYYY-MM-DD>      End date for reports (default: 2026-09-30)
  --out-dir <directory>       Custom export directory (default: %APPDATA%\\TallyConnect\\exports)
  --tally-host <host>         TallyPrime host address (default: 127.0.0.1 or env TALLY_HOST)
  --tally-port <port>         TallyPrime XML port (default: 9000 or env TALLY_PORT)

Diagnostics & Status:
  --status                    Display local TallyPrime and Cloud diagnostics
  --help, -h                  Display this help text

Mode 2: SaaS Integration (Optional Cloud Linking):
  --install                   Launch customer cloud setup wizard
  --code <TC-XXXX>            6-character cloud activation code
  --daemon, --background      Start background cloud sync daemon
  --cloud-url <url>           Tally Connect Cloud URL (default: ${DEFAULT_PUBLIC_CLOUD_URL})
  --config <file>             Path to config.json
    `);
    process.exit(0);
  }

  // 2. LIST DATASETS
  if (isListDatasets) {
    console.log('\n===============================================================');
    console.log('  AVAILABLE TALLY DATASETS (15 Scope Datasets)');
    console.log('===============================================================\n');
    const entities = getAllEntities();
    for (const e of entities) {
      const paramStr = e.parameters?.length ? ` (Parameters: ${e.parameters.map(p => p.name).join(', ')})` : '';
      console.log(`  • ${e.id.padEnd(16, ' ')} [${e.category.toUpperCase().padEnd(11, ' ')}] ${e.name}${paramStr}`);
    }
    console.log('\nExample usage:');
    console.log('  TallyConnectAgent.exe --export ledgers,customers,trial_balance\n');
    process.exit(0);
  }

  // 3. STATUS
  if (isStatus) {
    console.log('\n--- Tally Connect Status ---');
    const tallyClient = new TallyClient({
      host: '127.0.0.1',
      port: 9000
    });
    const tallyStatus = await tallyClient.checkStatus();
    console.log(`TallyPrime Status: ${tallyStatus.online ? 'Online (Port ' + tallyStatus.port + ')' : 'Offline'}`);
    if (tallyStatus.online) {
      console.log(`Active Company:    ${tallyStatus.activeCompany || "None detected (Open a company in TallyPrime)"}`);
    } else {
      console.log(`Notice:            ${tallyStatus.message || 'TallyPrime is not running.'}`);
    }

    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        console.log(`Configured Tenant: ${config.companyName || 'None'}`);
        console.log(`Agent Status:      ${config.status || 'ACTIVE'}`);
        const cloudClient = new CloudClient({ cloudUrl: config.cloudUrl });
        const health = await cloudClient.checkHealth();
        console.log(`Cloud Service:     ${health.success ? 'Connected' : 'Offline'}`);
      } catch (_) {}
    }
    console.log(`Export Directory:  ${getDefaultExportDirectory()}`);
    process.exit(0);
  }

  // 4. CLI EXPORT MODE (--export ledgers,customers,trial_balance)
  if (isExport) {
    const rawEntities = args[exportArgIdx + 1];
    if (!rawEntities || rawEntities.startsWith('-')) {
      console.error('✖ Error: Please specify dataset IDs to export, e.g. --export ledgers,customers,trial_balance');
      console.error('Run --list-datasets to view available options.');
      process.exit(1);
    }

    const fromDateIdx = args.findIndex(a => a === '--from-date');
    const toDateIdx = args.findIndex(a => a === '--to-date');
    const outDirIdx = args.findIndex(a => a === '--out-dir');
    const tallyHostIdx = args.findIndex(a => a === '--tally-host' || a === '--host');
    const tallyPortIdx = args.findIndex(a => a === '--tally-port' || a === '--port');
    const formatIdx = args.findIndex(a => a === '--format');

    const exportFormat = (formatIdx !== -1 ? args[formatIdx + 1] : 'csv').toLowerCase();

    const params = {
      fromDate: fromDateIdx !== -1 ? args[fromDateIdx + 1] : '2026-04-01',
      toDate: toDateIdx !== -1 ? args[toDateIdx + 1] : '2026-09-30',
      format: exportFormat
    };

    const outDir = outDirIdx !== -1 ? path.resolve(args[outDirIdx + 1]) : null;
    const tallyHost = tallyHostIdx !== -1 ? args[tallyHostIdx + 1] : (process.env.TALLY_HOST || '127.0.0.1');
    const tallyPort = tallyPortIdx !== -1 ? Number(args[tallyPortIdx + 1]) : Number(process.env.TALLY_PORT || 9000);

    const exportStorage = outDir ? new LocalExportStorage({ baseDir: outDir }) : undefined;
    const extractionService = new ExtractionService({
      host: tallyHost,
      port: tallyPort,
      exportStorage
    });

    const entityList = rawEntities.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

    try {
      console.log(`\nConnecting to TallyPrime at ${tallyHost}:${tallyPort}...`);
      const companyInfo = await extractionService.detectActiveCompany();
      console.log(`✔ Active Company: "${companyInfo.companyName}"`);
      params.companyName = companyInfo.companyName;
      console.log(`\nExporting ${entityList.length} dataset(s) (Format: ${exportFormat.toUpperCase()})...`);

      const results = [];
      let totalRecords = 0;

      for (const id of entityList) {
        process.stdout.write(`  Processing ${id}... `);
        const entityParams = {
          companyName: companyInfo.companyName,
          format: exportFormat,
          ...(isDateFilteredEntity(id) ? { fromDate: params.fromDate, toDate: params.toDate } : {})
        };
        const res = await extractionService.extractEntity(id, entityParams);
        results.push(res);
        totalRecords += res.recordCount;
        if (res.recordCount === 0) {
          console.log(`! 0 records (TALLY RETURNED 0 RECORDS)`);
        } else {
          console.log(`✔ ${res.recordCount} records -> ${res.filename}`);
        }
      }

      console.log('\n===============================================================');
      if (totalRecords === 0) {
        console.log('STATUS: TALLY RETURNED 0 RECORDS');
      } else {
        console.log('STATUS: EXPORT COMPLETE');
      }
      console.log('===============================================================');
      console.log(`Company:       ${companyInfo.companyName}`);
      console.log(`Datasets:      ${results.length}`);
      console.log(`Total Records: ${totalRecords}`);

      for (const r of results) {
        console.log('---------------------------------------------------------------');
        console.log(`Dataset:                ${r.name}`);
        console.log(`Company:                ${companyInfo.companyName}`);
        if (r.period) console.log(`Period:                 ${r.period}`);
        console.log(`Tally records received: ${r.recordsExtracted}`);
        console.log(`Records transformed:    ${r.recordsTransformed}`);
        console.log(`Records exported:       ${r.recordsExported}`);
        if (r.csvFilePath) console.log(`CSV path:               ${r.csvFilePath}`);
        if (r.xmlFilePath) console.log(`XML path:               ${r.xmlFilePath}`);
        console.log(`Status:                 ${r.status}`);
        if (r.validation?.warnings?.length) console.log(`Warnings:               ${r.validation.warnings.join('; ')}`);
        if (r.validation?.explanation) console.log(`Notes:                  ${r.validation.explanation}`);
      }

      console.log('\nSaved directory:');
      console.log(`  ${extractionService.exportStorage.getBaseDir()}`);
      console.log('===============================================================\n');
      process.exit(0);
    } catch (err) {
      console.error(`\n✖ Export failed: ${err.message}\n`);
      process.exit(1);
    }
  }

  // 5. CLOUD SETUP / INSTALLER MODE (--install, Setup.exe, or --code)
  if (isInstall && !isDaemon) {
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

    const targetDir = installArgs.targetDir || (targetDirIdx !== -1 ? path.resolve(args[targetDirIdx + 1]) : exeDir);

    const installer = new Installer({
      targetDir,
      interactive: installArgs.interactive !== false
    });

    try {
      const res = await installer.run(installArgs);
      if (!res || res.success === false) {
        process.exit(1);
      }
      return;
    } catch {
      process.exit(1);
    }
  }

  // 6. CLOUD DAEMON MODE (--daemon / --background)
  if (isDaemon) {
    if (!fs.existsSync(configPath)) {
      console.error(`✖ Error: Configuration missing at ${configPath}. Please run with --install first.`);
      process.exit(1);
    }
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
    return;
  }

  // 7. DEFAULT WORKFLOW: INTERACTIVE TALLY -> CSV EXPORTER
  // (Double-clicked or run from console without flags)
  const tallyHostIdx = args.findIndex(a => a === '--tally-host' || a === '--host');
  const tallyPortIdx = args.findIndex(a => a === '--tally-port' || a === '--port');
  const tallyHost = tallyHostIdx !== -1 ? args[tallyHostIdx + 1] : (process.env.TALLY_HOST || '127.0.0.1');
  const tallyPort = tallyPortIdx !== -1 ? Number(args[tallyPortIdx + 1]) : Number(process.env.TALLY_PORT || 9000);

  const interactiveExporter = new InteractiveExporter({ host: tallyHost, port: tallyPort });
  await interactiveExporter.run();
}

main().catch(err => {
  logger.error('Fatal agent error:', err);
  console.error('\n✖ Fatal Error:', err.message);
  process.exit(1);
});
