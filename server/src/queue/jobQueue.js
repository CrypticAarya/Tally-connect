import crypto from 'crypto';
import { pool } from '../db/mysql.js';
import { config } from '../config.js';

/**
 * Background Job Queue System
 * 
 * Supports full lifecycle:
 * sync request -> queue -> worker -> agent task
 * States: PENDING -> PROCESSING -> COMPLETED | FAILED
 * Retries: Automatic retries with retry_count tracking
 */
export class JobQueue {
  static isRunning = false;
  static workerTimer = null;
  static activeWorkers = 0;
  static maxConcurrency = config.queue?.concurrency || 5;
  static pollIntervalMs = config.queue?.pollIntervalMs || 3000;
  static maxRetries = config.queue?.maxRetries || 3;
  static taskHandlers = new Map();

  /**
   * Registers a task handler function for a specific entity or job type
   */
  static registerHandler(entityType, handlerFn) {
    this.taskHandlers.set(entityType.toLowerCase(), handlerFn);
  }

  /**
   * Enqueues a new sync job
   * @param {Object} params
   * @param {string} params.connectionId
   * @param {string} params.entityType
   * @param {number} [params.maxRetries=3]
   * @returns {Promise<Object>} Created job
   */
  static async enqueue({ connectionId, entityType, maxRetries = 3 }) {
    if (!connectionId || !entityType) {
      throw new Error('connectionId and entityType are required to enqueue a job');
    }

    const id = `job_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const cleanType = String(entityType).toLowerCase();

    await pool.query(
      `INSERT INTO sync_jobs (id, connection_id, entity_type, status, retry_count, max_retries, created_at)
       VALUES (?, ?, ?, 'PENDING', 0, ?, CURRENT_TIMESTAMP)`,
      [id, connectionId, cleanType, maxRetries || this.maxRetries]
    );

    return {
      id,
      connection_id: connectionId,
      entity_type: cleanType,
      status: 'PENDING',
      retry_count: 0,
      max_retries: maxRetries || this.maxRetries,
      created_at: new Date()
    };
  }

  /**
   * Atomically fetches and marks the next pending job as PROCESSING
   * @returns {Promise<Object|null>}
   */
  static async claimNextJob() {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [rows] = await connection.query(
        `SELECT id, connection_id, entity_type, status, retry_count, max_retries, created_at
         FROM sync_jobs
         WHERE status = 'PENDING'
         ORDER BY created_at ASC
         LIMIT 1
         FOR UPDATE`
      );

      if (rows.length === 0) {
        await connection.commit();
        return null;
      }

      const job = rows[0];
      await connection.query(
        `UPDATE sync_jobs
         SET status = 'PROCESSING'
         WHERE id = ?`,
        [job.id]
      );

      await connection.commit();
      return {
        ...job,
        status: 'PROCESSING'
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Marks a job as COMPLETED
   * @param {string} jobId
   */
  static async completeJob(jobId) {
    await pool.query(
      `UPDATE sync_jobs
       SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [jobId]
    );
    return { id: jobId, status: 'COMPLETED' };
  }

  /**
   * Records a job failure with automatic retry logic
   * If retry_count < max_retries, transitions back to PENDING.
   * Otherwise transitions to FAILED.
   * @param {string} jobId
   * @param {string|Error} error
   */
  static async failJob(jobId, error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    const [rows] = await pool.query(
      `SELECT retry_count, max_retries FROM sync_jobs WHERE id = ? LIMIT 1`,
      [jobId]
    );

    if (rows.length === 0) return null;

    const currentRetry = (rows[0].retry_count || 0) + 1;
    const maxRetries = rows[0].max_retries || this.maxRetries;

    if (currentRetry < maxRetries) {
      // Re-queue as PENDING with incremented retry count
      await pool.query(
        `UPDATE sync_jobs
         SET status = 'PENDING', retry_count = ?, error_message = ?
         WHERE id = ?`,
        [currentRetry, errorMsg, jobId]
      );
      return { id: jobId, status: 'PENDING', retry_count: currentRetry, re_queued: true };
    } else {
      // Mark permanently as FAILED
      await pool.query(
        `UPDATE sync_jobs
         SET status = 'FAILED', retry_count = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [currentRetry, errorMsg, jobId]
      );
      return { id: jobId, status: 'FAILED', retry_count: currentRetry, re_queued: false };
    }
  }

  /**
   * Retrieves summary statistics of the queue
   */
  static async getQueueStats() {
    const [rows] = await pool.query(
      `SELECT status, COUNT(*) AS count
       FROM sync_jobs
       GROUP BY status`
    );

    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      total: 0
    };

    for (const r of rows) {
      const key = String(r.status).toLowerCase();
      if (stats[key] !== undefined) {
        stats[key] = Number(r.count);
      }
      stats.total += Number(r.count);
    }

    return stats;
  }

  /**
   * Starts the worker processing loop
   */
  static startWorker() {
    if (this.isRunning) return;
    this.isRunning = true;

    this.workerTimer = setInterval(async () => {
      if (this.activeWorkers >= this.maxConcurrency) return;

      try {
        const job = await this.claimNextJob();
        if (!job) return;

        this.activeWorkers++;
        this.processJob(job).finally(() => {
          this.activeWorkers = Math.max(0, this.activeWorkers - 1);
        });
      } catch (err) {
        console.error('[JobQueue Worker Error]:', err.message);
      }
    }, this.pollIntervalMs);
  }

  /**
   * Processes a single job via registered task handlers
   */
  static async processJob(job) {
    try {
      const handler = this.taskHandlers.get(job.entity_type);
      if (handler) {
        await handler(job);
        await this.completeJob(job.id);
      } else {
        // If no explicit handler registered, leave job claimed for agent pick-up or mark ready
      }
    } catch (err) {
      await this.failJob(job.id, err);
    }
  }

  /**
   * Stops the worker loop
   */
  static stopWorker() {
    if (this.workerTimer) {
      clearInterval(this.workerTimer);
      this.workerTimer = null;
    }
    this.isRunning = false;
  }
}
