import express from 'express';
import { pool } from '../../db/mysql.js';
import { ApiUsageMetrics } from '../../middleware/apiUsageTracker.js';

const router = express.Router();

/**
 * GET /api/admin/stats (and /admin/stats)
 * Platform-wide telemetry & operational metrics
 */
router.get('/stats', async (req, res) => {
  try {
    // 1. Total SaaS apps
    const [[{ total_apps }]] = await pool.query('SELECT COUNT(*) AS total_apps FROM saas_apps');

    // 2. Total connections
    const [[{ total_connections }]] = await pool.query('SELECT COUNT(*) AS total_connections FROM connections');

    // 3. Online agents
    const [[{ online_agents }]] = await pool.query("SELECT COUNT(*) AS online_agents FROM agents WHERE status = 'ONLINE'");

    // 4. Failed syncs
    const [[{ failed_syncs }]] = await pool.query("SELECT COUNT(*) AS failed_syncs FROM sync_jobs WHERE status IN ('FAILED', 'ERROR')");

    // 5. Total API requests
    let dbRequests = 0;
    try {
      const [[{ total_logs }]] = await pool.query('SELECT COUNT(*) AS total_logs FROM api_usage_logs');
      dbRequests = Number(total_logs) || 0;
    } catch {}

    const totalApiRequests = Math.max(dbRequests, ApiUsageMetrics.totalRequests);

    return res.json({
      success: true,
      total_saas_apps: Number(total_apps) || 0,
      totalSaasApps: Number(total_apps) || 0,
      total_connections: Number(total_connections) || 0,
      totalConnections: Number(total_connections) || 0,
      online_agents: Number(online_agents) || 0,
      onlineAgents: Number(online_agents) || 0,
      failed_syncs: Number(failed_syncs) || 0,
      failedSyncs: Number(failed_syncs) || 0,
      api_requests: totalApiRequests,
      apiRequests: totalApiRequests
    });
  } catch (err) {
    console.error('[Admin Stats Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/sync-health (and /admin/sync-health)
 * Data pipeline health, success rates, failure analysis, and timing
 */
router.get('/sync-health', async (req, res) => {
  try {
    // 1. Calculate success vs failed counts
    const [statusRows] = await pool.query(
      `SELECT status, COUNT(*) AS count
       FROM sync_jobs
       GROUP BY status`
    );

    let completed = 0;
    let failed = 0;
    let pending = 0;
    let processing = 0;

    for (const r of statusRows) {
      const st = String(r.status).toUpperCase();
      const cnt = Number(r.count);
      if (st === 'COMPLETED') completed += cnt;
      else if (st === 'FAILED' || st === 'ERROR') failed += cnt;
      else if (st === 'PENDING') pending += cnt;
      else if (st === 'PROCESSING') processing += cnt;
    }

    const totalFinished = completed + failed;
    const successRate = totalFinished > 0
      ? Number(((completed / totalFinished) * 100).toFixed(1))
      : 100.0;

    // 2. Failure reasons breakdown
    const [failureRows] = await pool.query(
      `SELECT COALESCE(error_message, 'SYNC_FAILED') AS reason, COUNT(*) AS count
       FROM sync_jobs
       WHERE status IN ('FAILED', 'ERROR')
       GROUP BY reason
       LIMIT 10`
    );

    const failureReasons = failureRows.map(r => ({
      reason: r.reason,
      count: Number(r.count)
    }));

    // 3. Average sync execution time (in milliseconds or seconds)
    const [timingRows] = await pool.query(
      `SELECT AVG(TIMESTAMPDIFF(SECOND, created_at, completed_at)) AS avg_seconds
       FROM sync_jobs
       WHERE status = 'COMPLETED' AND completed_at IS NOT NULL`
    );

    const avgSeconds = timingRows[0]?.avg_seconds != null ? Number(timingRows[0].avg_seconds) : 0.8;
    const avgSyncTimeMs = Math.round(avgSeconds * 1000);

    return res.json({
      success: true,
      success_rate: successRate,
      successRate,
      failure_reasons: failureReasons,
      failureReasons,
      average_sync_time: avgSyncTimeMs,
      averageSyncTime: avgSyncTimeMs,
      total_completed: completed,
      total_failed: failed,
      total_in_flight: pending + processing
    });
  } catch (err) {
    console.error('[Admin Sync Health Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
