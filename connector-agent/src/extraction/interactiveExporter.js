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
    this.initialCompany = options.company || null;
    this.service = options.extractionService || new ExtractionService({
      host: options.host || process.env.TALLY_HOST || '127.0.0.1',
      port: options.port || Number(process.env.TALLY_PORT || 9000),
      selectedCompany: options.company || null
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
      // 1. Connect to TallyPrime & Discover Open Companies
      const host = this.service.tallyAdapter?.host || '127.0.0.1';
      const port = this.service.tallyAdapter?.port || 9000;
      process.stdout.write(`Connecting to TallyPrime on ${host}:${port}... `);
      let availableCompanies = [];
      try {
        availableCompanies = await this.service.getAvailableCompanies();
        console.log('CONNECTED\n');
      } catch (err) {
        console.log('');
        if (err.code === 'TALLY_NOT_RUNNING') {
          console.log('\n✖ TallyPrime could not be reached.');
          console.log('  Please ensure TallyPrime is open and XML port 9000 is enabled.\n');
        } else if (err.code === 'NO_ACTIVE_COMPANY') {
          console.log('\n✔ TallyPrime: CONNECTED');
          console.log('✖ No active Tally company detected.');
          console.log('  Please open a company in TallyPrime and try again.\n');
        } else {
          console.log(`\n✖ ${err.message}\n`);
        }
        await askQuestion(rl, 'Press Enter to exit...');
        return;
      }

      let selectedCompanyInfo = null;

      if (this.initialCompany) {
        try {
          selectedCompanyInfo = await this.service.selectCompany(this.initialCompany);
        } catch (err) {
          console.log(`\n✖ ${err.message}\n`);
          await askQuestion(rl, 'Press Enter to exit...');
          return;
        }
      } else {
        console.log('TallyPrime: CONNECTED\n');
        console.log('Select the company you want to work with:\n');

        for (let i = 0; i < availableCompanies.length; i++) {
          console.log(`${i + 1}. ${availableCompanies[i].name}`);
        }

        while (!selectedCompanyInfo) {
          console.log('\nEnter selection:');
          const selectionInput = await askQuestion(rl, '> ');
          const trimmed = (selectionInput || '').trim();

          if (!trimmed) {
            if (availableCompanies.length === 1) {
              selectedCompanyInfo = availableCompanies[0];
              await this.service.selectCompany(selectedCompanyInfo.name);
              break;
            }
            console.log('Please enter a valid selection number.');
            continue;
          }

          const num = parseInt(trimmed, 10);
          if (!isNaN(num) && num >= 1 && num <= availableCompanies.length) {
            selectedCompanyInfo = availableCompanies[num - 1];
            await this.service.selectCompany(selectedCompanyInfo.name);
            break;
          }

          // Allow entering exact company name
          const match = availableCompanies.find(c => c.name.toLowerCase() === trimmed.toLowerCase());
          if (match) {
            selectedCompanyInfo = match;
            await this.service.selectCompany(selectedCompanyInfo.name);
            break;
          }

          console.log(`Invalid selection "${trimmed}". Please choose a number between 1 and ${availableCompanies.length}.`);
        }
      }

      const displayCompanyName = selectedCompanyInfo.name;
      console.log(`\nSelected Tally Company: ${displayCompanyName}`);
      if (selectedCompanyInfo.financialYear) {
        console.log(`Financial Year:         ${selectedCompanyInfo.financialYear}`);
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
      const trimmedEntities = (selectionAnswer || '').trim().toLowerCase();

      if (!trimmedEntities) {
        // Default to Ledgers, Customers, Trial Balance
        chosenEntities.push(getEntityById('ledgers'));
        chosenEntities.push(getEntityById('customers'));
        chosenEntities.push(getEntityById('trial_balance'));
      } else if (trimmedEntities === 'all') {
        allEntities.forEach(e => chosenEntities.push(e));
      } else {
        const parts = trimmedEntities.split(/[\s,]+/);
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
        const defaultFrom = selectedCompanyInfo.financialYearFrom || '2026-04-01';
        const defaultTo = selectedCompanyInfo.financialYearTo || '2026-09-30';

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

      // 4. Select export format (CSV / XML / Both)
      console.log('\nSelect export format:');
      console.log('  1. CSV (default)');
      console.log('  2. XML');
      console.log('  3. Both CSV and XML');
      const formatAnswer = await askQuestion(rl, 'Format [1]: ');
      let exportFormat = 'csv';
      const trimmedFormat = (formatAnswer || '').trim().toLowerCase();
      if (trimmedFormat === '2' || trimmedFormat === 'xml') {
        exportFormat = 'xml';
      } else if (trimmedFormat === '3' || trimmedFormat === 'both') {
        exportFormat = 'both';
      }

      // 5. Pre-Extraction Switch Verification
      try {
        await this.service.session.verifySelectedCompany();
      } catch (err) {
        if (err.code === 'COMPANY_CHANGED') {
          console.log(`\n✖ Tally company changed.`);
          console.log(`Selected company:\n  ${err.selectedCompany}`);
          console.log(`Current Tally company:\n  ${err.currentCompanies?.join(', ')}`);
          console.log('Please select the company again.\n');
        } else if (err.code === 'COMPANY_NOT_AVAILABLE') {
          console.log('\n✖ The selected Tally company is no longer available. Please select a company again.\n');
        } else {
          console.log(`\n✖ ${err.message}\n`);
        }
        await askQuestion(rl, 'Press Enter to exit...');
        return;
      }

      // 6. Run Extraction
      console.log('\nExporting...\n');
      console.log(`✓ TallyPrime: CONNECTED`);
      console.log(`✓ Selected Tally Company: ${displayCompanyName}`);

      const filesCreated = [];
      let totalRecords = 0;

      for (const ent of chosenEntities) {
        try {
          const entityParams = {
            companyName: displayCompanyName,
            format: exportFormat,
            ...(isDateFilteredEntity(ent.id) ? dateParams : {})
          };

          const result = await this.service.extractEntity(ent.id, entityParams);
          totalRecords += result.recordCount;
          filesCreated.push(result);

          if (result.recordCount === 0) {
            console.log(`! ${ent.name}: TALLY RETURNED 0 RECORDS.`);
          } else {
            console.log(`✓ ${ent.name}: Extracted ${result.recordCount} records.`);
          }
        } catch (err) {
          if (err.code === 'COMPANY_CHANGED') {
            console.log(`\n✖ Tally company changed.`);
            console.log(`Selected company:\n  ${err.selectedCompany}`);
            console.log(`Current Tally company:\n  ${err.currentCompanies?.join(', ')}`);
            console.log('Please select the company again.\n');
            await askQuestion(rl, 'Press Enter to exit...');
            return;
          } else if (err.code === 'COMPANY_NOT_AVAILABLE') {
            console.log('\n✖ The selected Tally company is no longer available. Please select a company again.\n');
            await askQuestion(rl, 'Press Enter to exit...');
            return;
          }
          console.log(`✖ ${ent.name}: ${err.message}`);
          logger.error(`Extraction failed for ${ent.name}:`, err);
        }
      }

      // 6. Authoritative Section 4 Structured Export Summary
      console.log('\n========================================');
      console.log('TALLY CONNECT — EXPORT SUMMARY');
      console.log('========================================');
      console.log(`Company: ${displayCompanyName}`);

      for (const f of filesCreated) {
        console.log('----------------------------------------');
        console.log(`Dataset:                ${f.name}`);
        console.log(`Company:                ${displayCompanyName}`);
        if (f.period) {
          console.log(`Period:                 ${f.period}`);
        }
        console.log(`Tally records received: ${f.recordsExtracted}`);
        console.log(`Records transformed:    ${f.recordsTransformed}`);
        console.log(`Records exported:       ${f.recordsExported}`);
        if (f.csvFilePath) {
          console.log(`CSV path:               ${f.csvFilePath}`);
        }
        if (f.xmlFilePath) {
          console.log(`XML path:               ${f.xmlFilePath}`);
        }
        console.log(`Status:                 ${f.status}`);
        if (f.validation && f.validation.warnings && f.validation.warnings.length > 0) {
          console.log(`Warnings:               ${f.validation.warnings.join('; ')}`);
        }
        if (f.validation && f.validation.explanation) {
          console.log(`Notes:                  ${f.validation.explanation}`);
        }
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
