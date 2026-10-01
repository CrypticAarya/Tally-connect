import crypto from 'crypto';
import { pool } from '../db/mysql.js';

export class ApiUsageMetrics {
  static totalRequests = 0;
  static requestsByEndpoint = new Map();
  static requestsByApp = new Map();
  static statusCodes = new Map();

  static record({ appId, endpoint, method, statusCode, durationMs }) {
    this.totalRequests++;

    // Record by endpoint
    const endpointKey = `${method} ${endpoint}`;
    this.requestsByEndpoint.set(endpointKey, (this.requestsByEndpoint.get(endpointKey) || 0) + 1);

    // Record by app
    if (appId) {
      this.requestsByApp.set(appId, (this.requestsByApp.get(appId) || 0) + 1);
    }

    // Record status code
    this.statusCodes.set(statusCode, (this.statusCodes.get(statusCode) || 0) + 1);
  }

  static getStats() {
    return {
      totalRequests: this.totalRequests,
      statusCodes: Object.fromEntries(this.statusCodes.entries()),
      topEndpoints: Object.fromEntries(
        Array.from(this.requestsByEndpoint.entries()).slice(0, 10)
      )
    };
  }
}

/**
 * Middleware: Tracks API request usage in memory and persists to MySQL api_usage_logs
 */
export function apiUsageTracker(req, res, next) {
  const startTime = Date.now();

  res.on('finish', async () => {
    const durationMs = Date.now() - startTime;
    const appId = req.saasApp?.id || req.headers['x-app-id'] || null;
    const endpoint = req.originalUrl || req.url;
    const method = req.method;
    const statusCode = res.statusCode;
    const ip = (typeof req.app?.get === 'function' ? req.ip : null) || req.socket?.remoteAddress || null;

    // Record in-memory aggregated metrics
    ApiUsageMetrics.record({
      appId,
      endpoint,
      method,
      statusCode,
      durationMs
    });

    // Asynchronously log to MySQL api_usage_logs
    try {
      const id = `use_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
      await pool.query(
        `INSERT INTO api_usage_logs (id, app_id, endpoint, method, response_status, duration_ms, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [id, appId, endpoint, method, statusCode, durationMs, ip]
      );
    } catch {
      // Non-blocking for response lifecycle
    }
  });

  next();
}
