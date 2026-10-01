import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import os from 'os';
import { pipeline } from 'stream/promises';
import { isReadable } from 'stream';

/**
 * Resolves the canonical export root directory:
 * - Windows: %APPDATA%\TallyConnect\exports
 * - macOS/Linux: ~/.tallyconnect/exports
 */
export function getDefaultExportDirectory() {
  if (process.env.TALLY_EXPORT_DIR) {
    return path.resolve(process.env.TALLY_EXPORT_DIR);
  }
  if (process.platform === 'win32' || process.env.APPDATA) {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'TallyConnect', 'exports');
  }
  return path.join(process.cwd(), 'exports');
}

/**
 * Resolves the canonical logs root directory:
 * - Windows: %APPDATA%\TallyConnect\logs
 * - macOS/Linux: ./logs or custom override
 */
export function getDefaultLogDirectory() {
  if (process.env.TALLY_LOGS_DIR) {
    return path.resolve(process.env.TALLY_LOGS_DIR);
  }
  if (process.platform === 'win32' || process.env.APPDATA) {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'TallyConnect', 'logs');
  }
  return path.join(process.cwd(), 'logs');
}

/**
 * Resolves the canonical debug raw XML directory:
 * - Windows: %APPDATA%\TallyConnect\debug\raw_xml
 * - macOS/Linux: ./debug/raw_xml or custom override
 */
export function getDefaultDebugDirectory() {
  if (process.env.TALLY_DEBUG_DIR) {
    return path.resolve(process.env.TALLY_DEBUG_DIR);
  }
  if (process.platform === 'win32' || process.env.APPDATA) {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'TallyConnect', 'debug', 'raw_xml');
  }
  return path.join(process.cwd(), 'debug', 'raw_xml');
}

export class LocalExportStorage {
  /**
   * @param {Object} [options={}]
   * @param {string} [options.baseDir] - Override storage directory
   */
  constructor(options = {}) {
    this.baseDir = path.resolve(options.baseDir || getDefaultExportDirectory());
    this._ensureDirSync(this.baseDir);
  }

  _ensureDirSync(dir) {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        if (err.code === 'EPERM' || err.code === 'EACCES') {
          const fallback = path.resolve(process.cwd(), 'exports');
          if (!fs.existsSync(fallback)) {
            try {
              fs.mkdirSync(fallback, { recursive: true });
            } catch (_) {}
          }
          this.baseDir = fallback;
          return;
        }
        throw err;
      }
    }
  }

  /**
   * Generates a collision-proof unique filename in baseDir
   * e.g. ledgers_2026-10-01_1030.csv -> ledgers_2026-10-01_1030_1.csv if already exists
   * @param {string} desiredFilename
   * @returns {string} Unique filename
   */
  getUniqueFilename(desiredFilename) {
    const safeName = path.basename(desiredFilename);
    let targetPath = path.join(this.baseDir, safeName);

    if (!fs.existsSync(targetPath)) {
      return safeName;
    }

    const ext = path.extname(safeName);
    const base = path.basename(safeName, ext);

    let counter = 1;
    while (fs.existsSync(targetPath)) {
      const candidate = `${base}_${counter}${ext}`;
      targetPath = path.join(this.baseDir, candidate);
      counter++;
    }

    return path.basename(targetPath);
  }

  /**
   * Saves export stream or buffer to local export storage
   * @param {string} filename - Desired filename
   * @param {ReadableStream|Buffer|string} content
   * @param {Object} [metadata={}]
   * @returns {Promise<{ filename: string, filePath: string, sizeBytes: number, rowCount: number, createdAt: Date }>}
   */
  async saveExport(filename, content, metadata = {}) {
    const safeFilename = this.getUniqueFilename(filename);
    const filePath = path.join(this.baseDir, safeFilename);

    if (content && (typeof content.pipe === 'function' || isReadable(content))) {
      const writeStream = fs.createWriteStream(filePath, { encoding: 'utf-8' });
      await pipeline(content, writeStream);
    } else {
      await fsPromises.writeFile(filePath, content, 'utf-8');
    }

    const stat = await fsPromises.stat(filePath);

    return {
      filename: safeFilename,
      filePath,
      sizeBytes: stat.size,
      rowCount: metadata.rowCount ?? null,
      dataset: metadata.dataset ?? null,
      createdAt: stat.birthtime || stat.mtime
    };
  }

  /**
   * Returns list of saved export files
   */
  async listExports() {
    if (!fs.existsSync(this.baseDir)) return [];
    const entries = await fsPromises.readdir(this.baseDir);
    const csvFiles = entries.filter(f => f.endsWith('.csv'));

    const list = [];
    for (const file of csvFiles) {
      try {
        const filePath = path.join(this.baseDir, file);
        const stat = await fsPromises.stat(filePath);
        list.push({
          filename: file,
          filePath,
          sizeBytes: stat.size,
          createdAt: stat.birthtime || stat.mtime
        });
      } catch (_) {}
    }

    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getBaseDir() {
    return this.baseDir;
  }
}

export const defaultExportStorage = new LocalExportStorage();
