import { TallyXmlHttpAdapter } from '../adapters/tallyXmlHttpAdapter.js';
import { extractTextValue } from '../adapters/xmlParser.js';
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
   * @returns {Promise<{ companyName: string, version: string, port: number, financialYear: string, financialYearFrom: string, financialYearTo: string }>}
   */
  async detectActiveCompany() {
    logger.info('Probing local TallyPrime for active company...');
    const status = await this.tallyAdapter.testConnection();

    if (!status.available) {
      if (status.tallyRunning === false || status.errorCode === 'TALLY_NOT_RUNNING') {
        const err = new Error('TallyPrime could not be reached. Please ensure TallyPrime is open with port 9000 enabled.');
        err.code = 'TALLY_NOT_RUNNING';
        logger.error(err.message);
        throw err;
      }

      if (status.errorCode === 'NO_ACTIVE_COMPANY' || !status.companyName) {
        const err = new Error('No active Tally company detected. Please open a company in TallyPrime and try again.');
        err.code = 'NO_ACTIVE_COMPANY';
        logger.error(err.message);
        throw err;
      }

      const err = new Error(status.message || 'TallyPrime could not be reached.');
      err.code = status.errorCode || 'TALLY_ERROR';
      logger.error(err.message);
      throw err;
    }

    const cleanCompanyName = typeof status.companyName === 'string'
      ? status.companyName.trim()
      : (extractTextValue(status.companyName) || String(status.companyName || '').trim());

    if (!cleanCompanyName || cleanCompanyName === 'No Company Loaded') {
      const err = new Error('No active Tally company detected. Please open a company in TallyPrime and try again.');
      err.code = 'NO_ACTIVE_COMPANY';
      logger.error(err.message);
      throw err;
    }

    logger.info(`Detected active company: "${cleanCompanyName}" on port ${status.port}`);
    return {
      companyName: cleanCompanyName,
      version: status.version || 'TallyPrime',
      port: status.port,
      financialYear: status.financialYear || '',
      financialYearFrom: status.financialYearFrom || '',
      financialYearTo: status.financialYearTo || ''
    };
  }

  /**
   * Extracts a single dataset by entity ID, normalizes it, transforms it, and exports to CSV.
   * Performs strict data integrity and record reconciliation.
   * @param {string} entityId - canonical id (e.g. 'ledgers', 'trial_balance')
   * @param {Object} [params={}] - parameters such as fromDate, toDate, profile
   * @returns {Promise<{ entityId: string, name: string, recordCount: number, recordsExtracted: number, recordsTransformed: number, recordsExported: number, vouchersExtracted?: number, filename: string, filePath: string, sizeBytes: number, reconciliation: Object }>}
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
      throw new Error(`Failed to extract ${entity.name}: Adapter method "${fetchMethod}" not implemented.`);
    }

    let rawRecords;
    try {
      rawRecords = await this.tallyAdapter[fetchMethod](params);
    } catch (err) {
      const durationMs = Date.now() - startTime;
      logger.error(`Failed to retrieve ${entity.name} from TallyPrime after ${durationMs}ms: ${err.message}`);

      if (err.code === 'TALLY_NOT_RUNNING') {
        const error = new Error('TallyPrime could not be reached.');
        error.code = 'TALLY_NOT_RUNNING';
        throw error;
      }
      if (err.code === 'INVALID_TALLY_RESPONSE' || err.code === 'TALLY_ERROR') {
        const error = new Error('Invalid response received from TallyPrime.');
        error.code = err.code;
        throw error;
      }

      const error = new Error(`Failed to extract ${entity.name}. (${err.message})`);
      error.code = 'TALLY_REQUEST_FAILED';
      throw error;
    }

    if (!Array.isArray(rawRecords)) {
      rawRecords = rawRecords ? [rawRecords] : [];
    }

    const extractedCount = rawRecords.length;
    const isTransaction = [
      'sales_register', 'purchase_register', 'sales_orders',
      'purchase_orders', 'delivery_notes', 'receipt_notes'
    ].includes(entity.id);

    const fetchDurationMs = Date.now() - startTime;
    logger.info(`Retrieved ${extractedCount} raw records for ${entity.name} in ${fetchDurationMs}ms`);

    // Transform into standardized rows
    let csvRows = [];
    try {
      csvRows = Transformer.transform(entity.id, rawRecords, { profile: params.profile });
    } catch (err) {
      logger.error(`Transformation error for ${entity.name}: ${err.message}`);
      throw new Error(`Failed to extract ${entity.name}. Could not normalize data for CSV: ${err.message}`);
    }

    const transformedCount = csvRows.length;

    // Data Integrity Verification
    if (!isTransaction && extractedCount !== transformedCount) {
      const discrepancy = Math.abs(extractedCount - transformedCount);
      const errMsg = `Data integrity check failed for ${entity.name}: ${extractedCount} records extracted but ${transformedCount} transformed (${discrepancy} records discrepancy).`;
      logger.error(errMsg);
      throw new Error(errMsg);
    }

    // Export to CSV
    let exportResult;
    try {
      exportResult = await CsvExporter.exportToStorage(entity.id, csvRows, {
        storage: this.exportStorage,
        fromDate: params.fromDate,
        toDate: params.toDate,
        profile: params.profile
      });
    } catch (err) {
      logger.error(`CSV generation error for ${entity.name}: ${err.message}`);
      throw new Error(`Failed to extract ${entity.name}. Could not create CSV file.`);
    }

    const exportedCount = exportResult.rowCount;

    // Export reconciliation
    if (transformedCount !== exportedCount) {
      const errMsg = `Export reconciliation failed for ${entity.name}: ${transformedCount} transformed rows but ${exportedCount} exported.`;
      logger.error(errMsg);
      throw new Error(errMsg);
    }

    const totalDurationMs = Date.now() - startTime;
    logger.info(`Exported ${exportedCount} records to ${exportResult.filename} (${exportResult.sizeBytes} bytes) in ${totalDurationMs}ms`);

    return {
      entityId: entity.id,
      name: entity.name,
      recordCount: exportedCount,
      recordsExtracted: extractedCount,
      recordsTransformed: transformedCount,
      recordsExported: exportedCount,
      vouchersExtracted: isTransaction ? extractedCount : undefined,
      filename: exportResult.filename,
      filePath: exportResult.filePath,
      sizeBytes: exportResult.sizeBytes,
      reconciliation: {
        extracted: extractedCount,
        transformed: transformedCount,
        exported: exportedCount,
        status: 'MATCH'
      }
    };
  }

  /**
   * Extracts multiple selected datasets in sequence.
   * @param {Array<string>} entityIds
   * @param {Object} [params={}] - Parameter map (e.g. { fromDate, toDate, profile })
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
