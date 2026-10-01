import { TallyXmlHttpAdapter } from '../adapters/tallyXmlHttpAdapter.js';
import { getEntityById } from './entityRegistry.js';
import { Transformer } from '../engine/transformer.js';
import { CsvExporter } from '../export/csvExporter.js';
import { defaultExportStorage } from '../storage/localExportStorage.js';
import { logger } from '../logger.js';

export class ExtractionService {
  /**
   * @param {Object} [options={}]
   * @param {TallyXmlHttpAdapter} [options.tallyAdapter]
   * @param {LocalExportStorage} [options.exportStorage]
   */
  constructor(options = {}) {
    this.tallyAdapter = options.tallyAdapter || new TallyXmlHttpAdapter({
      host: options.host || '127.0.0.1',
      port: options.port || 9000
    });
    this.exportStorage = options.exportStorage || defaultExportStorage;
  }

  /**
   * Detects active company from the running TallyPrime instance.
   * Enforces strict real company detection.
   * @returns {Promise<{ companyName: string, version: string, port: number, financialYear: string }>}
   */
  async detectActiveCompany() {
    logger.info('Probing local TallyPrime for active company...');
    const status = await this.tallyAdapter.testConnection();

    if (!status.available) {
      if (status.tallyRunning === false || status.errorCode === 'TALLY_NOT_RUNNING') {
        const err = new Error('TallyPrime is not running. Please open TallyPrime and try again.');
        err.code = 'TALLY_NOT_RUNNING';
        logger.error(err.message);
        throw err;
      }

      if (status.errorCode === 'NO_ACTIVE_COMPANY' || !status.companyName) {
        const err = new Error("We couldn't identify the active Tally company. Please open a company in TallyPrime and try again.");
        err.code = 'NO_ACTIVE_COMPANY';
        logger.error(err.message);
        throw err;
      }

      const err = new Error(status.message || "We couldn't retrieve this data from TallyPrime.");
      err.code = status.errorCode || 'TALLY_ERROR';
      logger.error(err.message);
      throw err;
    }

    if (!status.companyName || status.companyName === 'No Company Loaded') {
      const err = new Error("We couldn't identify the active Tally company. Please open a company in TallyPrime and try again.");
      err.code = 'NO_ACTIVE_COMPANY';
      logger.error(err.message);
      throw err;
    }

    logger.info(`Detected active company: "${status.companyName}" on port ${status.port}`);
    return {
      companyName: status.companyName,
      version: status.version || 'TallyPrime',
      port: status.port,
      financialYear: status.financialYear || ''
    };
  }

  /**
   * Extracts a single dataset by entity ID, normalizes it, transforms it, and exports to CSV.
   * @param {string} entityId - canonical id (e.g. 'ledgers', 'trial_balance')
   * @param {Object} [params={}] - parameters such as fromDate, toDate
   * @returns {Promise<{ entityId: string, name: string, recordCount: number, filename: string, filePath: string, sizeBytes: number }>}
   */
  async extractEntity(entityId, params = {}) {
    const entity = getEntityById(entityId);
    if (!entity) {
      throw new Error(`Unknown dataset: "${entityId}"`);
    }

    const startTime = Date.now();
    logger.info(`Starting extraction for dataset: ${entity.name} (${entity.id})...`);

    const fetchMethod = entity.fetchMethod;
    if (typeof this.tallyAdapter[fetchMethod] !== 'function') {
      throw new Error(`Adapter method "${fetchMethod}" not implemented for dataset "${entity.id}"`);
    }

    let rawRecords;
    try {
      rawRecords = await this.tallyAdapter[fetchMethod](params);
    } catch (err) {
      const durationMs = Date.now() - startTime;
      logger.error(`Failed to retrieve ${entity.name} from TallyPrime after ${durationMs}ms: ${err.message}`);

      if (err.code === 'TALLY_NOT_RUNNING') {
        const error = new Error('TallyPrime is not running. Please open TallyPrime and try again.');
        error.code = 'TALLY_NOT_RUNNING';
        throw error;
      }
      const error = new Error(`We couldn't retrieve this data from TallyPrime: ${err.message}`);
      error.code = 'TALLY_REQUEST_FAILED';
      throw error;
    }

    const fetchDurationMs = Date.now() - startTime;
    logger.info(`Retrieved ${rawRecords ? rawRecords.length : 0} raw records for ${entity.name} in ${fetchDurationMs}ms`);

    if (!Array.isArray(rawRecords)) {
      rawRecords = rawRecords ? [rawRecords] : [];
    }

    // Transform into standardized CSV rows
    let csvRows = [];
    try {
      csvRows = Transformer.transform(entity.id, rawRecords);
    } catch (err) {
      logger.error(`Transformation error for ${entity.name}: ${err.message}`);
      throw new Error(`We retrieved the data but couldn't normalize it for CSV: ${err.message}`);
    }

    // Export to CSV
    let exportResult;
    try {
      exportResult = await CsvExporter.exportToStorage(entity.id, csvRows, {
        storage: this.exportStorage,
        fromDate: params.fromDate,
        toDate: params.toDate
      });
    } catch (err) {
      logger.error(`CSV generation error for ${entity.name}: ${err.message}`);
      throw new Error("We retrieved the data but couldn't create the CSV file.");
    }

    const totalDurationMs = Date.now() - startTime;
    logger.info(`Exported ${csvRows.length} records to ${exportResult.filename} (${exportResult.sizeBytes} bytes) in ${totalDurationMs}ms`);

    return {
      entityId: entity.id,
      name: entity.name,
      recordCount: csvRows.length,
      filename: exportResult.filename,
      filePath: exportResult.filePath,
      sizeBytes: exportResult.sizeBytes
    };
  }

  /**
   * Extracts multiple selected datasets in sequence.
   * @param {Array<string>} entityIds
   * @param {Object} [params={}] - Parameter map (e.g. { fromDate, toDate })
   * @returns {Promise<{ company: string, datasetsCount: number, totalRecords: number, files: Array<Object>, exportDir: string }>}
   */
  async extractSelected(entityIds, params = {}) {
    if (!Array.isArray(entityIds) || entityIds.length === 0) {
      throw new Error('Please select at least one dataset to export.');
    }

    // 1. Detect Company (strict validation)
    const companyInfo = await this.detectActiveCompany();

    // 2. Extract selected entities
    const files = [];
    for (const id of entityIds) {
      const result = await this.extractEntity(id, {
        ...params,
        companyName: companyInfo.companyName
      });
      files.push(result);
    }

    const totalRecords = files.reduce((sum, f) => sum + f.recordCount, 0);

    return {
      company: companyInfo.companyName,
      datasetsCount: files.length,
      totalRecords,
      files,
      exportDir: this.exportStorage.getBaseDir()
    };
  }
}
