import { format } from 'fast-csv';
import { PassThrough } from 'stream';
import { getSchema } from './schemas.js';
import { exportStorage } from '../storage/index.js';

export class CsvExporter {
  /**
   * Serializes flattened rows to CSV and persists to ExportStorage
   * @param {string} datasetType - DATASET identifier (CUSTOMER, SALES_REGISTER, etc.)
   * @param {Array<Object>} rows - Flattened tabular records from Transformer
   * @param {Object} [options={}] - Custom options (filename, storage instance)
   * @returns {Promise<ExportResult>}
   */
  static async exportToStorage(datasetType, rows, options = {}) {
    const schema = getSchema(datasetType);
    const storage = options.storage || exportStorage;

    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const fileKey = options.filename || `${schema.fileNamePrefix}_${timestamp}.csv`;

    // Initialize fast-csv stream with strict ordered headers
    const csvStream = format({
      headers: schema.columns,
      writeHeaders: true,
      quoteColumns: true, // Quote strings to prevent delimiter conflicts
      quoteHeaders: false
    });

    const passThrough = new PassThrough();
    csvStream.pipe(passThrough);

    // Write all rows to the stream
    for (const row of rows) {
      // Ensure row values follow exact column order
      const orderedRow = {};
      for (const col of schema.columns) {
        orderedRow[col] = row[col] ?? '';
      }
      csvStream.write(orderedRow);
    }
    csvStream.end();

    // Save directly to ExportStorage via stream
    const storageRecord = await storage.saveExport(fileKey, passThrough, {
      dataset: schema.id,
      rowCount: rows.length
    });

    return {
      fileKey: storageRecord.fileKey,
      filename: storageRecord.filename,
      sizeBytes: storageRecord.sizeBytes,
      rowCount: rows.length,
      createdAt: storageRecord.createdAt,
      mimeType: 'text/csv',
      columns: schema.columns,
      preview: rows.slice(0, 5)
    };
  }
}
