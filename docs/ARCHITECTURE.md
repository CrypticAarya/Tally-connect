# TALLY CONNECT — ARCHITECTURE & TECHNICAL SYSTEM DESIGN

**Version:** 1.0.0 (Production Architecture)  
**Author:** Tally Connect Core Platform Engineering  
**Audience:** Internal Engineers, Systems Architects, and External SaaS Engineering Teams  

---

## 1. System Overview

**Tally Connect** is a secure, multi-tenant middleware platform that enables cloud-based SaaS software (CRMs, ERPs, Fintech apps, and analytics dashboards) to seamlessly synchronize accounting data with on-premise **TallyPrime** installations.

### Conceptual Architecture Diagram
```text
┌──────────────────────┐         ┌────────────────────────┐         ┌─────────────────────────┐
│   TallyPrime (ERP)   │         │  Windows Desktop Agent │         │   Tally Connect Cloud   │
│                      │         │                        │         │                         │
│  - Port 9000 (XML)   │◄───────►│  - TdlBuilder          │◄───────►│  - Auth & Multi-Tenancy │
│  - Active Company    │  HTTP   │  - XmlParser           │  HTTPS  │  - Connection Sessions  │
│  - Accounting Data   │         │  - JsonTransformer     │         │  - MySQL Entity Cache   │
└──────────────────────┘         │  - SyncWorker          │         │  - Webhook Dispatcher   │
                                 └────────────────────────┘         └────────────┬────────────┘
                                                                                 │
                                                                                 │ HTTPS (/api/v1/*)
                                                                                 ▼
                                                                    ┌─────────────────────────┐
                                                                    │   External SaaS App     │
                                                                    │  (Node.js / Python SDK) │
                                                                    └─────────────────────────┘
```

---

## 2. Component Boundaries

### 2.1 Cloud API (`server/`)
- **Technology**: Node.js, Express, MySQL 8.x, PostgreSQL 14.x.
- **Port**: 5001.
- **Responsibilities**:
  - Developer portal, authentication (JWT), and app credential management (`api_key`, `api_secret`).
  - Customer connection onboarding and activation code lifecycle (`/api/connect/*`).
  - Ingestion endpoint for agent uploads (`/api/agent/sync/upload`) with Bearer token authentication.
  - Multi-tenant caching in MySQL `entity_cache`.
  - Public developer query endpoints (`/api/v1/*`) protected by `x-api-key` and `x-connection-id`.
  - HMAC-SHA256 signed webhook delivery.

### 2.2 Windows Desktop Agent (`connector-agent/`)
- **Technology**: Node.js, packaged with `esbuild` and `pkg` into a zero-dependency standalone executable (`TallyConnectAgent.exe` and `TallyConnectAgentSetup.exe`).
- **Dependencies**: Zero runtime Node.js or npm dependencies required on customer PC.
- **Responsibilities**:
  - Connects locally to TallyPrime on `http://127.0.0.1:9000`.
  - First-time setup wizard (`installer.js`) allowing user to enter 6-character activation code.
  - Heartbeat pulse reporting every 30 seconds (`heartbeat.js`).
  - Permission-based sync worker (`syncWorker.js`) extracting XML, normalizing to JSON, and uploading to Cloud.
  - Auto-start registration on Windows startup (`windowsService.js`).
  - Persistent operational and error logging to `logs/agent.log` and `logs/errors.log`.

### 2.3 Developer SDK (`sdk/`)
- **Technology**: JavaScript / TypeScript (`tallyConnect.js`, `tallyConnect.d.ts`).
- **Responsibilities**:
  - Provides a clean, typed interface for SaaS developers.
  - Methods: `createConnection()`, `getConnectionStatus()`, `sync()`, `getPermissions()`, `updatePermissions()`, `getCustomers()`, `getVendors()`, etc.
  - Webhook signature verification helper: `TallyConnect.verifyWebhookSignature(rawBody, signature, secret)`.

---

## 3. TallyPrime XML Protocol Communication

TallyPrime acts as an HTTP server listening on `http://127.0.0.1:9000` (enabled via **F1: Help → Settings → Connectivity → TallyPrime acts as: Both/Server**).

1. **Request Formulation**: `TdlBuilder` constructs a standard TDL envelope (`<ENVELOPE><HEADER>...<BODY><DESC><TDL>...`) requesting a specific Tally Collection or Report (e.g. `Sundry Debtors`, `Vouchers`, `StockItem`).
2. **Dispatch**: `TallyXmlHttpAdapter` posts the payload via HTTP POST to `http://127.0.0.1:9000` with header `Content-Type: text/xml;charset=utf-8`.
3. **Parsing**: `TallyXmlParser` uses `fast-xml-parser` to parse XML response elements into nested JavaScript objects.
4. **Normalization**: `JsonTransformer` maps heterogeneous Tally attributes into standardized, strongly-typed JSON schema records.

---

## 4. Connection & Onboarding Lifecycle

```text
SaaS Application                 Tally Connect Cloud            Customer Desktop Agent
      │                                    │                              │
      │ 1. POST /api/connect/session       │                              │
      │───────────────────────────────────►│                              │
      │                                    │                              │
      │ 2. Return activation_code (TC-XXXX)│                              │
      │◄───────────────────────────────────│                              │
      │                                    │                              │
      │ 3. Displays code to customer       │                              │
      │                                    │ 4. User enters code in wizard│
      │                                    │◄─────────────────────────────│
      │                                    │ 5. POST /api/agent/activate  │
      │                                    │    Validates code & company  │
      │                                    │                              │
      │                                    │ 6. Returns agent_token       │
      │                                    │─────────────────────────────►│
      │                                    │    Connection marked ACTIVE  │
      │                                    │    Agent runs in background  │
      │                                    │                              │
      │ 7. GET /api/connect/:id/status     │                              │
      │───────────────────────────────────►│                              │
      │    Status: ACTIVE                  │                              │
```

---

## 5. Permissions & Data Privacy Engine

The customer retains sovereign control over what financial data is shared with the SaaS application:

1. **Granular Permissions Matrix**:
   - `customers` (Sundry Debtors)
   - `vendors` (Sundry Creditors)
   - `sales` (Sales Register)
   - `inventory` (Stock items, groups, units, godowns)
   - `ledgers` (Chart of accounts, groups, cost centers)
   - `sales_orders` & `purchase_orders`
   - `delivery_notes` & `receipt_notes`
   - `trial_balance`
2. **Double Enforcement Barrier**:
   - **Agent Boundary**: Agent requests permission flags from Cloud before querying TallyPrime. If an entity is disallowed, the agent never queries TallyPrime for it.
   - **Cloud Retrieval Boundary**: Even if cached records previously existed, `GET /api/v1/*` immediately checks permissions and rejects queries for disabled entities with `403 FORBIDDEN (PERMISSION_DENIED)`.

---

## 6. Multi-Tenant Security & Isolation

- **API Key Scoping**: SaaS API requests must supply `x-api-key`. Keys are bound to specific `apps` and cannot access connections belonging to other apps.
- **Connection Isolation**: Queries to `/api/v1/*` mandate `x-connection-id`. The server validates that the connection was provisioned under the calling API key's application. Cross-app access returns `403 FORBIDDEN`.
- **Agent Bearer Token**: Agent sync operations require `Authorization: Bearer <agentToken>`. The server extracts the `connection_id` directly from the token's database record, preventing connection spoofing.
- **Single-Use Activation Codes**: Activation codes expire in 15 minutes and can only be used once. Replay attempts return `400 BAD REQUEST`.

---

## 7. Webhook Delivery & Verification

Upon completion of any synchronization cycle, Tally Connect dispatches an HTTP POST event to the developer's registered `webhook_url`.

### Payload Format:
```json
{
  "event": "sync.completed",
  "connection_id": "conn_98a72b...",
  "company_name": "Acme Manufacturing Ltd",
  "sync_id": "job_11c82e...",
  "records_synced": 42,
  "entities": ["customers", "ledgers", "sales"],
  "timestamp": "2026-10-01T07:22:42.502Z"
}
```

### Signature Verification:
Each delivery includes header `x-tally-signature: sha256=<HMAC_HEX>`.
External SaaS developers verify authenticity using their `api_secret`:
```javascript
import { TallyConnect } from 'tally-connect-sdk';

const isValid = TallyConnect.verifyWebhookSignature(rawRequestBody, signatureHeader, apiSecret);
if (!isValid) {
  return res.status(401).send('Invalid signature');
}
```

---

## 8. Failure Recovery & Error Handling

- **TallyPrime Closed / Not Running**: Heartbeat reports `tally_status: 'OFFLINE'`. Public APIs return standardized customer error envelope:
  ```json
  {
    "success": false,
    "error": {
      "code": "TALLY_NOT_RUNNING",
      "message": "TallyPrime application is not running or XML communication port is disabled.",
      "solution": "Open TallyPrime on your desktop and verify that port 9000 is enabled in F1 > Settings > Connectivity."
    }
  }
  ```
- **Machine Reboot**: Desktop agent registers auto-launch in Windows Run registry. On reboot, agent restores session from `config.json` and resumes heartbeat and sync polling automatically.
- **Network Outage**: The agent logs network drops to `logs/errors.log`, uses exponential backoff, and resumes syncing as soon as internet connectivity returns.
