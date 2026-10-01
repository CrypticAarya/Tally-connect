import { LocalExportStorage } from './localExportStorage.js';
import { ExportStorage } from './exportStorage.js';
import { config } from '../config.js';

// Instantiate the active storage driver using config.
// In the future, this factory can switch between Local, S3, or GCS based on config.storage.driver.
export const exportStorage = new LocalExportStorage({
  baseDir: config.storage.exportsDir
});

export { ExportStorage, LocalExportStorage };
