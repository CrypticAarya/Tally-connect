import { logger } from './logger.js';

export class HeartbeatService {
  constructor({ tallyClient, cloudClient, config, machineName, onPulse }) {
    this.tallyClient = tallyClient;
    this.cloudClient = cloudClient;
    this.config = config;
    this.machineName = machineName;
    this.onPulse = onPulse || (() => {});

    this.intervalSeconds = config.heartbeatIntervalSeconds || 30;
    this.timer = null;
    this.pulseCount = 0;
    this.lastPayload = null;
    this.isRunning = false;
  }

  /**
   * Performs a single heartbeat cycle:
   * Probes TallyPrime -> Builds payload -> Sends to Cloud API
   */
  async pulse() {
    this.pulseCount += 1;
    const tallyInfo = await this.tallyClient.checkStatus();

    const payload = {
      connectorId: this.config.connectorId,
      connectionId: this.config.connectionId,
      agentId: this.config.agentId,
      machineName: this.machineName,
      tallyStatus: tallyInfo.online ? 'ONLINE' : 'OFFLINE',
      activeCompany: tallyInfo.activeCompany || this.config.companyName || 'None',
      port: tallyInfo.port || 9000,
      agentVersion: this.config.agentVersion || '1.0.0-beta',
      timestamp: new Date().toISOString()
    };

    if (!tallyInfo.online) {
      logger.warn(`Tally connection issue: TallyPrime not responding on port ${payload.port} (${tallyInfo.error || 'Connection refused'})`);
    }

    this.lastPayload = payload;

    const result = await this.cloudClient.sendHeartbeat(payload);

    if (result.success) {
      logger.info(
        `[Heartbeat #${this.pulseCount}] Sent to cloud -> ` +
        `Tally: ${payload.tallyStatus} | Company: "${payload.activeCompany}" | Latency: ${tallyInfo.latencyMs}ms`
      );
    } else {
      logger.warn(`Heartbeat failure: ${result.error}`);
    }

    this.onPulse({ payload, result, tallyInfo });
    return { payload, result, tallyInfo };
  }

  /**
   * Starts the recurring heartbeat interval
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Send immediate first pulse
    this.pulse().catch(err => {
      logger.warn(`[Heartbeat] Initial pulse warning: ${err.message}`);
    });

    // Schedule recurring pulses
    this.timer = setInterval(() => {
      this.pulse().catch(err => {
        logger.warn(`[Heartbeat] Recurring pulse warning: ${err.message}`);
      });
    }, this.intervalSeconds * 1000);

    logger.info(`[Heartbeat] Heartbeat service started (Interval: every ${this.intervalSeconds}s)`);
  }

  /**
   * Stops the heartbeat loop
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    logger.info('[Heartbeat] Heartbeat service stopped');
  }
}
