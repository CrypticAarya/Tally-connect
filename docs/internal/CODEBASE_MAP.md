# TALLY CONNECT — CODEBASE ARCHITECTURE & REPOSITORY MAP

**Audit Date:** 2026-10-01  
**Project:** Tally Connect (TallyPrime → Desktop Agent → Cloud Platform → SaaS Integration)  
**Repository State:** Post-Phase 12 External SaaS Readiness Audit  

---

## 1. Top-Level Repository Overview

```text
tally-connect/
├── client/              # React/Vite Internal Management Portal (Console/Dashboard)
├── connector-agent/     # Standalone Windows Desktop Connector Agent
│   ├── dist/            # Compiled standalone binaries (TallyConnectAgent.exe, Setup.exe)
│   ├── scripts/         # Windows build and packaging scripts (esbuild + pkg)
│   └── src/             # Agent production source code (canonical entry: src/index.js)
├── docs/                # Architectural, API, and onboarding documentation
├── legacy/              # Archived legacy pilot services, dev-fixtures, and older tests
├── sdk/                 # Public SaaS Developer Client SDK (JavaScript/TypeScript)
├── server/              # Central Cloud API & Multi-Tenant Middleware Backend
│   └── src/             # Server production source code (canonical entry: src/index.js)
├── storage/             # File storage exports (CSV/JSON artifacts)
├── tests/               # Consolidated test suites and mock XML fixtures
└── package.json         # Workspace root manifest
```

---

## 2. Directory Breakdown & Responsibility Map

### 2.1 ROOT DIRECTORY
- **Purpose**: Workspace container and monorepo orchestrator.
- **Production Status**: Configuration only.
- **Entry Point**: `package.json` (`npm run dev`, `npm run dev:server`, `npm run dev:client`).
- **Key Files**:
  - `package.json`: Manages root dependencies (`fast-csv`, `mysql2`, `pg`, `concurrently`).
  - `.env.example`: Template for environment variables.
  - Phase regression test files: `testPhase4AgentSimulation.js`, `testPhase5SyncEngine.js`, `testPhase6DeveloperPortal.js`, `testPhase7CustomerExperience.js`, `testPhase11SecurityHardening.js`, `testPhase12ExternalSaasIntegration.js`, `testRealTallyConnection.js`.

---

### 2.2 SERVER (`server/`)
- **Purpose**: Multi-tenant Cloud Platform providing developer authentication, application management, connection session lifecycle, data ingestion from desktop agents, caching, and public `/api/v1/*` data query endpoints.
- **Production Status**: Production Backend.
- **Entry Point**: `server/src/index.js` (starts Express server on port 5001, verifies production safety, initializes DB pool, starts background job queue).
- **Subdirectories & Modules**:
  - `server/src/adapters/`: Tally communication adapters (`tallyXmlHttpAdapter.js`, `tdlBuilder.js`, `xmlParser.js`, `tallyAdapter.js`). Production mode strictly sets `fixtureFallback = false`.
  - `server/src/config/`: Configuration loaders (`envLoader.js`, `environments.js`, `config.js`).
  - `server/src/db/`: Database connectivity and schema initialization (`mysql.js`, `saasRepository.js`, `repository.js`, `schema.sql`).
  - `server/src/engine/`: Data transformation and schema definitions (`jsonTransformer.js`, `transformer.js`, `schemas.js`, `csvExporter.js`).
  - `server/src/errors/`: Standardized public error envelopes (`customerErrors.js`).
  - `server/src/middleware/`: Multi-tenant security filters (`developerAuth.js`, `agentAuth.js`, `tenantIsolation.js`, `rateLimiter.js`, `apiUsageTracker.js`).
  - `server/src/queue/`: Background sync job queue (`jobQueue.js`).
  - `server/src/services/`: Core business logic (`syncService.js`, `webhookService.js`, `agentService.js`, `permissionService.js`, `activationService.js`).
  - `server/src/routes/`:
    - `developer/`: Developer registration, login, API key generation/revocation, app status.
    - `connect/`: Connection sessions, activation code issuance, connection status, permissions configuration, manual sync trigger.
    - `agent/`: Agent activation (`/activate`), heartbeat telemetry (`/heartbeat`), sync lifecycle (`/sync/start`, `/sync/upload`).
    - `v1/`: Public data querying endpoints (`customers.js`, `vendors.js`, `ledgers.js`, `inventory.js`, `orders.js`, `deliveryNotes.js`, `receiptNotes.js`, `sales.js`, `trialBalance.js`).
    - `docs.js`: Interactive JSON API documentation endpoint.

---

### 2.3 WINDOWS AGENT (`connector-agent/`)
- **Purpose**: Zero-dependency desktop background daemon installed on customer's Windows PC. Connects locally to TallyPrime on port 9000, evaluates allowed data permissions, extracts accounting data via XML HTTP protocol, normalizes to JSON, and securely uploads to Cloud API.
- **Production Status**: Standalone Production Desktop Client.
- **Canonical Entry Point**: `connector-agent/src/index.js` (CLI / Service / Setup Wizard router).
- **Core Modules (`connector-agent/src/`)**:
  - `agent.js`: Application lifecycle, config loader, activation workflow, startup/reboot recovery.
  - `cloudClient.js`: Authenticated HTTP client communicating with Cloud API (`/api/agent/*`).
  - `tallyClient.js`: Local port 9000 probe, active company detector.
  - `syncWorker.js`: Permission-respecting background sync processor (fetches permitted jobs, calls XML adapter, transforms data, uploads to Cloud).
  - `heartbeat.js`: Background pulse reporter (reports Tally online/offline status, company name, latency).
  - `installer.js`: Interactive or silent Windows Setup wizard for entering 6-character activation code.
  - `logger.js`: File-based operational logging (`logs/agent.log`, `logs/errors.log`).
  - `windowsService.js`: Registry/Run key autostart manager for Windows boot persistence.
  - `adapters/`: TallyPrime XML request generators and response parsers (`tallyXmlHttpAdapter.js`, `tdlBuilder.js`, `xmlParser.js`).
  - `engine/`: Normalization schemas and JSON transformer (`jsonTransformer.js`, `schemas.js`, `transformer.js`).
- **Packaging (`connector-agent/scripts/`)**:
  - `build.js`: Bundles `src/index.js` via `esbuild` into `dist/agent-bundle.cjs` and compiles standalone Windows `.exe` binaries (`TallyConnectAgent.exe` and `TallyConnectAgentSetup.exe`) via `pkg`.

---

### 2.4 DEVELOPER SDK (`sdk/`)
- **Purpose**: Official Node.js / TypeScript SDK distributed to SaaS developers for effortless integration.
- **Production Status**: Production Client Library.
- **Entry Point**: `sdk/tallyConnect.js` (with types in `sdk/tallyConnect.d.ts`).
- **Key Capabilities**:
  - `createConnection({ appId, externalUserId, companyName })`: Creates onboarding session and yields 6-character activation code.
  - `getConnectionStatus(connectionId)`: Polls connection health and active Tally company.
  - `sync(connectionId)`: Triggers immediate Cloud sync.
  - `getPermissions(connectionId)` / `updatePermissions(connectionId, permissions)`: Customer data privacy controls.
  - `getCustomers()`, `getVendors()`, `getSales()`, `getInventory()`, `getLedgers()`, `getSalesOrders()`, `getPurchaseOrders()`, `getDeliveryNotes()`, `getReceiptNotes()`, `getTrialBalance()`: Type-safe data querying.
  - `TallyConnect.verifyWebhookSignature(rawBody, signature, secret)`: Cryptographic HMAC-SHA256 signature verification.

---

### 2.5 DOCUMENTATION (`docs/`)
- **Purpose**: System documentation for developers, administrators, and customer onboarding.
- **Key Artifacts**:
  - `SAAS_DEVELOPER_QUICKSTART.md`: Complete public integration guide for external developers.
  - `CUSTOMER_INSTALLATION_FLOW.md`: Step-by-step customer onboarding guide.
  - `WINDOWS_CUSTOMER_TESTER_GUIDE.md`: Guide for testing on real Windows machines.
  - `PHASE13_BASELINE.md`: Pre-refactor regression test suite results.
  - `CODEBASE_MAP.md`: Repository layout and inventory (this document).
  - `DEPENDENCY_MAP.md`: Runtime call graphs and dependency traces.
  - `ARCHITECTURE.md`: High-level system architecture and security boundaries.

---

### 2.6 LEGACY & TEST DIRECTORIES
- **`legacy/`**: Retained historical artifacts from early prototype phases (pilot export storage, old CSV exporter, mock fixtures). Isolated completely from production runtime paths.
- **`tests/`**: Automated test suites and mock XML fixtures used exclusively in CI/test environments (`tests/mock/*`). Zero production files import from `tests/`.
- **`storage/`**: Local cache directory for exported CSV/JSON files.
