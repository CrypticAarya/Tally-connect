import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

/**
 * Base Abstract Storage Provider
 */
export class BaseStorageProvider {
  async upload(key, content, metadata = {}) {
    throw new Error('upload() must be implemented by provider');
  }

  async download(key) {
    throw new Error('download() must be implemented by provider');
  }

  async exists(key) {
    throw new Error('exists() must be implemented by provider');
  }

  async delete(key) {
    throw new Error('delete() must be implemented by provider');
  }

  getUrl(key) {
    throw new Error('getUrl() must be implemented by provider');
  }
}

/**
 * Local Filesystem Storage Provider (Development / On-Premise)
 */
export class LocalStorageProvider extends BaseStorageProvider {
  constructor(options = config.storage?.exportsDir) {
    super();
    const rawDir = typeof options === 'string' ? options : (options?.baseDir || config.storage?.exportsDir || 'server/storage/exports');
    this.name = 'local';
    this.baseDir = path.resolve(rawDir);
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async putObject(key, content, metadata = {}) {
    return this.upload(key, content, metadata);
  }

  async getObject(key) {
    const buf = await this.download(key);
    return buf.toString('utf8');
  }

  async objectExists(key) {
    return this.exists(key);
  }

  async deleteObject(key) {
    return this.delete(key);
  }

  getFilePath(key) {
    const safeKey = key.replace(/[^a-zA-Z0-9_.\-\/]/g, '_');
    return path.join(this.baseDir, safeKey);
  }

  async upload(key, content, metadata = {}) {
    const filePath = this.getFilePath(key);
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const buffer = Buffer.isBuffer(content)
      ? content
      : (typeof content === 'string' ? Buffer.from(content) : Buffer.from(JSON.stringify(content)));

    fs.writeFileSync(filePath, buffer);
    return {
      provider: 'local',
      key,
      path: filePath,
      sizeBytes: buffer.length,
      contentType: metadata.contentType || 'application/octet-stream'
    };
  }

  async download(key) {
    const filePath = this.getFilePath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Object not found in local storage: ${key}`);
    }
    return fs.readFileSync(filePath);
  }

  async exists(key) {
    return fs.existsSync(this.getFilePath(key));
  }

  async delete(key) {
    const filePath = this.getFilePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  getUrl(key) {
    return `/api/storage/files/${encodeURIComponent(key)}`;
  }
}

/**
 * Cloud Object Storage Provider (S3 / GCS / Cloud Compatible)
 */
export class CloudStorageProvider extends BaseStorageProvider {
  constructor({ bucket = config.storage.bucket, region = 'ap-south-1' } = {}) {
    super();
    this.bucket = bucket;
    this.region = region;
    this.inMemoryMock = new Map();
  }

  async upload(key, content, metadata = {}) {
    const buffer = Buffer.isBuffer(content)
      ? content
      : (typeof content === 'string' ? Buffer.from(content) : Buffer.from(JSON.stringify(content)));

    this.inMemoryMock.set(key, {
      buffer,
      metadata: {
        contentType: metadata.contentType || 'application/json',
        sizeBytes: buffer.length,
        updatedAt: new Date().toISOString()
      }
    });

    return {
      provider: 's3',
      bucket: this.bucket,
      key,
      url: `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`,
      sizeBytes: buffer.length
    };
  }

  async putObject(key, content, metadata = {}) {
    return this.upload(key, content, metadata);
  }

  async getObject(key) {
    const buf = await this.download(key);
    return buf.toString('utf8');
  }

  async objectExists(key) {
    return this.exists(key);
  }

  async deleteObject(key) {
    return this.delete(key);
  }

  async download(key) {
    const item = this.inMemoryMock.get(key);
    if (!item) {
      throw new Error(`Object not found in S3 bucket: ${key}`);
    }
    return item.buffer;
  }

  async exists(key) {
    return this.inMemoryMock.has(key);
  }

  async delete(key) {
    return this.inMemoryMock.delete(key);
  }

  getUrl(key) {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}

/**
 * Storage Service Factory
 */
export class StorageService {
  static instance = null;

  static getInstance() {
    return {
      provider: this.getProvider()
    };
  }

  static getProvider() {
    if (!this.instance) {
      const providerType = (config.storage?.provider || 'local').toLowerCase();
      if (providerType === 's3' || providerType === 'gcs') {
        this.instance = new CloudStorageProvider();
      } else {
        this.instance = new LocalStorageProvider();
      }
    }
    return this.instance;
  }

  static async upload(key, content, metadata) {
    return this.getProvider().upload(key, content, metadata);
  }

  static async download(key) {
    return this.getProvider().download(key);
  }

  static async exists(key) {
    return this.getProvider().exists(key);
  }

  static async delete(key) {
    return this.getProvider().delete(key);
  }

  static getUrl(key) {
    return this.getProvider().getUrl(key);
  }
}
