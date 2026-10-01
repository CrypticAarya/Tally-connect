import crypto from 'crypto';
import { SaasRepository } from '../db/saasRepository.js';

/**
 * Webhook Delivery & Event Notification Engine
 * Dispatches real-time events to SaaS application webhook endpoints with automatic retries,
 * backoff scheduling, and failed queue tracking.
 */
export class WebhookService {
  /**
   * Supported webhook events
   */
  static EVENTS = {
    SYNC_COMPLETED: 'sync.completed',
    SYNC_FAILED: 'sync.failed',
    CONNECTION_OFFLINE: 'connection.offline'
  };

  /**
   * Default retry schedule in milliseconds for attempts 1, 2, and 3
   */
  static RETRY_SCHEDULE_MS = [500, 1200, 2500];
  static MAX_RETRIES = 3;

  /**
   * In-memory dead-letter / failed webhook queue
   */
  static failedQueue = [];

  /**
   * Delivers an event notification with automatic retries on failure
   * @param {string} appId - SaaS Application ID
   * @param {string} event - Event name
   * @param {Object} data - Event payload
   * @param {Object} [options]
   * @param {number} [options.maxRetries=3]
   * @returns {Promise<Object>}
   */
  static async deliver(appId, event, data = {}, options = {}) {
    if (!appId) {
      return { delivered: false, error: 'Missing app_id' };
    }

    const maxRetries = options.maxRetries !== undefined ? options.maxRetries : this.MAX_RETRIES;
    const retrySchedule = options.retrySchedule || this.RETRY_SCHEDULE_MS;

    try {
      const app = await SaasRepository.getAppById(appId);
      if (!app || !app.webhook_url) {
        return { delivered: false, reason: 'No webhook_url configured for application' };
      }

      const targetUrl = app.webhook_url;
      const envelope = {
        event,
        app_id: appId,
        timestamp: new Date().toISOString(),
        data
      };

      const payloadString = JSON.stringify(envelope);
      const secret = app.api_secret || 'tc_secret';
      const signature = crypto.createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex');

      let attempt = 0;
      let statusCode = null;
      let responseBody = null;
      let success = false;
      let lastError = null;

      while (attempt < maxRetries && !success) {
        attempt++;

        try {
          const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tally-Event': event,
              'X-Tally-Signature': `sha256=${signature}`,
              'X-Tally-Attempt': String(attempt),
              'User-Agent': 'TallyConnect-Webhook/1.0'
            },
            body: payloadString,
            signal: AbortSignal.timeout(4000)
          });

          statusCode = response.status;
          success = response.ok;
          responseBody = await response.text().catch(() => '');
          lastError = success ? null : `HTTP status ${statusCode}`;
        } catch (reqErr) {
          lastError = reqErr.message;
          responseBody = `Network error: ${reqErr.message}`;
          success = false;
        }

        // If not successful and we have retries remaining, wait according to retry schedule
        if (!success && attempt < maxRetries) {
          const delayMs = retrySchedule[attempt - 1] || 1000;
          await new Promise(r => setTimeout(r, delayMs));
        }
      }

      // Persist delivery record to MySQL webhook_logs
      await SaasRepository.saveWebhookLog({
        appId,
        event,
        payload: envelope,
        targetUrl,
        statusCode,
        responseBody,
        success,
        attempts: attempt
      });

      // If permanently failed, record in dead-letter failedQueue
      if (!success) {
        this.failedQueue.push({
          id: `wh_fail_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          appId,
          event,
          targetUrl,
          payload: envelope,
          attempts: attempt,
          error: lastError,
          failedAt: new Date().toISOString()
        });
      }

      return {
        delivered: true,
        success,
        attempts: attempt,
        statusCode,
        targetUrl,
        error: lastError
      };
    } catch (err) {
      console.error(`[WebhookService] Delivery exception for ${event} to app ${appId}:`, err);
      return { delivered: false, error: err.message };
    }
  }

  /**
   * Non-blocking trigger wrapper
   */
  static trigger(appId, event, data = {}) {
    this.deliver(appId, event, data).catch(err => {
      console.warn(`[WebhookService] Non-blocking dispatch notice: ${err.message}`);
    });
  }

  /**
   * Helper: Resolves app_id from connection_id and delivers webhook
   */
  static async deliverForConnection(connectionId, event, data = {}) {
    if (!connectionId) return;
    try {
      const conn = await SaasRepository.getConnectionById(connectionId);
      if (conn && conn.saas_app_id) {
        return await this.deliver(conn.saas_app_id, event, {
          connection_id: connectionId,
          company_name: conn.company_name,
          ...data
        });
      }
    } catch (err) {
      console.warn(`[WebhookService] Failed to deliver for connection ${connectionId}:`, err.message);
    }
  }

  /**
   * Returns current failed webhook queue
   */
  static getFailedQueue() {
    return [...this.failedQueue];
  }

  /**
   * Retries all items in the failed webhook queue
   */
  static async retryFailedQueue() {
    const queueToProcess = [...this.failedQueue];
    this.failedQueue = [];
    const results = [];

    for (const item of queueToProcess) {
      const res = await this.deliver(item.appId, item.event, item.payload.data, { maxRetries: 2 });
      results.push({ id: item.id, ...res });
    }

    return results;
  }
}
