import { PassThrough } from 'stream';
import { getSchema, getDefaultExportProfile } from '../engine/schemas.js';
import { defaultExportStorage } from '../storage/localExportStorage.js';
import { CsvExporter } from './csvExporter.js';

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

/**
 * Escapes characters for safe XML output
 */
function escapeXml(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export class XmlExporter {
  /**
   * Serializes transformed rows to a standardized XML document and persists to storage.
   * Architecture:
   *   Tally XML -> Canonical Model -> Target Schema -> XML Renderer
   * 
   * @param {string} datasetType - canonical entity id or alias
   * @param {Array<Object>} rows - Flattened tabular records from Transformer
   * @param {Object} [options={}] - Custom options (filename, storage instance, fromDate, toDate, profile, companyName)
   * @returns {Promise<{ filename: string, filePath: string, sizeBytes: number, rowCount: number, createdAt: Date, columns: Array<string>, format: 'xml' }>}
   */
  static async exportToStorage(datasetType, rows, options = {}) {
    const profile = options.profile || getDefaultExportProfile();
    const schema = getSchema(datasetType, profile);
    const storage = options.storage || defaultExportStorage;

    let filename = options.filename;
    if (!filename) {
      if (options.fromDate && options.toDate) {
        filename = `${schema.fileNamePrefix}_${options.fromDate}_to_${options.toDate}.xml`;
      } else {
        const timestamp = getTimestampString();
        filename = `${schema.fileNamePrefix}_${timestamp}.xml`;
      }
    } else if (!filename.endsWith('.xml')) {
      filename = filename.replace(/\.[^/.]+$/, '') + '.xml';
    }

    const passThrough = new PassThrough({ encoding: 'utf-8' });

    // Stream write the XML document
    passThrough.write('<?xml version="1.0" encoding="UTF-8"?>\r\n');
    const companyAttr = options.companyName ? ` company="${escapeXml(options.companyName)}"` : '';
    const periodAttr = (options.fromDate && options.toDate)
      ? ` fromDate="${escapeXml(options.fromDate)}" toDate="${escapeXml(options.toDate)}"`
      : '';

    passThrough.write(
      `<DATASET id="${escapeXml(schema.id)}" name="${escapeXml(schema.displayName)}" profile="${escapeXml(profile)}"${companyAttr}${periodAttr} totalRecords="${rows.length}">\r\n`
    );

    // Schema Columns block
    passThrough.write(`  <COLUMNS count="${schema.columns.length}">\r\n`);
    schema.columns.forEach((col, idx) => {
      passThrough.write(`    <COLUMN index="${idx + 1}">${escapeXml(col)}</COLUMN>\r\n`);
    });
    passThrough.write('  </COLUMNS>\r\n');

    // Records block
    passThrough.write(`  <RECORDS count="${rows.length}">\r\n`);
    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx];
      passThrough.write(`    <RECORD index="${rIdx + 1}">\r\n`);
      for (const col of schema.columns) {
        const cleanVal = CsvExporter.sanitizeValue(row[col]);
        passThrough.write(`      <FIELD name="${escapeXml(col)}">${escapeXml(cleanVal)}</FIELD>\r\n`);
      }
      passThrough.write('    </RECORD>\r\n');
    }
    passThrough.write('  </RECORDS>\r\n');
    passThrough.write('</DATASET>\r\n');
    passThrough.end();

    const storageRecord = await storage.saveExport(filename, passThrough, {
      dataset: schema.id,
      rowCount: rows.length,
      format: 'xml'
    });

    return {
      ...storageRecord,
      columns: schema.columns,
      format: 'xml'
    };
  }
}
