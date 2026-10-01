# Tally Connect — Code Map ("Where to Find Things")
**Document Version:** 1.0.0  
**Phase:** External Developer Handoff  
**Date:** October 2026  

This reference map directs developers to the exact source files responsible for each business and architectural responsibility across **Tally Connect**.

---

## 1. Quick Navigation by Feature

| I need to modify or inspect... | Canonical File Path | Notes |
|:---|:---|:---|
| **SaaS Customer Data API (GET `/api/v1/customers`)** | [`server/src/routes/v1/customers.js`](file:///Users/eunoia/Desktop/Tally%20Connect/server/src/routes/v1/customers.js) | Handles pagination, filtering, and customer domain formatting. |
| **SaaS Vendor Data API (GET `/api/v1/vendors`)** | [`server/src/routes/v1/vendors.js`](file:///Users/eunoia/Desktop/Tally%20Connect/server/src/routes/v1/vendors.js) | Sundry Creditor records & banking data. |
| **SaaS Invoices / Sales Register (GET `/api/v1/sales`)** | [`server/src/routes/v1/sales.js`](file:///Users/eunoia/Desktop/Tally%20Connect/server/src/routes/v1/sales.js) | Sales vouchers, line items, and tax rates. |
| **SaaS Inventory Data API (GET `/api/v1/inventory`)** | [`server/src/routes/v1/inventory.js`](file:///Users/eunoia/Desktop/Tally%20Connect/server/src/routes/v1/inventory.js) | Stock items, godowns, UOMs, and pricing. |
| **SaaS Chart of Accounts (GET `/api/v1/ledgers`)** | [`server/src/routes/v1/ledgers.js`](file:///Users/eunoia/Desktop/Tally%20Connect/server/src/routes/v1/ledgers.js) | General ledgers, parent groups, and balances. |
| **SaaS Orders (GET `/api/v1/orders`)** | [`server/src/routes/v1/orders.js`](file:///Users/eunoia/Desktop/Tally%20Connect/server/src/routes/v1/orders.js) | Unsettled Sales & Purchase orders. |
| **Customer Connection Creation & Sessions** | [`server/src/routes/connect/session.js`](file:///Users/eunoia/Desktop/Tally%20Connect/server/src/routes/connect/session.js) | Creates connection IDs and activation codes. |
| **Connection Status & Heartbeat Reporting** | [`server/src/routes/connect/status.js`](file:///Users/eunoia/Desktop/Tally%20Connect/server/src/routes/connect/status.js) | Live agent/Tally online status. |
| **Customer Data Permissions** | [`server/src/services/permissionService.js`](file:///Users/eunoia/Desktop/Tally%20Connect/server/src/services/permissionService.js) | Evaluates and enforces 403 Forbidden checks. |
| **Sync Coordination & Cache Writing** | [`server/src/services/syncService.js`](file:///Users/eunoia/Desktop/Tally%20Connect/server/src/services/syncService.js) | Manages job queue and MySQL `entity_cache`. |
| **Webhook Delivery & HMAC Signing** | [`server/src/services/webhookService.js`](file:///Users/eunoia/Desktop/Tally%20Connect/server/src/services/webhookService.js) | Cryptographic signature generation & retries. |
| **Developer App Registration & API Keys** | [`server/src/routes/developer/index.js`](file:///Users/eunoia/Desktop/Tally%20Connect/server/src/routes/developer/index.js) | Key issuance, rotation, and webhook config. |
| **Public Interactive Documentation (`/api/docs`)** | [`server/src/routes/docs.js`](file:///Users/eunoia/Desktop/Tally%20Connect/server/src/routes/docs.js) | Self-documenting OpenAPI endpoints. |
| **Tally XML / TDL Request Generator** | [`connector-agent/src/adapters/tdlBuilder.js`](file:///Users/eunoia/Desktop/Tally%20Connect/connector-agent/src/adapters/tdlBuilder.js) | Specialized TDL XML query syntax. |
| **Tally HTTP Port 9000 Client** | [`connector-agent/src/tallyClient.js`](file:///Users/eunoia/Desktop/Tally%20Connect/connector-agent/src/tallyClient.js) | Loopback HTTP communication with TallyPrime. |
| **Tally XML Parsing & Field Cleaning** | [`connector-agent/src/adapters/xmlParser.js`](file:///Users/eunoia/Desktop/Tally%20Connect/connector-agent/src/adapters/xmlParser.js) | Normalizes XML attributes into JSON. |
| **Agent Desktop Daemon Process** | [`connector-agent/src/agent.js`](file:///Users/eunoia/Desktop/Tally%20Connect/connector-agent/src/agent.js) | Heartbeat timer, task runner, and state loop. |
| **Agent Interactive Setup Wizard** | [`connector-agent/src/installer.js`](file:///Users/eunoia/Desktop/Tally%20Connect/connector-agent/src/installer.js) | CLI activation experience for Windows users. |
| **Standalone Windows `.exe` Compiler** | [`connector-agent/scripts/build.js`](file:///Users/eunoia/Desktop/Tally%20Connect/connector-agent/scripts/build.js) | `esbuild` + `pkg` binary packager. |
| **Node.js Client SDK Implementation** | [`sdk/tallyConnect.js`](file:///Users/eunoia/Desktop/Tally%20Connect/sdk/tallyConnect.js) | Client library and webhook verifier. |
| **Node.js Client SDK TypeScript Types** | [`sdk/tallyConnect.d.ts`](file:///Users/eunoia/Desktop/Tally%20Connect/sdk/tallyConnect.d.ts) | TypeScript type declarations. |
| **MySQL Database Schema & Migrations** | [`server/src/db/schema.sql`](file:///Users/eunoia/Desktop/Tally%20Connect/server/src/db/schema.sql) | DDL for all multi-tenant tables. |
| **MySQL Connection Pool & Helpers** | [`server/src/db/mysql.js`](file:///Users/eunoia/Desktop/Tally%20Connect/server/src/db/mysql.js) | Database pool and cryptographic helpers. |

---

## 2. Directory Structure Map

```text
Tally Connect/
├── server/src/
│   ├── api/                   # Router mounts
│   ├── config/                # Environment loaders & profile definitions
│   ├── db/                    # MySQL connection pool, repository, DDL schema
│   ├── engine/                # Data normalizer & JSON transformers
│   ├── errors/                # Standard customer error catalog
│   ├── middleware/            # Auth (SaaS, developer, agent), rate-limiter, isolation
│   ├── queue/                 # Asynchronous background job queue
│   ├── routes/
│   │   ├── connect/           # Customer onboarding & permission APIs
│   │   ├── developer/         # App registration & key management
│   │   ├── agent/             # Desktop agent activation, heartbeat, sync
│   │   ├── v1/                # Standardized accounting REST endpoints
│   │   └── docs.js            # Live interactive documentation endpoint
│   └── services/              # Core business services (sync, agent, webhooks, auth)
│
├── connector-agent/
│   ├── scripts/               # Binary build scripts (esbuild + pkg packager)
│   ├── src/
│   │   ├── adapters/          # TallyPrime TDL builder, XML parser, XML executor
│   │   ├── engine/            # JSON transformer matching cloud schemas
│   │   ├── agent.js           # Background synchronization daemon
│   │   ├── cloudClient.js     # HTTPS client communicating with cloud
│   │   ├── heartbeat.js       # Periodic health telemetry reporter
│   │   ├── installer.js       # Interactive CLI activation wizard
│   │   ├── logger.js          # File & console logger
│   │   ├── syncWorker.js      # Entity extraction & upload coordinator
│   │   ├── tallyClient.js     # HTTP client for local TallyPrime port 9000
│   │   └── windowsService.js  # Windows auto-start registry manager
│   ├── config.json            # Local agent settings & credentials (clean template)
│   └── package.json           # Agent package configuration
│
├── sdk/
│   ├── index.js               # Primary package export
│   ├── tallyConnect.js        # Core SDK implementation
│   ├── tallyConnect.d.ts      # TypeScript definitions
│   ├── package.json           # Standalone npm package manifest
│   └── README.md              # SDK developer documentation
│
├── tests/
│   ├── architecture/          # Architecture refactor & health validation (14/14)
│   ├── agent/                 # Desktop daemon & reboot recovery tests (6/6)
│   ├── integration/           # Customer connection, dev portal, sync engine (21/21)
│   ├── security/              # Multi-tenant isolation & rate-limiting tests (16/16)
│   ├── external-saas/         # Full blind SaaS developer workflow (25/25)
│   ├── real-tally/            # Zero-mock TallyPrime XML protocol extraction (8/8)
│   ├── release/               # Production readiness health & env verification (7/7)
│   └── mock/                  # Shared mock server & XML fixtures
│
└── docs/
    ├── architecture/          # System design, database analysis, code map
    ├── integration/           # SaaS developer quickstart
    ├── api/                   # Public REST API reference
    ├── customer/              # Non-technical customer installation guide
    └── internal/              # Archived engineering logs & audit trails
```
