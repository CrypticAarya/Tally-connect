import readline from 'readline';
import { exec } from 'child_process';
import { getAllEntities, getEntityById } from './entityRegistry.js';
import { ExtractionService } from './extractionService.js';
import { logger } from '../logger.js';

function askQuestion(rl, query) {
  return new Promise(resolve => rl.question(query, resolve));
}

/**
 * Opens a directory in the native file explorer
 */
function openFolderInExplorer(folderPath) {
  const platform = process.platform;
  let cmd = '';
  if (platform === 'win32') {
    cmd = `explorer.exe "${folderPath}"`;
  } else if (platform === 'darwin') {
    cmd = `open "${folderPath}"`;
  } else {
    cmd = `xdg-open "${folderPath}"`;
  }

  exec(cmd, err => {
    if (err) {
      logger.warn(`Could not open folder automatically: ${err.message}`);
    }
  });
}

export class InteractiveExporter {
  /**
   * @param {Object} [options={}]
   * @param {ExtractionService} [options.extractionService]
   */
  constructor(options = {}) {
    this.service = options.extractionService || new ExtractionService();
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
      process.stdout.write('Detecting TallyPrime on port 9000... ');
      let companyInfo;
      try {
        companyInfo = await this.service.detectActiveCompany();
      } catch (err) {
        console.log('');
        if (err.code === 'TALLY_NOT_RUNNING') {
          console.log('\n✖ TallyPrime: Offline (Port 9000)');
          console.log('  Please ensure TallyPrime is running and XML port 9000 is enabled.\n');
        } else if (err.code === 'NO_ACTIVE_COMPANY') {
          console.log('\n✔ TallyPrime: Connected');
          console.log('✖ Company: None detected');
          console.log('  Please open a company in TallyPrime and try again.\n');
        } else {
          console.log(`\n✖ ${err.message}\n`);
        }
        await askQuestion(rl, 'Press Enter to exit...');
        return;
      }

      console.log('Connected');
      console.log(`TallyPrime: Connected`);
      console.log(`Company: ${companyInfo.companyName}`);
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

      // 3. Ask for parameters ONLY if required by selected entities
      const params = {
        companyName: companyInfo.companyName
      };
      const needsDateRange = chosenEntities.some(e => e.parameters && e.parameters.length > 0);

      if (needsDateRange) {
        console.log('\nFor date-filtered reports (e.g. Trial Balance):');
        const fromAnswer = await askQuestion(rl, 'From Date [2026-04-01]: ');
        const toAnswer = await askQuestion(rl, 'To Date [2026-09-30]: ');

        params.fromDate = (fromAnswer || '').trim() || '2026-04-01';
        params.toDate = (toAnswer || '').trim() || '2026-09-30';
      }

      // 4. Run Extraction
      console.log('\nExporting...\n');
      console.log(`✓ TallyPrime connected`);
      console.log(`✓ Company detected: ${companyInfo.companyName}`);

      const filesCreated = [];
      let totalRecords = 0;

      for (const ent of chosenEntities) {
        try {
          const result = await this.service.extractEntity(ent.id, params);
          totalRecords += result.recordCount;
          filesCreated.push(result);
          console.log(`✓ ${ent.name} extracted: ${result.recordCount}`);
        } catch (err) {
          console.log(`✖ ${ent.name} failed: ${err.message}`);
          logger.error(`Extraction failed for ${ent.name}:`, err);
        }
      }

      // 5. Section 14 Export Complete Summary
      console.log('\n========================================');
      console.log('EXPORT COMPLETE');
      console.log('========================================');
      console.log(`Company:       ${companyInfo.companyName}`);
      console.log(`Datasets:      ${filesCreated.length}`);
      console.log(`Total Records: ${totalRecords}`);
      console.log('\nCSV files created:');
      for (const f of filesCreated) {
        console.log(`  ✓ ${f.filename} (${f.recordCount} records, ${(f.sizeBytes / 1024).toFixed(1)} KB)`);
      }
      console.log(`\nSaved to:`);
      const exportDir = this.service.exportStorage.getBaseDir();
      console.log(`  ${exportDir}`);
      console.log('========================================\n');

      // 6. Offer to open export directory
      const openFolderAnswer = await askQuestion(rl, 'Open export folder? (Y/n): ');
      if (!openFolderAnswer || openFolderAnswer.trim().toLowerCase() === 'y' || openFolderAnswer.trim().toLowerCase() === 'yes') {
        openFolderInExplorer(exportDir);
      }

      await askQuestion(rl, '\nPress Enter to exit...');
    } finally {
      rl.close();
    }
  }
}
