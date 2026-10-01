/**
 * Database Module Interface for Tally Connect
 * Primary Active Database: MySQL 8.0+
 */

import {
  pool as mysqlPool,
  query,
  initMySqlDb,
  generateApiKey,
  generateApiSecret,
  hashSecret,
  hashPassword,
  verifyPassword
} from './mysql.js';

export {
  mysqlPool,
  mysqlPool as pool,
  query,
  initMySqlDb,
  initMySqlDb as initDb,
  generateApiKey,
  generateApiSecret,
  hashSecret,
  hashPassword,
  verifyPassword
};

export { SaasRepository } from './saasRepository.js';

export default {
  pool: mysqlPool,
  query,
  initDb: initMySqlDb,
  initMySqlDb
};
