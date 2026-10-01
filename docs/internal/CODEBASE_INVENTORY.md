# Tally Connect — Codebase Inventory & Categorization
**Document Version:** 1.0.0  
**Phase:** External Developer Handoff Cleanup  
**Date:** October 2026  
**Status:** Completed  

---

## 1. Inventory Summary

| Category | File Count | Target Treatment |
|:---|:---:|:---|
| **Production Server** | 42 | KEEP in `server/` |
| **Windows Desktop Agent** | 18 | KEEP in `connector-agent/` (standardize docs & scripts) |
| **Client SDK** | 3 | KEEP in `sdk/` (add `package.json` & `README.md`) |
| **Active Regression Tests** | 9 | KEEP in `tests/` (97/97 passing checks) |
| **Test Fixtures & Mocks** | 4 | KEEP in `tests/mock/` |
| **Public Developer Documentation** | 6 | KEEP & RESTRUCTURE in `docs/` |
| **Internal Documentation** | 10 | KEEP in `docs/internal/` |
| **Legacy Archives** | 25 | PRESERVE in `legacy/` (read-only historical audit) |
| **Client Web App (Prototype)** | 6 | PRESERVE in `client/` (marked internal developer playground) |
| **Temporary / Scratch** | 5 | PRESERVED in `scratch/` (gitignored local backups & benchmarks) |

---

## 2. Complete File-by-File Inventory

### A. Production Cloud Backend (`server/`)
| File | Purpose | Used By | Disposition | Reason |
|:---|:---|:---|:---:|:---|
| `server/src/index.js` | Cloud API server entry point, middleware loader, route mounter | Production runtime, tests | **KEEP** | Core production server. |
| `server/src/config.js` | Unified environment config resolution | Server modules | **KEEP** | Centralized configuration. |
| `server/src/config/envLoader.js` | Safe environment file loader | `server/src/index.js` | **KEEP** | Ensures proper `.env` parsing. |
| `server/src/config/environments.js` | Staging, dev, production profiles | `server/src/config.js` | **KEEP** | Standard multi-environment support. |
| `server/src/db/mysql.js` | MySQL pool manager & schema initialization | All repositories & tests | **KEEP** | Primary production database store. |
| `server/src/db/saasRepository.js` | Developer, app, connection, and cache DB operations | Services & controllers | **KEEP** | Core repository for multi-tenant data. |
| `server/src/db/schema.sql` | DDL for all MySQL tables & indexes | `mysql.js` on startup | **KEEP** | Canonical database schema. |
| `server/src/engine/jsonTransformer.js`| Transforms raw Tally XML/JSON into SaaS schema | Sync worker & API | **KEEP** | Normalizes accounting domain entities. |
| `server/src/errors/customerErrors.js` | User-friendly error catalog & troubleshooting hints | API controllers | **KEEP** | Error UX for SaaS users. |
| `server/src/middleware/agentAuth.js` | Validates `x-agent-token` & connection session | Agent routes | **KEEP** | Agent security boundary. |
| `server/src/middleware/developerAuth.js` | JWT auth for developer portal | Developer routes | **KEEP** | Developer portal auth. |
| `server/src/middleware/saasAuth.js` | Validates `x-api-key` & `x-connection-id` | `/api/v1/*` data routes | **KEEP** | Primary SaaS API protection. |
| `server/src/middleware/rateLimiter.js` | Per-client sliding window rate limiter | Express router | **KEEP** | Protects API from flooding. |
| `server/src/middleware/tenantIsolation.js` | Prevents cross-app / cross-tenant connection tampering | Data & connect routes | **KEEP** | Strict multi-tenant isolation. |
| `server/src/middleware/apiUsageTracker.js` | Logs API request telemetry | Express router | **KEEP** | Analytics & usage auditing. |
| `server/src/queue/jobQueue.js` | In-memory asynchronous sync job queue | Sync worker & API | **KEEP** | Queues extraction jobs. |
| `server/src/routes/index.js` | Aggregates and mounts all sub-routers | `server/src/index.js` | **KEEP** | Modular router aggregation. |
| `server/src/routes/docs.js` | Serves public OpenAPI & developer API documentation | `/api/docs` | **KEEP** | Interactive developer documentation. |
| `server/src/routes/connect/` | Onboarding, session initiation, permissions, status | Customer & SaaS UI | **KEEP** | Customer linking flow. |
| `server/src/routes/developer/` | App creation, API key rotation, webhooks | Developer portal | **KEEP** | SaaS developer self-service. |
| `server/src/routes/agent/` | Activation, heartbeat, sync task polling, data upload | Desktop agent | **KEEP** | Agent communication protocol. |
| `server/src/routes/v1/` | Customer, vendor, inventory, ledger, order REST endpoints | External SaaS developers | **KEEP** | Public domain REST API. |
| `server/src/services/activationService.js` | Activation code generation & replay protection | Connect routes | **KEEP** | Safe code matching. |
| `server/src/services/agentService.js` | Agent heartbeat, version tracking, online status | Agent routes | **KEEP** | Desktop agent daemon manager. |
| `server/src/services/permissionService.js` | Customer data permissions validation & enforcement | Sync & v1 data routes | **KEEP** | Core customer privacy governance. |
| `server/src/services/syncService.js` | Coordinates sync jobs and entity cache writes | Sync routes | **KEEP** | Cloud sync coordination. |
| `server/src/services/webhookService.js` | HMAC-SHA256 signed event delivery to SaaS | Sync & connection events| **KEEP** | Real-time webhook notification. |
| `server/src/storage/storageService.js` | Local file storage abstraction for large exports | Export workflows | **KEEP** | Large payload export storage. |

### B. Windows Desktop Connector Agent (`connector-agent/`)
| File | Purpose | Used By | Disposition | Reason |
|:---|:---|:---|:---:|:---|
| `connector-agent/src/index.js` | Agent CLI entry point (daemon & interactive setup) | Desktop executable | **KEEP** | Main process entry point. |
| `connector-agent/src/agent.js` | Background synchronization daemon | `index.js` | **KEEP** | Heartbeat & task runner. |
| `connector-agent/src/installer.js` | Interactive CLI wizard for customer activation | `index.js --install` | **KEEP** | First-run setup experience. |
| `connector-agent/src/tallyClient.js` | Communicates with local TallyPrime via port 9000 | `syncWorker.js` | **KEEP** | TallyPrime HTTP bridge. |
| `connector-agent/src/cloudClient.js` | HTTPS client communicating with Tally Connect cloud | `agent.js`, `installer.js`| **KEEP** | Outbound cloud channel. |
| `connector-agent/src/syncWorker.js` | Executes entity extraction and uploads normalized cache | `agent.js` | **KEEP** | Data extraction worker. |
| `connector-agent/src/heartbeat.js` | Periodic health telemetry reporter | `agent.js` | **KEEP** | Online status monitoring. |
| `connector-agent/src/jobProcessor.js` | Polls and executes cloud-dispatched tasks | `agent.js` | **KEEP** | On-demand sync execution. |
| `connector-agent/src/windowsService.js` | Registry startup & background process management | `installer.js` | **KEEP** | Auto-start with Windows. |
| `connector-agent/src/logger.js` | Local file and console logger | All agent modules | **KEEP** | Diagnostic logs in `logs/agent.log`. |
| `connector-agent/src/adapters/tallyXmlHttpAdapter.js` | XML request generator & HTTP executor | `tallyClient.js` | **KEEP** | TDL XML request protocol. |
| `connector-agent/src/adapters/tdlBuilder.js` | Constructs specialized TDL XML queries | `tallyXmlHttpAdapter.js`| **KEEP** | Tally Definition Language generator. |
| `connector-agent/src/adapters/xmlParser.js` | High-performance XML parser & field normalizer | `tallyXmlHttpAdapter.js`| **KEEP** | XML-to-JSON normalization. |
| `connector-agent/src/engine/jsonTransformer.js` | Schema transformer matching cloud definitions | `syncWorker.js` | **KEEP** | Ensures cloud schema parity. |
| `connector-agent/scripts/build.js` | Standalone `.exe` compiler via esbuild & pkg | Build pipeline | **KEEP** | Packages `TallyConnectAgent.exe`. |
| `connector-agent/scripts/install.bat` | Windows batch setup runner | End-user installation | **KEEP** | Simple click-to-run setup on Windows. |
| `connector-agent/scripts/install.ps1` | PowerShell setup runner | Automated enterprise IT | **KEEP** | Silent enterprise deployment. |
| `connector-agent/config.json` | Local configuration template (clean, empty tokens) | Agent runtime | **KEEP** | Active settings store. |
| `connector-agent/testSimulation.js` | Historical Phase 8 agent simulation | None (standalone) | **ARCHIVE** | Move to `legacy/tests/agent-simulations/`. |
| `connector-agent/testBetaUserSimulation.js` | Historical Phase 9 beta user simulation | None (standalone) | **ARCHIVE** | Move to `legacy/tests/agent-simulations/`. |
| `connector-agent/testFreshMachineSimulation.js` | Historical fresh machine simulation | None (standalone) | **ARCHIVE** | Move to `legacy/tests/agent-simulations/`. |
| `connector-agent/testMultiTenantSimulation.js` | Historical multi-tenant simulation | None (standalone) | **ARCHIVE** | Move to `legacy/tests/agent-simulations/`. |

### C. Client SDK (`sdk/`)
| File | Purpose | Used By | Disposition | Reason |
|:---|:---|:---|:---:|:---|
| `sdk/index.js` | Public package entry point | External SaaS developers | **KEEP** | Re-exports `TallyConnect`. |
| `sdk/tallyConnect.js` | Full SDK implementation (session, polling, data, webhooks)| External SaaS developers | **KEEP** | Canonical JavaScript client library. |
| `sdk/tallyConnect.d.ts` | TypeScript declarations & type definitions | TypeScript SaaS projects | **KEEP** | Complete type safety. |
| `sdk/package.json` | NPM package metadata & dependencies | NPM registry / imports | **CREATE** | Needed for standalone packaging. |
| `sdk/README.md` | SDK usage documentation & quickstart | External SaaS developers | **CREATE** | Quick developer onboarding. |

### D. Active Regression Tests (`tests/`)
| File | Purpose | Assertions | Disposition | Reason |
|:---|:---|:---:|:---:|:---|
| `tests/architecture/refactor-regression.test.js` | Modularity, error catalog, zero hardcoded URLs | 14/14 | **KEEP** | Architecture regression guard. |
| `tests/agent/agent-lifecycle.test.js` | Daemon startup, wizard, reboot recovery, config | 6/6 | **KEEP** | Desktop agent lifecycle validation. |
| `tests/integration/customer-connection.test.js` | Onboarding, activation code, status reporting | 7/7 | **KEEP** | Customer connection lifecycle. |
| `tests/integration/developer-portal.test.js` | App registration, key rotation, HMAC webhooks | 7/7 | **KEEP** | Developer self-service flow. |
| `tests/integration/sync-engine.test.js` | Permission-gated sync, cache update, delta jobs | 7/7 | **KEEP** | Sync engine correctness. |
| `tests/security/security-hardening.test.js` | Multi-tenant isolation, key scoping, rate limits | 16/16 | **KEEP** | Enterprise security verification. |
| `tests/external-saas/external-saas.test.js` | Full blind external developer integration flow | 25/25 | **KEEP** | Public integration validation. |
| `tests/real-tally/real-tally-extraction.test.js` | Zero-mock TallyPrime port 9000 XML protocol | 8/8 | **KEEP** | Live TallyPrime compatibility test. |
| `tests/release/production-readiness.test.js` | Health probes, env validation, MySQL persistence | 7/7 | **KEEP** | Release readiness certification. |
| `tests/mock/agentXmlFixtures.js` | Standard Tally XML fixture strings | Offline test runners | **KEEP** | Shared mock data. |
| `tests/mock/mockData.js` | Normalized JSON domain entity fixtures | Offline test runners | **KEEP** | Shared mock data. |
| `tests/mock/mockTallyAdapter.js` | Local HTTP server emulating port 9000 | Offline test runners | **KEEP** | Shared mock server. |
| `tests/mock/xmlFixtures.js` | Comprehensive Tally XML response payloads | Offline test runners | **KEEP** | Shared mock data. |

---

## 3. Action Plan for Clean Repository Handoff

1. **Move agent simulation tests** (`connector-agent/test*.js`) to `legacy/tests/agent-simulations/` so `connector-agent/` contains strictly production agent code and deployment scripts.
2. **Add `sdk/package.json` and `sdk/README.md`** so the SDK is a self-contained, standalone npm package.
3. **Restructure `docs/`** into clear subfolders (`docs/integration/`, `docs/architecture/`, `docs/api/`, `docs/customer/`, `docs/internal/`) while ensuring zero broken links.
4. **Rewrite root `README.md`** into an executive, developer-first product guide.
5. **Verify `npm run test:all` (97/97 PASS)** and agent compilation after all organization steps.
