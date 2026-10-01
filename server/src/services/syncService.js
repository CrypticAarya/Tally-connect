import { JsonTransformer } from '../engine/jsonTransformer.js';

/**
 * Service managing synchronization tasks and in-memory entity caching
 */
export class SyncService {
  /**
   * In-memory cache for fast JSON API responses (connectionId -> entityType -> { payload, count, syncedAt })
   */
  static entityCache = new Map();

  /**
   * Pending task queues for agents (connectionId -> Array<Task>)
   */
  static pendingTasks = new Map();

  /**
   * Enqueues a sync task for an agent
   * @param {Object} task
   * @param {string} task.connectionId
   * @param {Array<string>} task.datasets
   * @param {string} [task.requestedBy='SAAS_API']
   * @returns {Object} Queued task record
   */
  static queueSyncTask({ connectionId, datasets, requestedBy = 'SAAS_API' }) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const task = {
      id: taskId,
      connectionId,
      datasets,
      requestedBy,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    if (!this.pendingTasks.has(connectionId)) {
      this.pendingTasks.set(connectionId, []);
    }
    this.pendingTasks.get(connectionId).push(task);

    return task;
  }

  /**
   * Retrieves pending tasks for a connection
   */
  static getPendingTasks(connectionId) {
    return this.pendingTasks.get(connectionId) || [];
  }

  /**
   * Saves synchronized entity payload to the cache
   * @param {string} connectionId
   * @param {string} entityType - CUSTOMERS, SALES, INVENTORY, LEDGERS, TRIAL_BALANCE
   * @param {Array<Object>} rawData
   */
  static cacheEntity(connectionId, entityType, rawData) {
    const normalizedData = JsonTransformer.transform(entityType, rawData);
    const cacheKey = `${connectionId}:${String(entityType).toUpperCase()}`;

    const record = {
      connectionId,
      entityType: String(entityType).toUpperCase(),
      data: normalizedData,
      count: normalizedData.length,
      syncedAt: new Date().toISOString()
    };

    this.entityCache.set(cacheKey, record);
    return record;
  }

  /**
   * Retrieves cached entity payload for SaaS API responses
   */
  static getCachedEntity(connectionId, entityType) {
    const cacheKey = `${connectionId}:${String(entityType).toUpperCase()}`;
    return this.entityCache.get(cacheKey) || null;
  }
}
