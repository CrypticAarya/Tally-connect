/**
 * Service managing Desktop Agent telemetry, heartbeats, and online/offline status
 */
export class AgentService {
  /**
   * In-memory registry of agent status (agentId -> statusRecord)
   */
  static agentRegistry = new Map();

  /**
   * Timeout window (in ms) after which an agent is marked OFFLINE if no heartbeat received
   */
  static HEARTBEAT_TIMEOUT_MS = 90000; // 90 seconds

  /**
   * Records or updates agent heartbeat telemetry
   * @param {Object} payload
   */
  static recordHeartbeat(payload) {
    const {
      agentId,
      connectionId,
      machineName,
      tallyStatus,
      activeCompany,
      tallyVersion,
      port = 9000,
      agentVersion = '1.0.0'
    } = payload;

    const record = {
      agentId: agentId || `agt_${connectionId}`,
      connectionId,
      machineName: machineName || 'Desktop-Host',
      status: tallyStatus === 'ONLINE' ? 'ONLINE' : 'IDLE',
      tallyStatus: tallyStatus || 'OFFLINE',
      activeCompany: activeCompany || null,
      tallyVersion: tallyVersion || 'TallyPrime 4.x',
      port,
      agentVersion,
      lastHeartbeat: new Date(),
      lastHeartbeatIso: new Date().toISOString()
    };

    this.agentRegistry.set(record.agentId, record);
    return record;
  }

  /**
   * Returns current health of an agent
   * @param {string} agentId
   */
  static getAgentHealth(agentId) {
    const record = this.agentRegistry.get(agentId);
    if (!record) {
      return { status: 'OFFLINE', lastHeartbeat: null };
    }

    const elapsed = Date.now() - new Date(record.lastHeartbeat).getTime();
    if (elapsed > this.HEARTBEAT_TIMEOUT_MS) {
      return {
        ...record,
        status: 'OFFLINE',
        isStale: true
      };
    }

    return {
      ...record,
      isStale: false
    };
  }

  /**
   * Lists all registered agents and their current statuses
   */
  static listAgents() {
    const list = [];
    for (const [id, record] of this.agentRegistry.entries()) {
      list.push(this.getAgentHealth(id));
    }
    return list;
  }
}
