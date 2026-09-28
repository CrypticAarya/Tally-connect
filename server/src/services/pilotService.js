import { Repository } from '../db/repository.js';
import { query } from '../db/index.js';

export const WORKFLOW_STAGES = {
  DAY_0_INSTALLATION: {
    key: 'DAY_0_INSTALLATION',
    name: 'Day 0: Installation',
    targetDays: 0,
    desc: 'Connector agent provisioned and installed as Windows background service'
  },
  DAY_1_FIRST_EXPORT: {
    key: 'DAY_1_FIRST_EXPORT',
    name: 'Day 1: First Export',
    targetDays: 1,
    desc: 'First successful dataset extraction and CSV validation from TallyPrime'
  },
  WEEK_1_REVIEW_USAGE: {
    key: 'WEEK_1_REVIEW_USAGE',
    name: 'Week 1: Review Usage',
    targetDays: 7,
    desc: 'Multi-dataset sync stability review, scheduled exports, and volume audit'
  },
  WEEK_2_COLLECT_FEEDBACK: {
    key: 'WEEK_2_COLLECT_FEEDBACK',
    name: 'Week 2: Collect Feedback',
    targetDays: 14,
    desc: 'Structured pilot interview, issue resolution, feature requests, and graduation'
  }
};

export const PilotService = {
  /**
   * Calculates real-time pilot operational metrics
   */
  async getPilotMetrics() {
    const pilots = await Repository.listPilotCustomers();
    const totalPilots = pilots.length;

    // 1. Activation rate: pilots with online connector OR completed first export
    const activatedCount = pilots.filter(
      p => p.connectorLiveStatus === 'ONLINE' || Boolean(p.firstExportAt) || p.completedExportsCount > 0
    ).length;
    const activationRate = totalPilots > 0 ? Math.round((activatedCount / totalPilots) * 100) : 0;

    // 2. Time to first export (in minutes)
    const exportedPilots = pilots.filter(p => p.firstExportAt && p.createdAt);
    let avgTimeToFirstExportMinutes = 0;
    if (exportedPilots.length > 0) {
      const totalMinutes = exportedPilots.reduce((acc, p) => {
        const diffMs = new Date(p.firstExportAt).getTime() - new Date(p.createdAt).getTime();
        return acc + Math.max(0, Math.round(diffMs / 60000));
      }, 0);
      avgTimeToFirstExportMinutes = Number((totalMinutes / exportedPilots.length).toFixed(1));
    }

    // 3. Overall export success rate
    const exportsRes = await query(`
      SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed,
        COUNT(*) FILTER (WHERE status = 'FAILED') AS failed
      FROM "exportJobs"
    `);
    const totalExports = parseInt(exportsRes.rows[0]?.total || '0', 10);
    const completedExports = parseInt(exportsRes.rows[0]?.completed || '0', 10);
    const failedExports = parseInt(exportsRes.rows[0]?.failed || '0', 10);
    const exportSuccessRate = totalExports > 0 ? Number(((completedExports / totalExports) * 100).toFixed(1)) : 100.0;

    // 4. Common failure reasons
    const failuresRes = await query(`
      SELECT 
        COALESCE(error, 'Unknown execution error') AS reason,
        COUNT(*) AS occurrences
      FROM "exportJobs"
      WHERE status = 'FAILED'
      GROUP BY reason
      ORDER BY occurrences DESC
      LIMIT 5
    `);
    const commonFailureReasons = failuresRes.rows.map(r => ({
      reason: r.reason,
      count: parseInt(r.occurrences, 10)
    }));

    // 5. Stage Breakdown
    const stageCounts = {
      DAY_0_INSTALLATION: 0,
      DAY_1_FIRST_EXPORT: 0,
      WEEK_1_REVIEW_USAGE: 0,
      WEEK_2_COLLECT_FEEDBACK: 0
    };
    for (const p of pilots) {
      if (stageCounts[p.stage] !== undefined) {
        stageCounts[p.stage]++;
      }
    }

    return {
      totalPilots,
      activatedCount,
      activationRate,
      avgTimeToFirstExportMinutes,
      totalExports,
      completedExports,
      failedExports,
      exportSuccessRate,
      commonFailureReasons,
      stageCounts,
      workflowStages: WORKFLOW_STAGES
    };
  },

  /**
   * Compiles the Support Cockpit data
   */
  async getSupportDashboard() {
    const pilots = await Repository.listPilotCustomers();
    const metrics = await this.getPilotMetrics();

    // Active pilots: Online or active within last 24h
    const activePilots = pilots.filter(p => p.connectorLiveStatus === 'ONLINE');

    // Offline connectors
    const offlineConnectorsRes = await query(`
      SELECT c.*, t."companyName"
      FROM connectors c
      LEFT JOIN tenants t ON t.id = c."tenantId"
      WHERE c.status = 'OFFLINE' OR c."lastHeartbeat" < NOW() - INTERVAL '90 seconds'
      ORDER BY c."lastHeartbeat" DESC NULLS LAST
    `);

    // Failed exports
    const failedExportsRes = await query(`
      SELECT j.*, t."companyName"
      FROM "exportJobs" j
      LEFT JOIN tenants t ON t.id = j."tenantId"
      WHERE j.status = 'FAILED'
      ORDER BY j."createdAt" DESC
      LIMIT 20
    `);

    // Recent errors from connectors & export jobs
    const recentErrors = [
      ...failedExportsRes.rows.map(j => ({
        source: 'EXPORT_ENGINE',
        target: `${j.companyName || j.tenantId} (${j.dataset})`,
        error: j.error || 'Job failed without explicit error trace',
        timestamp: j.completedAt || j.createdAt
      })),
      ...offlineConnectorsRes.rows.filter(c => c.lastError).map(c => ({
        source: 'CONNECTOR_AGENT',
        target: `${c.companyName || c.tenantId} (${c.connectorId})`,
        error: c.lastError,
        timestamp: c.lastHeartbeat || c.createdAt
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 15);

    // Recent feedback / open issues
    const openIssues = await Repository.listFeedback({ status: 'OPEN', limit: 10 });

    return {
      summary: {
        totalPilots: pilots.length,
        activePilotsCount: activePilots.length,
        offlineConnectorsCount: offlineConnectorsRes.rows.length,
        failedExportsCount: failedExportsRes.rows.length,
        openIssuesCount: openIssues.length
      },
      metrics,
      activePilots,
      offlineConnectors: offlineConnectorsRes.rows,
      failedExports: failedExportsRes.rows,
      recentErrors,
      openIssues
    };
  }
};
