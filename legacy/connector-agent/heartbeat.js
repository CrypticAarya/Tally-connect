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
      machineName: this.machineName,
      tallyStatus: tallyInfo.online ? 'ONLINE' : 'OFFLINE',
      activeCompany: tallyInfo.activeCompany || 'None',
      port: tallyInfo.port || 9000,
      timestamp: new Date().toISOString()
    };

    this.lastPayload = payload;

    const result = await this.cloudClient.sendHeartbeat(payload);

    if (result.success) {
      console.log(
        `[Heartbeat #${this.pulseCount}] Sent to cloud -> ` +
        `Tally: ${payload.tallyStatus} | Company: "${payload.activeCompany}" | Latency: ${tallyInfo.latencyMs}ms`
      );
    } else {
      console.warn(`[Heartbeat #${this.pulseCount}] Delivery failed: ${result.error}`);
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
      console.error('[Heartbeat] Initial pulse error:', err.message);
    });

    // Schedule recurring pulses
    this.timer = setInterval(() => {
      this.pulse().catch(err => {
        console.error('[Heartbeat] Recurring pulse error:', err.message);
      });
    }, this.intervalSeconds * 1000);

    console.log(`[Heartbeat] Heartbeat service started (Interval: every ${this.intervalSeconds}s)`);
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
    console.log('[Heartbeat] Heartbeat service stopped');
  }
}
