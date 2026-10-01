# TALLY CONNECT — RUNTIME DEPENDENCY MAP & DUPLICATION ANALYSIS

**Audit Date:** 2026-10-01  
**Scope:** Server, Desktop Agent, Developer SDK, and Shared Data Engines  

---

## 1. Primary Runtime Flows

### Flow 1: SaaS Developer HTTP Request → Data Retrieval
```text
External SaaS Application / SDK
  │
  ▼ HTTP GET /api/v1/customers?page=1&limit=50
  │  Headers: [x-api-key: tc_live_...], [x-connection-id: conn_...]
  │
[server/src/middleware/rateLimiter.js]
  │  Checks token bucket per API key / IP (120 req/min)
  ▼
[server/src/middleware/apiUsageTracker.js]
  │  Tracks endpoint usage and timestamps
  ▼
[server/src/middleware/developerAuth.js]
  │  Validates x-api-key in MySQL `apps` table
  │  Attaches req.targetApp to context
  ▼
[server/src/middleware/tenantIsolation.js]
  │  Verifies connection belongs to calling developer's app
  │  Verifies customer permission (allow_customers === true)
  ▼
[server/src/routes/v1/customers.js]
  │  Validates query params (page, limit, search)
  ▼
[server/src/db/saasRepository.js]
  │  Executes parameterized query on `entity_cache` (where connection_id = ? AND entity_type = ?)
  ▼
[server/src/db/mysql.js]
  │  Returns cached JSON records
  ▼
HTTP 200 OK: { success: true, data: [...], pagination: {...} }
```

---

### Flow 2: TallyPrime Local Extraction → Cloud Synchronization
```text
TallyPrime (Windows Localhost:9000)
  │
  ▼ Raw XML Data (TDL Collection Response)
  │
[connector-agent/src/adapters/tallyXmlHttpAdapter.js]
  │  Dispatches POST request with TDL XML envelope
  │  Receives raw XML string (UTF-8)
  ▼
[connector-agent/src/adapters/xmlParser.js]
  │  Parses XML tags using fast-xml-parser
  ▼
[connector-agent/src/engine/jsonTransformer.js]
  │  Normalizes dirty/inconsistent Tally XML fields into clean JSON schema
  ▼
[connector-agent/src/syncWorker.js]
  │  Validates against local/cloud permissions matrix
  │  Packages chunked payload
  ▼
[connector-agent/src/cloudClient.js]
  │  Sends HTTP POST to Cloud /api/agent/sync/upload
  │  Header: Authorization: Bearer <agentToken>
  ▼
[server/src/middleware/agentAuth.js]
  │  Authenticates Bearer agentToken in `agents` table
  ▼
[server/src/routes/agent/sync.js]
  │  Validates connection permissions
  │  Stores clean records in MySQL `entity_cache`
  │  Updates `sync_jobs` status to COMPLETED
  ▼
[server/src/services/webhookService.js]
  │  Computes HMAC-SHA256 signature using app's api_secret
  │  Dispatches `sync.completed` webhook to developer's webhook_url
```

---

## 2. Duplicate Module Analysis

| File A | File B | Status / Recommendation |
|---|---|---|
| `connector-agent/agent.js` | `connector-agent/src/agent.js` | **`src/agent.js` is CANONICAL.** `connector-agent/agent.js` is an unmaintained prototype with console logs and old imports. Move `connector-agent/agent.js` to `legacy/`. |
| `connector-agent/cloudClient.js` | `connector-agent/src/cloudClient.js` | **`src/cloudClient.js` is CANONICAL.** Contains macOS loopback resolution, Bearer token auth headers, and response status normalization. Move `connector-agent/cloudClient.js` to `legacy/`. |
| `connector-agent/heartbeat.js` | `connector-agent/src/heartbeat.js` | **`src/heartbeat.js` is CANONICAL.** Uses structured file-based logging (`logger.js`). Move `connector-agent/heartbeat.js` to `legacy/`. |
| `connector-agent/jobProcessor.js` | `connector-agent/src/jobProcessor.js` | **`src/jobProcessor.js` is CANONICAL.** The root copy incorrectly imported cross-boundary modules from `../server/src/`. Move `connector-agent/jobProcessor.js` to `legacy/`. |
| `connector-agent/tallyClient.js` | `connector-agent/src/tallyClient.js` | **`src/tallyClient.js` is CANONICAL.** Identical implementations. Move root copy to `legacy/`. |
| `testPhase1Migration.js` | `tests/testPhase1Migration.js` | Duplicate test files at root and `tests/`. Keep consolidated inside `tests/`. |
| `testPhase3Activation.js` | `tests/testPhase3Activation.js` | Duplicate test files at root and `tests/`. Keep consolidated inside `tests/`. |
| `testPhase9WindowsCustomerTest.js` | `tests/testPhase9WindowsCustomerTest.js` | Duplicate test files at root and `tests/`. Keep consolidated inside `tests/`. |
| `testPhase10CleanProduction.js` | `tests/testPhase10CleanProduction.js` | Duplicate test files at root and `tests/`. Keep consolidated inside `tests/`. |
| `testRealTallyConnection.js` | `tests/testRealTallyConnection.js` | Duplicate test files at root and `tests/`. Keep consolidated inside `tests/`. |

---

## 3. Server vs Agent Shared Code Analysis

The following modules exist in both `server/src/` and `connector-agent/src/`:
1. `adapters/tallyXmlHttpAdapter.js`
2. `adapters/tallyAdapter.js`
3. `adapters/tdlBuilder.js`
4. `adapters/xmlParser.js`
5. `engine/jsonTransformer.js`
6. `engine/schemas.js`
7. `engine/transformer.js`

### Architectural Assessment:
- The desktop agent is compiled into a standalone Windows executable (`TallyConnectAgent.exe`) via `pkg` and distributed to end-user Windows PCs.
- It must be completely self-contained without npm dependencies, external server imports, or relative paths traversing out of `connector-agent/`.
- Having the Tally XML adapters and JSON transformers inside `connector-agent/src/` is strictly required for the agent to function independently on Windows.
- Keeping these in `server/src/` is also useful for cloud-side validation, server-side Tally XML tests, and schema verification.
- **Architectural Decision**: Keep `connector-agent/src/adapters/` and `connector-agent/src/engine/` completely standalone to preserve clean desktop packaging. Synchronize any schema adjustments between them directly.

---

## 4. Unused & Dead Code Identified

1. **`connector-agent/config.dev.json` & `connector-agent/config.local.json`**:
   - Dev scratch configs with hardcoded connection IDs from earlier local testing.
   - Production agent creates its own `config.json` via the setup wizard (`installer.js`).
2. **`server/storage/exports/*.csv` & `*.meta.json`**:
   - Stale test artifacts from Phase 1/Phase 2 CSV export runs. Can be cleaned from active git tracking.
3. **`legacy/` folder**:
   - Contains old pilot service (`pilotService.js`), old local export storage, and retired test fixtures. Already properly separated from production runtime.
