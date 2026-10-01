# Tally Connect

> **Cloud Integration Platform & Windows Agent for TallyPrime.**  
> Seamlessly connect modern SaaS applications to customer on-premise Tally accounting systems via standard REST APIs, HMAC webhooks, and a TypeScript/Node.js SDK.

---

## 1. What is Tally Connect?

**Tally Connect** is an integration platform that allows cloud SaaS applications (ERPs, CRMs, Fintech platforms, and dashboards) to securely read accounting data from customer desktop **TallyPrime** installations.

Instead of writing custom TDL (Tally Definition Language), parsing raw XML over local networks, or asking customers to open inbound firewall ports, SaaS developers use standard JSON REST APIs and webhooks.

---

## 2. How Does It Work?

The end-to-end architecture is simple and outbound-only:

```text
SaaS Backend
    ↓
POST /api/connect/session
    ↓
Activation Code ("TC-7837")
    ↓
Customer installs TallyConnectAgent.exe
    ↓
Customer enters activation code
    ↓
Agent connects to local TallyPrime (Port 9000)
    ↓
Selected data extracted & transformed
    ↓
Tally Connect Cloud (MySQL Cache)
    ↓
REST API (/api/v1/*) & Webhooks
    ↓
SaaS Backend
```

1. **Session Creation:** Your SaaS backend requests a connection session and gets a 6-character code (e.g. `TC-7837`).
2. **Customer Onboarding:** Your customer installs `TallyConnectAgent.exe` on their Windows PC and enters the code.
3. **Local Pairing:** The agent pairs securely with Tally Connect Cloud, detects TallyPrime on `http://127.0.0.1:9000`, and reports status.
4. **Data Sync:** The agent extracts permitted accounting data using optimized TDL queries, converts XML into normalized JSON, and uploads to the cloud cache over TLS.
5. **Data Consumption:** Your SaaS queries clean JSON endpoints or consumes real-time webhook updates.

---

## 3. What Does the SaaS Developer Integrate? (Responsibilities)

| SaaS Developer Builds | Tally Connect Handles |
|:---|:---|
| **Connect Tally UI / button** in your dashboard | **Windows Agent** (`TallyConnectAgent.exe` installer & daemon) |
| **Customer-to-connection mapping** in your database | **TallyPrime communication** via local loopback port 9000 |
| **Secure API credential storage** (`apiKey`, `apiSecret`) | **XML / TDL extraction** & query generation |
| **Connection status display** (Connected / Syncing / Offline) | **Data transformation** to normalized JSON |
| **Data consumption** via REST API or SDK | **Permission enforcement** (server-side 403 access control) |
| **Webhook endpoint** for real-time sync notifications | **Sync jobs**, retries, and scheduling |
| **SaaS-side error handling** & user workflows | **Heartbeats**, health monitoring, and connection recovery |
| | **Multi-tenant REST API** (`/api/v1/*`) |
| | **HMAC-SHA256 Webhook dispatching** |

---

## 4. How Does the Customer Connect Tally?

The customer experience requires **no technical knowledge** and takes under 60 seconds:
1. Customer clicks **"Connect Tally"** inside your SaaS application.
2. Your UI displays a 6-character activation code (e.g. `TC-7837`) and a download link for `TallyConnectAgentSetup.exe`.
3. Customer runs the installer on their Windows PC where TallyPrime is installed.
4. Customer enters `TC-7837` into the setup wizard.
5. The agent automatically detects active Tally companies and connects.
6. Customer chooses which data categories to share (Customers, Sales, Inventory, etc.).

For a detailed step-by-step customer guide, see [`docs/customer/CUSTOMER_INSTALLATION_GUIDE.md`](docs/customer/CUSTOMER_INSTALLATION_GUIDE.md).

---

## 5. How Does Data Reach the SaaS?

- **Outbound-Only HTTPS:** The Windows agent makes outbound requests to Tally Connect Cloud. Customers never need static IPs, inbound firewall exceptions, or port forwarding.
- **REST API:** Query cached accounting entities at any time with high-speed pagination and filtering:
  ```http
  GET /api/v1/customers HTTP/1.1
  Host: api.tallyconnect.cloud
  x-api-key: tc_live_your_api_key
  x-connection-id: conn_customer_123
  ```
- **Webhooks:** Receive signed `sync.completed` events immediately when new data is extracted:
  ```http
  POST /webhook HTTP/1.1
  X-Tally-Signature: 3c9b7...hmac-sha256...
  X-Tally-Event: sync.completed
  
  {
    "event": "sync.completed",
    "app_id": "app_123",
    "timestamp": 1727784000000,
    "data": {
      "connection_id": "conn_customer_123",
      "company_name": "Acme Traders",
      "status": "COMPLETED",
      "records_synced": 420
    }
  }
  ```

---

## 6. What Data is Supported?

Tally Connect extracts and normalizes the following verified entity scopes. **Permissions explicitly govern which entities are accessible**; attempting to query an entity not permitted by the customer returns `403 Forbidden`.

### Master Data
- **Ledgers:** Complete Chart of Accounts (`GET /api/v1/ledgers`)
- **Groups:** Account hierarchy and parent groups (`GET /api/v1/groups`)
- **Cost Centers:** Cost categories and allocated centres (`GET /api/v1/cost-centers`)
- **Stock Items:** Inventory catalog with closing balances, units, and rates (`GET /api/v1/inventory`)
- **Stock Groups:** Product categories and inventory groupings (`GET /api/v1/stock-groups`)
- **Units:** Units of measure e.g. NOS, KGS, BOX (`GET /api/v1/units`)
- **Godowns:** Warehouses and physical storage locations (`GET /api/v1/godowns`)
- **Customers:** Sundry Debtors with addresses and GSTIN (`GET /api/v1/customers`)
- **Vendors:** Sundry Creditors with party details (`GET /api/v1/vendors`)

### Unsettled Transactions
- **Sales Orders:** Pending and open sales orders (`GET /api/v1/sales-orders`)
- **Purchase Orders:** Pending and open purchase orders (`GET /api/v1/purchase-orders`)
- **Delivery Notes:** Goods delivery challans awaiting sales invoicing (`GET /api/v1/delivery-notes`)
- **Receipt Notes:** Goods inward challans awaiting purchase billing (`GET /api/v1/receipt-notes`)

> **Note:** Tally Connect does NOT claim to sync "all Tally data" arbitrarily. Only the above production-validated data models are extracted and exposed.

---

## 7. How Do I Start Locally?

Get the cloud server up and running on your local machine in under 2 minutes:

```bash
# 1. Clone repository
git clone https://github.com/CrypticAarya/Tally-connect.git
cd Tally-connect

# 2. Configure local environment
cp .env.example .env

# 3. Start local MySQL database (LOCAL DEVELOPMENT ONLY)
docker compose up -d

# 4. Install dependencies
npm install
npm --prefix server install
npm --prefix connector-agent install

# 5. Start Cloud Server (Port 5001)
npm --prefix server start

# 6. Verify server health
curl http://127.0.0.1:5001/api/health
```

> **Note:** The included `docker-compose.yml` runs a standalone MySQL 8.0 instance for **LOCAL DEVELOPMENT ONLY**. Do not use it for commercial production hosting.

### Running Test Suites
```bash
npm run test:architecture      # Architecture health & zero hardcoded URLs
npm run test:saas-flow         # 10-step SaaS developer integration test
npm run test:sdk               # External SDK consumer import verification
npm run test:saas              # Full SaaS integration test (25 checks)
npm run test:security          # Multi-tenant isolation & rate limits
npm run test:all               # All 97 active regression tests
npm run test:real-tally        # Zero-mock real TallyPrime port 9000 test
```
npm run test:real-tally        # Zero-mock real TallyPrime port 9000 test
```

---

## 8. Where is the API Reference?

- **Interactive Swagger / OpenAPI UI:** `http://127.0.0.1:5001/api/docs`
- **Markdown Specification:** [`docs/api/API_REFERENCE.md`](docs/api/API_REFERENCE.md)
  Includes authentication headers, developer registration, connection sessions, query parameters, error contracts, and webhook verification.

---

## 9. Where is the SDK?

The official Node.js / TypeScript SDK is located in [`sdk/`](sdk/):

- **SDK Documentation:** [`sdk/README.md`](sdk/README.md)
- **TypeScript Declarations:** [`sdk/tallyConnect.d.ts`](sdk/tallyConnect.d.ts)

### Quick SDK Example
```javascript
import { connectTally, TallyConnect } from '@tallyconnect/sdk';

// 1. Create a customer activation session
const session = await connectTally({
  appId: 'app_your_id',
  userId: 'customer_tenant_4491',
  baseUrl: 'https://api.tallyconnect.cloud'
});
console.log('Customer Code:', session.activationCode); // e.g. "TC-7837"

// 2. Query customer data with TallyConnect client
const tally = new TallyConnect({
  apiKey: 'tc_live_your_api_key',
  baseUrl: 'https://api.tallyconnect.cloud'
});

const customers = await tally.getCustomers(session.connectionId);
const inventory = await tally.getInventory(session.connectionId);
```

---

## 10. Where is the Windows Agent?

The desktop agent lives in [`connector-agent/`](connector-agent/):

- **Agent Documentation:** [`connector-agent/README.md`](connector-agent/README.md)
- **Compiling the Standalone Executable:**
  ```bash
  npm --prefix connector-agent run build
  # Generates: connector-agent/dist/TallyConnectAgent.exe
  ```
- **Running in Development Mode:**
  ```bash
  npm --prefix connector-agent start
  ```

---

## Complete Documentation Index

| Guide | Description |
|:---|:---|
| [**10-Minute Quickstart**](docs/integration/QUICKSTART.md) | First API request and customer connection. |
| [**Developer Integration Walkthrough**](docs/integration/DEVELOPER_DEMO.md) | Full end-to-end integration demo with copy-pasteable code. |
| [**REST API Reference**](docs/api/API_REFERENCE.md) | Endpoint specifications, query parameters, and error codes. |
| [**Architecture & System Design**](docs/architecture/ARCHITECTURE.md) | Security model, cloud caching, and multi-tenant isolation. |
| [**Standardized Terminology**](docs/architecture/TERMINOLOGY.md) | Canonical naming rules and forbidden synonyms. |
| [**Customer Installation Guide**](docs/customer/CUSTOMER_INSTALLATION_GUIDE.md) | Step-by-step setup guide for customer accountants. |
| [**Windows Agent Documentation**](connector-agent/README.md) | Daemon lifecycle, TDL generation, and installer builds. |
| [**Node.js SDK Guide**](sdk/README.md) | SDK configuration, methods catalog, and webhook helpers. |

---

## License

MIT © Tally Connect Platform Team
