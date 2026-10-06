import { format } from 'fast-csv';
import { PassThrough } from 'stream';
import { getSchema, getDefaultExportProfile } from '../engine/schemas.js';
import { defaultExportStorage } from '../storage/localExportStorage.js';

/**
 * Formats current date and time as YYYY-MM-DD_HHMM
 */
function getTimestampString(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}_${hh}${min}`;
}

export class CsvExporter {
  /**
   * Sanitizes a single cell value to guarantee no [object Object] or raw XML escapes
   * @param {*} val
   * @returns {string}
   */
  static sanitizeValue(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'number') return isNaN(val) ? '' : String(val);
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    if (val instanceof Date) return val.toISOString();
    if (Array.isArray(val)) {
      return val.map(v => CsvExporter.sanitizeValue(v)).filter(Boolean).join(', ');
    }
    if (typeof val === 'object') {
      if (val['#text'] !== undefined && val['#text'] !== null) return String(val['#text']).trim();
      if (val.value !== undefined && val.value !== null) return String(val.value).trim();
      if (val['@_NAME'] !== undefined && val['@_NAME'] !== null) return String(val['@_NAME']).trim();
      if (val.name !== undefined && val.name !== null) return String(val.name).trim();
      return '';
    }
    return String(val).trim();
  }

  /**
   * Serializes flattened rows to CSV and persists to LocalExportStorage
   * @param {string} datasetType - canonical entity id or alias
   * @param {Array<Object>} rows - Flattened tabular records from Transformer
   * @param {Object} [options={}] - Custom options (filename, storage instance, fromDate, toDate, profile)
   * @returns {Promise<{ filename: string, filePath: string, sizeBytes: number, rowCount: number, createdAt: Date, columns: Array<string> }>}
   */
  static async exportToStorage(datasetType, rows, options = {}) {
    const profile = options.profile || getDefaultExportProfile();
    const schema = getSchema(datasetType, profile);
    const storage = options.storage || defaultExportStorage;

    let filename = options.filename;
    if (!filename) {
      if (options.fromDate && options.toDate) {
        filename = `${schema.fileNamePrefix}_${options.fromDate}_to_${options.toDate}.csv`;
      } else {
        const timestamp = getTimestampString();
        filename = `${schema.fileNamePrefix}_${timestamp}.csv`;
      }
    }

    const passThrough = new PassThrough({ encoding: 'utf-8' });

    // Prepend UTF-8 BOM for seamless Microsoft Excel compatibility on Windows
    passThrough.write('\uFEFF');

    if (rows.length === 0) {
      // Guarantee valid RFC 4180 CSV with header row for 0-record exports (never a 0 KB / 0 byte corrupt file)
      passThrough.write(schema.columns.join(',') + '\r\n');
      passThrough.end();
    } else {
      // Initialize fast-csv stream with strict headers, quoting, and RFC 4180 escaping
      const csvStream = format({
        headers: schema.columns,
        writeHeaders: true,
        quoteColumns: true, // Quote columns to properly escape commas, newlines and quotes
        quoteHeaders: false
      });
      csvStream.pipe(passThrough);

      // Stream write rows in exact column order with sanitized values
      for (const row of rows) {
        const orderedRow = {};
        for (const col of schema.columns) {
          orderedRow[col] = this.sanitizeValue(row[col]);
        }
        csvStream.write(orderedRow);
      }
      csvStream.end();
    }

    // Save directly to disk via stream
    const storageRecord = await storage.saveExport(filename, passThrough, {
      dataset: schema.id,
      rowCount: rows.length
    });

    return {
      filename: storageRecord.filename,
      filePath: storageRecord.filePath,
      sizeBytes: storageRecord.sizeBytes,
      rowCount: rows.length,
      createdAt: storageRecord.createdAt,
      columns: schema.columns
    };
  }
}
