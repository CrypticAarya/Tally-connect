import readline from 'readline';
import { spawn } from 'child_process';
import path from 'path';
import { getAllEntities, getEntityById, isDateFilteredEntity } from './entityRegistry.js';
import { ExtractionService } from './extractionService.js';
import { logger } from '../logger.js';

function askQuestion(rl, query) {
  return new Promise(resolve => rl.question(query, resolve));
}

/**
 * Opens a directory in the native file explorer safely and without blocking
 */
function openFolderInExplorer(folderPath) {
  try {
    const normalizedPath = path.normalize(folderPath);
    if (process.platform === 'win32') {
      const child = spawn('explorer.exe', [normalizedPath], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      child.on('error', err => {
        logger.warn(`Could not open folder automatically: ${err.message}`);
      });
    } else if (process.platform === 'darwin') {
      const child = spawn('open', [normalizedPath], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      child.on('error', err => {
        logger.warn(`Could not open folder automatically: ${err.message}`);
      });
    } else {
      const child = spawn('xdg-open', [normalizedPath], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      child.on('error', err => {
        logger.warn(`Could not open folder automatically: ${err.message}`);
      });
    }
  } catch (err) {
    logger.warn(`Could not open folder automatically: ${err.message}`);
  }
}

export class InteractiveExporter {
  /**
   * @param {Object} [options={}]
   * @param {ExtractionService} [options.extractionService]
   */
  constructor(options = {}) {
    this.service = options.extractionService || new ExtractionService({
      host: options.host || process.env.TALLY_HOST || '127.0.0.1',
      port: options.port || Number(process.env.TALLY_PORT || 9000)
    });
  }

  /**
   * Runs the full interactive export console session
   */
  async run() {
    console.log('\n========================================');
    console.log('TALLY CONNECT');
    console.log('========================================\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      // 1. Detect TallyPrime & Company
      const host = this.service.tallyAdapter?.host || '127.0.0.1';
      const port = this.service.tallyAdapter?.port || 9000;
      process.stdout.write(`Detecting TallyPrime on ${host}:${port}... `);
      let companyInfo;
      try {
        companyInfo = await this.service.detectActiveCompany();
      } catch (err) {
        console.log('');
        if (err.code === 'TALLY_NOT_RUNNING') {
          console.log('\n✖ TallyPrime could not be reached.');
          console.log('  Please ensure TallyPrime is open and XML port 9000 is enabled.\n');
        } else if (err.code === 'NO_ACTIVE_COMPANY') {
          console.log('\n✔ TallyPrime: Connected');
          console.log('✖ No active Tally company detected.');
          console.log('  Please open a company in TallyPrime and try again.\n');
        } else {
          console.log(`\n✖ ${err.message}\n`);
        }
        await askQuestion(rl, 'Press Enter to exit...');
        return;
      }

      const displayCompanyName = typeof companyInfo.companyName === 'string'
        ? companyInfo.companyName
        : String(companyInfo.companyName?.['#text'] || companyInfo.companyName?.value || companyInfo.companyName?.name || companyInfo.companyName || '');

      console.log('Connected');
      console.log(`TallyPrime: Connected`);
      console.log(`Company: ${displayCompanyName}`);
      if (companyInfo.financialYear) {
        console.log(`Financial Year: ${companyInfo.financialYear}`);
      }

      // 2. Display available datasets
      const allEntities = getAllEntities();
      console.log('\nWhat would you like to export?\n');

      let itemIndex = 1;
      const indexToEntityMap = new Map();

      for (const ent of allEntities) {
        console.log(`${String(itemIndex).padStart(2, ' ')}. ${ent.name}`);
        indexToEntityMap.set(itemIndex, ent);
        itemIndex++;
      }

      console.log('\nSelect (e.g. 1, 4, 14 or "all", default: 1, 4, 14):');
      const selectionAnswer = await askQuestion(rl, '> ');

      const chosenEntities = [];
      const trimmed = (selectionAnswer || '').trim().toLowerCase();

      if (!trimmed) {
        // Default to Ledgers, Customers, Trial Balance
        chosenEntities.push(getEntityById('ledgers'));
        chosenEntities.push(getEntityById('customers'));
        chosenEntities.push(getEntityById('trial_balance'));
      } else if (trimmed === 'all') {
        allEntities.forEach(e => chosenEntities.push(e));
      } else {
        const parts = trimmed.split(/[\s,]+/);
        for (const p of parts) {
          const num = parseInt(p, 10);
          if (!isNaN(num) && indexToEntityMap.has(num)) {
            const ent = indexToEntityMap.get(num);
            if (!chosenEntities.includes(ent)) {
              chosenEntities.push(ent);
            }
          } else {
            const byId = getEntityById(p);
            if (byId && !chosenEntities.includes(byId)) {
              chosenEntities.push(byId);
            }
          }
        }
      }

      if (chosenEntities.length === 0) {
        console.log('\n✖ No valid datasets selected.');
        await askQuestion(rl, 'Press Enter to exit...');
        return;
      }

      // 3. Ask for parameters ONLY if required by selected entities (Dataset-aware date filtering)
      const dateFilteredEntities = chosenEntities.filter(e => isDateFilteredEntity(e.id));
      const dateParams = {};

      if (dateFilteredEntities.length > 0) {
        const defaultFrom = companyInfo.financialYearFrom || '2026-04-01';
        const defaultTo = companyInfo.financialYearTo || '2026-09-30';

        if (chosenEntities.length === 1 && dateFilteredEntities.length === 1) {
          console.log(`\nEnter date range for ${dateFilteredEntities[0].name}:`);
        } else {
          const names = dateFilteredEntities.map(e => e.name).join(', ');
          console.log(`\nDate range required for: ${names}`);
        }

        const fromAnswer = await askQuestion(rl, `From Date [${defaultFrom}]: `);
        const toAnswer = await askQuestion(rl, `To Date [${defaultTo}]: `);

        dateParams.fromDate = (fromAnswer || '').trim() || defaultFrom;
        dateParams.toDate = (toAnswer || '').trim() || defaultTo;
      }

      // 4. Run Extraction
      console.log('\nExporting...\n');
      console.log(`✓ TallyPrime connected`);
      console.log(`✓ Company detected: ${displayCompanyName}`);

      const filesCreated = [];
      let totalRecords = 0;

      for (const ent of chosenEntities) {
        try {
          const entityParams = {
            companyName: displayCompanyName,
            ...(isDateFilteredEntity(ent.id) ? dateParams : {})
          };

          const result = await this.service.extractEntity(ent.id, entityParams);
          totalRecords += result.recordCount;
          filesCreated.push(result);

          if (result.recordCount === 0) {
            console.log(`✓ ${ent.name}: Extraction successful — 0 records.`);
          } else {
            console.log(`✓ ${ent.name}: Extracted ${result.recordCount} records.`);
          }
        } catch (err) {
          console.log(`✖ ${ent.name}: ${err.message}`);
          logger.error(`Extraction failed for ${ent.name}:`, err);
        }
      }

      // 5. Section 9 Structured Export Summary
      console.log('\n========================================');
      console.log('TALLY CONNECT');
      console.log('========================================');
      console.log(`Company:`);
      console.log(`${displayCompanyName}`);

      const periodStr = dateParams.fromDate && dateParams.toDate
        ? `${dateParams.fromDate} → ${dateParams.toDate}`
        : (companyInfo.financialYear || 'Active Financial Year');

      for (const f of filesCreated) {
        console.log(`\nDataset:`);
        console.log(`${f.name}`);
        console.log(`Period:`);
        console.log(`${periodStr}`);
        console.log(`Records extracted:`);
        console.log(`${f.recordsExtracted}`);
        console.log(`Records exported:`);
        console.log(`${f.recordsExported}`);
        console.log(`Status:`);
        console.log(`✓ EXPORT COMPLETE`);
        console.log(`File:`);
        console.log(`${f.filePath}`);
      }

      const exportDir = this.service.exportStorage.getBaseDir();
      console.log('\n========================================');
      console.log(`Saved Directory: ${exportDir}`);
      console.log('========================================\n');

      // 6. Offer to open export directory
      const openFolderAnswer = await askQuestion(rl, '[Open Export Folder] (Y/n): ');
      if (!openFolderAnswer || openFolderAnswer.trim().toLowerCase() === 'y' || openFolderAnswer.trim().toLowerCase() === 'yes') {
        openFolderInExplorer(exportDir);
      }

      await askQuestion(rl, '\nPress Enter to exit...');
    } finally {
      rl.close();
    }
  }
}
