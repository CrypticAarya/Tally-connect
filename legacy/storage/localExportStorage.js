import fs from 'fs';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { isReadable } from 'stream';
import { ExportStorage } from './exportStorage.js';

export class LocalExportStorage extends ExportStorage {
  /**
   * @param {Object} options
   * @param {string} options.baseDir - Absolute path to storage directory
   */
  constructor({ baseDir }) {
    super();
    if (!baseDir) {
      throw new Error('LocalExportStorage requires a "baseDir" configuration');
    }
    this.baseDir = path.resolve(baseDir);
    this._ensureDirSync(this.baseDir);
  }

  /**
   * Ensures base directory exists synchronously on initialization
   */
  _ensureDirSync(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Prevents directory traversal attacks by securing the filename
   */
  _resolvePath(fileKey) {
    const safeName = path.basename(fileKey);
    return path.join(this.baseDir, safeName);
  }

  _getMetaPath(fileKey) {
    const safeName = path.basename(fileKey);
    return path.join(this.baseDir, `${safeName}.meta.json`);
  }

  /**
   * Saves an export file to the local filesystem
   * Supports Stream, Buffer, or String
   */
  async saveExport(fileKey, content, metadata = {}) {
    const filePath = this._resolvePath(fileKey);
    const metaPath = this._getMetaPath(fileKey);
    const safeFilename = path.basename(filePath);

    // If content is a readable stream, pipe to write stream
    if (content && (typeof content.pipe === 'function' || isReadable(content))) {
      const writeStream = fs.createWriteStream(filePath);
      await pipeline(content, writeStream);
    } else {
      // Buffer or string
      await fsPromises.writeFile(filePath, content);
    }

    const stat = await fsPromises.stat(filePath);

    const record = {
      fileKey: safeFilename,
      filename: safeFilename,
      sizeBytes: stat.size,
      mimeType: 'text/csv',
      createdAt: stat.birthtime || stat.mtime,
      metadata: {
        ...metadata,
        rowCount: metadata.rowCount ?? null,
        dataset: metadata.dataset ?? null
      }
    };

    // Save metadata sidecar
    await fsPromises.writeFile(metaPath, JSON.stringify(record, null, 2), 'utf-8');

    return record;
  }

  /**
   * Returns a readable stream for file download
   */
  async getReadStream(fileKey) {
    const filePath = this._resolvePath(fileKey);

    const exists = await this.fileExists(fileKey);
    if (!exists) {
      throw new Error(`Export file "${fileKey}" not found`);
    }

    return fs.createReadStream(filePath);
  }

  /**
   * Retrieves file metadata
   */
  async getMetadata(fileKey) {
    const filePath = this._resolvePath(fileKey);
    const metaPath = this._getMetaPath(fileKey);

    const exists = await this.fileExists(fileKey);
    if (!exists) {
      throw new Error(`Export file "${fileKey}" not found`);
    }

    const stat = await fsPromises.stat(filePath);

    // Check if sidecar metadata exists
    let extraMeta = {};
    if (fs.existsSync(metaPath)) {
      try {
        const raw = await fsPromises.readFile(metaPath, 'utf-8');
        const parsed = JSON.parse(raw);
        extraMeta = parsed.metadata || {};
      } catch {
        // Fallback to stat only if meta is corrupted
      }
    }

    return {
      fileKey: path.basename(filePath),
      filename: path.basename(filePath),
      sizeBytes: stat.size,
      mimeType: 'text/csv',
      createdAt: stat.birthtime || stat.mtime,
      metadata: extraMeta
    };
  }

  /**
   * Checks if an export exists
   */
  async fileExists(fileKey) {
    const filePath = this._resolvePath(fileKey);
    try {
      await fsPromises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Lists all CSV files in storage with their metadata
   */
  async listExports() {
    const entries = await fsPromises.readdir(this.baseDir);
    const csvFiles = entries.filter(f => f.endsWith('.csv') && !f.endsWith('.meta.json'));

    const list = [];
    for (const file of csvFiles) {
      try {
        const meta = await this.getMetadata(file);
        list.push(meta);
      } catch {
        // Skip unreadable files
      }
    }

    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Deletes an export file and its metadata sidecar
   */
  async deleteExport(fileKey) {
    const filePath = this._resolvePath(fileKey);
    const metaPath = this._getMetaPath(fileKey);

    if (fs.existsSync(filePath)) {
      await fsPromises.unlink(filePath);
    }
    if (fs.existsSync(metaPath)) {
      await fsPromises.unlink(metaPath);
    }
  }
}
