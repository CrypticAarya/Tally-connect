import { TallyXmlHttpAdapter } from '../adapters/tallyXmlHttpAdapter.js';
import { extractTextValue } from '../adapters/xmlParser.js';
import { getEntityById } from './entityRegistry.js';
import { Transformer } from '../engine/transformer.js';
import { CsvExporter } from '../export/csvExporter.js';
import { XmlExporter } from '../export/xmlExporter.js';
import { DataValidator } from '../engine/dataValidator.js';
import { defaultExportStorage } from '../storage/localExportStorage.js';
import { ExtractionSession } from './extractionSession.js';
import { logger } from '../logger.js';

export class ExtractionService {
  /**
   * @param {Object} [options={}]
   * @param {TallyXmlHttpAdapter} [options.tallyAdapter]
   * @param {LocalExportStorage} [options.exportStorage]
   * @param {ExtractionSession} [options.session]
   */
  constructor(options = {}) {
    this.tallyAdapter = options.tallyAdapter || new TallyXmlHttpAdapter({
      host: options.host || '127.0.0.1',
      port: options.port || 9000
    });
    this.exportStorage = options.exportStorage || defaultExportStorage;
    this.session = options.session || new ExtractionSession({
      tallyHost: options.host || this.tallyAdapter.host || '127.0.0.1',
      tallyPort: options.port || this.tallyAdapter.port || 9000,
      tallyAdapter: this.tallyAdapter,
      selectedCompany: options.selectedCompany || null
    });
  }

  /**
   * Retrieves available open companies from live TallyPrime instance.
   */
  async getAvailableCompanies() {
    return this.session.refreshAvailableCompanies();
  }

  /**
   * Explicitly sets user selected company in session after validating against live Tally.
   */
  async selectCompany(companyName) {
    return this.session.selectCompany(companyName);
  }

  /**
   * Returns currently selected Tally company from session or null.
   */
  getSelectedCompany() {
    return this.session.selectedCompany;
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
   * Extracts a single dataset by entity ID, normalizes it, transforms it, and exports to CSV and/or XML.
   * Performs strict data integrity and record reconciliation.
   * @param {string} entityId - canonical id (e.g. 'ledgers', 'trial_balance')
   * @param {Object} [params={}] - parameters such as fromDate, toDate, profile, format ('csv'|'xml'|'both')
   * @returns {Promise<{ entityId: string, name: string, recordCount: number, recordsExtracted: number, recordsTransformed: number, recordsExported: number, vouchersExtracted?: number, filename: string, filePath: string, sizeBytes: number, reconciliation: Object, status: string }>}
   */
  async extractEntity(entityId, params = {}) {
    const entity = getEntityById(entityId);
    if (!entity) {
      throw new Error(`Unknown dataset: "${entityId}"`);
    }

    // Architectural Rule: User MUST explicitly select a Tally company.
    // If params.companyName is provided, validate and register it in session.
    if (params.companyName) {
      if (!this.session.selectedCompany || this.session.selectedCompany.toLowerCase() !== String(params.companyName).trim().toLowerCase()) {
        await this.session.selectCompany(params.companyName);
      }
    }

    // Verify that a company has been explicitly selected and remains unchanged in live Tally
    const verified = await this.session.verifySelectedCompany();
    const liveCompany = verified.name;

    const extractionParams = {
      ...params,
      companyName: liveCompany
    };

    const startTime = Date.now();
    logger.info(`Starting extraction for dataset: ${entity.name} (${entity.id}) [Company: "${liveCompany}"]...`);

    const fetchMethod = entity.fetchMethod;
    if (typeof this.tallyAdapter[fetchMethod] !== 'function') {
      throw new Error(`Failed to extract ${entity.name}: Adapter method "${fetchMethod}" not implemented.`);
    }

    let rawRecords;
    try {
      rawRecords = await this.tallyAdapter[fetchMethod](extractionParams);
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
      'purchase_orders', 'delivery_notes', 'receipt_notes', 'inventory_master'
    ].includes(entity.id);

    const fetchDurationMs = Date.now() - startTime;
    logger.info(`Retrieved ${extractedCount} raw records for ${entity.name} in ${fetchDurationMs}ms`);

    // Transform into standardized rows conforming strictly to target schema
    let csvRows = [];
    try {
      csvRows = Transformer.transform(entity.id, rawRecords, { profile: extractionParams.profile });
    } catch (err) {
      logger.error(`Transformation error for ${entity.name}: ${err.message}`);
      throw new Error(`Failed to extract ${entity.name}. Could not normalize data for target schema: ${err.message}`);
    }

    const transformedCount = csvRows.length;

    // Run Pre-Export Authoritative Data Validation
    const validation = DataValidator.validate(entity.id, csvRows, {
      profile: extractionParams.profile || 'authoritative',
      recordsExtracted: extractedCount,
      vouchersExtracted: isTransaction ? extractedCount : undefined
    });

    if (!validation.isValid && !isTransaction) {
      const errMsg = `Data validation failed for ${entity.name}:\n${validation.errors.join('\n')}`;
      logger.error(errMsg);
      throw new Error(errMsg);
    }

    const exportFormat = (extractionParams.format || 'csv').toLowerCase();
    let csvExportResult = null;
    let xmlExportResult = null;

    // Export to CSV
    if (exportFormat === 'csv' || exportFormat === 'both') {
      try {
        csvExportResult = await CsvExporter.exportToStorage(entity.id, csvRows, {
          storage: this.exportStorage,
          fromDate: extractionParams.fromDate,
          toDate: extractionParams.toDate,
          profile: extractionParams.profile,
          companyName: liveCompany
        });
      } catch (err) {
        logger.error(`CSV generation error for ${entity.name}: ${err.message}`);
        throw new Error(`Failed to extract ${entity.name}. Could not create CSV file.`);
      }
    }

    // Export to XML
    if (exportFormat === 'xml' || exportFormat === 'both') {
      try {
        xmlExportResult = await XmlExporter.exportToStorage(entity.id, csvRows, {
          storage: this.exportStorage,
          fromDate: extractionParams.fromDate,
          toDate: extractionParams.toDate,
          profile: extractionParams.profile,
          companyName: liveCompany
        });
      } catch (err) {
        logger.error(`XML generation error for ${entity.name}: ${err.message}`);
        throw new Error(`Failed to extract ${entity.name}. Could not create XML file.`);
      }
    }

    const primaryExport = csvExportResult || xmlExportResult;
    const exportedCount = primaryExport ? primaryExport.rowCount : transformedCount;

    const totalDurationMs = Date.now() - startTime;
    logger.info(`Exported ${exportedCount} records for ${entity.name} in ${totalDurationMs}ms`);

    // Strict Status: If 0 records returned, report "TALLY RETURNED 0 RECORDS", never "EXPORT COMPLETE"
    const status = (exportedCount === 0 || extractedCount === 0)
      ? 'TALLY RETURNED 0 RECORDS'
      : 'EXPORT COMPLETE';

    return {
      entityId: entity.id,
      name: entity.name,
      company: liveCompany,
      period: (extractionParams.fromDate && extractionParams.toDate) ? `${extractionParams.fromDate} to ${extractionParams.toDate}` : '',
      recordCount: exportedCount,
      recordsExtracted: extractedCount,
      recordsTransformed: transformedCount,
      recordsExported: exportedCount,
      vouchersExtracted: isTransaction ? extractedCount : undefined,
      filename: csvExportResult?.filename || xmlExportResult?.filename,
      filePath: csvExportResult?.filePath || xmlExportResult?.filePath,
      csvFilename: csvExportResult?.filename || null,
      csvFilePath: csvExportResult?.filePath || null,
      xmlFilename: xmlExportResult?.filename || null,
      xmlFilePath: xmlExportResult?.filePath || null,
      sizeBytes: (csvExportResult?.sizeBytes || 0) + (xmlExportResult?.sizeBytes || 0),
      status,
      validation,
      reconciliation: {
        extracted: extractedCount,
        transformed: transformedCount,
        exported: exportedCount,
        explanation: validation.explanation,
        status: validation.isValid ? 'MATCH' : 'WARNING'
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

    if (params.companyName) {
      if (!this.session.selectedCompany || this.session.selectedCompany.toLowerCase() !== String(params.companyName).trim().toLowerCase()) {
        await this.session.selectCompany(params.companyName);
      }
    }

    // 1. Verify Company (strict validation & switch detection)
    const verified = await this.session.verifySelectedCompany();
    const companyName = verified.name;

    // 2. Extract selected entities
    const files = [];
    for (const id of entityIds) {
      const result = await this.extractEntity(id, {
        ...params,
        companyName
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
