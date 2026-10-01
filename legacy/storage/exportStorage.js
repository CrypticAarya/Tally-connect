/**
 * Abstract Base Class: ExportStorage
 * 
 * Defines the contract for storing and retrieving exported datasets.
 * Any storage implementation (Local filesystem, S3, GCS, Azure Blob)
 * must implement these methods.
 */
export class ExportStorage {
  /**
   * Saves an export file (accepts a Stream, Buffer, or String)
   * @param {string} fileKey - Unique identifier/filename for the file
   * @param {ReadableStream|Buffer|string} content - Data to store
   * @param {Object} [metadata={}] - Optional metadata (dataset, rowCount, etc.)
   * @returns {Promise<StorageResult>}
   */
  async saveExport(fileKey, content, metadata = {}) {
    throw new Error('Method "saveExport" must be implemented by concrete subclass');
  }

  /**
   * Retrieves a readable stream for downloading the export
   * @param {string} fileKey - File identifier/filename
   * @returns {Promise<NodeJS.ReadableStream>}
   */
  async getReadStream(fileKey) {
    throw new Error('Method "getReadStream" must be implemented by concrete subclass');
  }

  /**
   * Retrieves file metadata
   * @param {string} fileKey - File identifier/filename
   * @returns {Promise<StorageMetadata>}
   */
  async getMetadata(fileKey) {
    throw new Error('Method "getMetadata" must be implemented by concrete subclass');
  }

  /**
   * Checks whether an export file exists
   * @param {string} fileKey - File identifier/filename
   * @returns {Promise<boolean>}
   */
  async fileExists(fileKey) {
    throw new Error('Method "fileExists" must be implemented by concrete subclass');
  }

  /**
   * Lists all stored exports
   * @returns {Promise<Array<StorageMetadata>>}
   */
  async listExports() {
    throw new Error('Method "listExports" must be implemented by concrete subclass');
  }

  /**
   * Deletes an export file
   * @param {string} fileKey - File identifier/filename
   * @returns {Promise<void>}
   */
  async deleteExport(fileKey) {
    throw new Error('Method "deleteExport" must be implemented by concrete subclass');
  }
}
