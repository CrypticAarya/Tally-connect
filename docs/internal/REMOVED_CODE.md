# TALLY CONNECT — AUDIT OF REMOVED & RETIRED CODE

**Documentation Date:** 2026-10-01  
**Scope:** Phase 13 Architecture Refactor & Controlled Cleanup  

---

## 1. Inventory of Retired & Relocated Files

| File | Reason for Removal / Relocation | Canonical Replacement | Verification Method |
|---|---|---|---|
| `connector-agent/agent.js` | Unmaintained prototype file located at root of `connector-agent/`. Lacked structured file-based logging (`logger.js`), restart resilience, and session restoration. | `connector-agent/src/agent.js` | `node testPhase4AgentSimulation.js` passed (6/6). Standalone binary packaging verified via `node connector-agent/scripts/build.js`. |
| `connector-agent/cloudClient.js` | Duplicate implementation at root of `connector-agent/`. Lacked loopback IP mapping, Bearer token auth headers, and response status normalization. | `connector-agent/src/cloudClient.js` | `node testPhase5SyncEngine.js` passed (7/7) and `node testPhase12ExternalSaasIntegration.js` passed (25/25). |
| `connector-agent/heartbeat.js` | Duplicate implementation at root of `connector-agent/`. Used unformatted console output instead of structured logging. | `connector-agent/src/heartbeat.js` | `node testPhase4AgentSimulation.js` verified MySQL heartbeat telemetry update. |
| `connector-agent/jobProcessor.js` | Dangerous boundary violation: root copy was importing cross-boundary modules from `../server/src/adapters/` and `../server/src/engine/`, preventing clean standalone Windows agent distribution. | `connector-agent/src/jobProcessor.js` (fully self-contained inside `connector-agent/src/`) | `node connector-agent/scripts/build.js` bundled cleanly without external directory traversal. |
| `connector-agent/tallyClient.js` | Duplicate copy at root of `connector-agent/`. | `connector-agent/src/tallyClient.js` | `node testRealTallyConnection.js` verified port 9000 XML probe. |

---

## 2. Relocation Destination

All 5 prototype files above were safely relocated into:
```text
legacy/connector-agent/
├── agent.js
├── cloudClient.js
├── heartbeat.js
├── jobProcessor.js
└── tallyClient.js
```

---

## 3. Strict Safety & Regression Verification

Following the relocation of these 5 prototype files:
1. `tests/testPhase3Activation.js` import was updated to point to `../connector-agent/src/agent.js`.
2. `connector-agent/scripts/build.js` was executed and successfully compiled:
   - `dist/agent-bundle.cjs` (1.2 MB standalone CJS bundle)
   - `dist/TallyConnectAgent.exe` (Windows x64 executable)
   - `dist/TallyConnectAgentSetup.exe` (Windows setup wizard)
   - `dist/tally-connect-agent-host` (Host test binary)
3. The complete regression baseline test suite was executed:
   - Phase 4 Agent Simulation: **PASS (6/6)**
   - Phase 5 Sync Engine: **PASS (7/7)**
   - Phase 6 Developer Portal: **PASS (7/7)**
   - Phase 7 Customer Experience: **PASS (7/7)**
   - Phase 11 Security Hardening: **PASS (16/16)**
   - Phase 11 Production Readiness: **PASS (7/7)**
   - Phase 12 External SaaS Integration: **PASS (25/25)**
   - Real Tally Connection Pipeline: **PASS (8/8)**
   - Architecture Refactor Regression: **PASS (14/14)**
