# Tally Connect

Tally Connect is a secure, multi-tenant middleware platform that enables cloud-based SaaS software to seamlessly synchronize accounting data with on-premise TallyPrime installations.

---

## What It Does

Tally Connect bridges local desktop accounting software (**TallyPrime**) with cloud applications:
1. An external SaaS creates a connection session via the Tally Connect API or SDK.
2. The customer runs **`TallyConnectAgentSetup.exe`** on their Windows PC and enters a 6-character activation code (`TC-XXXX`).
3. The agent connects to TallyPrime locally via its native port 9000 XML HTTP interface.
4. The customer chooses what accounting data the SaaS is allowed to access.
5. The agent extracts permitted data, normalizes it to clean JSON, and synchronizes it to Tally Connect Cloud.
6. The SaaS retrieves clean, strongly-typed JSON data via REST APIs (`/api/v1/*`) and receives webhook updates.

```text
┌──────────────────────┐         ┌────────────────────────┐         ┌─────────────────────────┐
│   TallyPrime (ERP)   │         │  Windows Desktop Agent │         │   Tally Connect Cloud   │
│                      │         │                        │         │                         │
│  - Port 9000 (XML)   │◄───────►│  - TdlBuilder          │◄───────►│  - Multi-Tenant Engine  │
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

## Architecture

- **Cloud API (`server/`)**: Central Express API managing developer credentials, connection sessions, webhook deliveries, and serving cached accounting data.
- **Windows Agent (`connector-agent/`)**: Standalone desktop background daemon distributed to customer PCs (`TallyConnectAgent.exe`).
- **TallyPrime**: The customer's on-premise accounting ERP running locally on port 9000.
- **Developer SDK (`sdk/`)**: Lightweight, zero-dependency Node.js/TypeScript library for SaaS integration.

---

## Repository Structure

```text
tally-connect/
│
├── server/                  # Central Cloud API & Multi-Tenant Engine
│   └── src/
│       ├── adapters/        # Tally XML HTTP adapters & TDL builders
│       ├── config/          # Environment configuration loaders
│       ├── db/              # MySQL schema & SaasRepository
│       ├── engine/          # JSON transformers & normalization schemas
│       ├── errors/          # Standardized customer-friendly error catalog
│       ├── middleware/      # Developer auth, agent auth, rate limiter
│       ├── routes/          # API route definitions (/developer, /connect, /agent, /v1)
│       ├── services/        # Sync, webhook, and agent lifecycle services
│       └── index.js         # Canonical backend entry point (Port 5001)
│
├── connector-agent/         # Standalone Windows Desktop Connector Agent
│   ├── dist/                # Pre-built executables (TallyConnectAgent.exe, Setup.exe)
│   ├── scripts/             # Executable build script (esbuild + pkg)
│   └── src/
│       ├── adapters/        # TallyPrime port 9000 XML protocol handlers
│       ├── engine/          # XML-to-JSON normalization schemas
│       ├── agent.js         # Daemon lifecycle & recovery logic
│       ├── cloudClient.js   # Authenticated client for Cloud API
│       ├── heartbeat.js     # 30-second telemetry reporter
│       ├── installer.js     # Windows activation setup wizard
│       ├── logger.js        # File-based operational logging (logs/)
│       ├── syncWorker.js    # Permission-respecting sync engine
│       ├── tallyClient.js   # Local TallyPrime port 9000 probe
│       ├── windowsService.js# Auto-start registry manager
│       └── index.js         # Canonical agent entry point
│
├── sdk/                     # Official SaaS Developer SDK (Node.js & TypeScript)
│   ├── tallyConnect.js      # Public client class implementation
│   ├── tallyConnect.d.ts    # Complete TypeScript declaration file
│   └── index.js             # Package entry point
│
├── docs/                    # Technical & Architectural Documentation
│   ├── ARCHITECTURE.md      # Comprehensive system design & diagrams
│   ├── SAAS_DEVELOPER_QUICKSTART.md # External SaaS integration tutorial
│   ├── TERMINOLOGY.md       # Standardized project terms & definitions
│   └── internal/            # Engineering specifications, runbooks, and pilot archives
│
├── tests/                   # Modular test suites categorized by domain
│   ├── architecture/        # 14-check system architecture regression test
│   ├── external-saas/       # End-to-end 25-check public developer suite
│   ├── security/            # Multi-tenant isolation & rate limiting
│   ├── integration/         # Sync engine, customer experience, dev portal
│   ├── agent/               # Agent daemon, heartbeat, reboot resilience
│   ├── real-tally/          # Zero-mock TallyPrime XML protocol extraction
│   └── release/             # Production deployment & release readiness test
│
├── legacy/                  # Archived historical test suites and legacy code
│
└── package.json             # Root workspace manifest
```

---

## Local Development Setup

### 1. Prerequisites
- **Node.js**: v18 or higher
- **MySQL**: 8.x running locally on port 3306
- **TallyPrime** (optional for mock testing, required for real extraction): Enabled on port 9000

### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..

# Install agent dependencies
cd connector-agent && npm install && cd ..
```

### 3. Environment Configuration
Copy the `.env.example` file and configure your database credentials:
```bash
cp .env.example .env
```

Key environment variables:
- `PORT=5001`: Cloud server listening port
- `MYSQL_HOST=localhost`: MySQL database host
- `MYSQL_USER=root`: MySQL username
- `MYSQL_PASSWORD=root`: MySQL password
- `MYSQL_DATABASE=tally_connect`: MySQL database name
- `CONNECTOR_MODE=xml_http`: Strictly real Tally XML HTTP mode

---

## Running the Cloud Server

```bash
# Start backend in production-ready mode
node server/src/index.js

# Or start in watch mode for development
npm --prefix server run dev
```

Server endpoints:
- **Base URL**: `http://localhost:5001`
- **Health Check**: `GET http://localhost:5001/api/health`
- **Readiness Check**: `GET http://localhost:5001/ready`
- **Interactive Documentation**: `GET http://localhost:5001/api/docs`

---

## Running the Desktop Agent

```bash
# Run the agent daemon locally
node connector-agent/src/index.js

# Run the interactive customer setup wizard
node connector-agent/src/installer.js
```

---

## Building the Windows Executable

To compile the desktop agent into zero-dependency standalone `.exe` binaries:

```bash
node connector-agent/scripts/build.js
```

This compiles:
1. `connector-agent/dist/agent-bundle.cjs`: Standalone JavaScript bundle.
2. `connector-agent/dist/TallyConnectAgent.exe`: Standalone Windows background daemon.
3. `connector-agent/dist/TallyConnectAgentSetup.exe`: Standalone Windows setup wizard.

---

## Running Automated Tests

Run any organized test suite from the project root using `npm` or `node`:

```bash
# Run architecture regression suite
npm test

# Run full active test battery
npm run test:all

# Specific test domain runners:
npm run test:architecture      # Phase 13 14-check refactor regression test
npm run test:saas              # External SaaS Developer 25-check validation suite
npm run test:security          # Multi-tenant security hardening & key isolation
npm run test:integration       # Sync engine, customer experience, dev portal
npm run test:agent             # Agent daemon, heartbeat, reboot recovery test
npm run test:release           # Phase 11 production release readiness test
npm run test:real-tally        # Zero-mock TallyPrime XML protocol extraction
```

---

## Real TallyPrime Testing

To test against live TallyPrime on Windows:
1. Open TallyPrime.
2. Press **F1 (Help) → Settings → Connectivity**.
3. Set **TallyPrime acts as** to **Both** or **Server**.
4. Set **Port** to **9000**.
5. Load your active company in TallyPrime.
6. Run:
   ```bash
   node tests/real-tally/real-tally-extraction.test.js
   ```

---

## Developer Integration & SDK

External SaaS developers integrate using the official SDK:

```bash
npm install tally-connect-sdk
```

```javascript
import { TallyConnect } from 'tally-connect-sdk';

const tally = new TallyConnect({
  apiKey: 'tc_live_your_api_key_here',
  baseUrl: 'https://api.tallyconnect.cloud'
});

// 1. Create a customer connection session
const session = await tally.createConnection({
  appId: 'app_your_app_id',
  externalUserId: 'user_12345',
  companyName: 'Acme Enterprises'
});

console.log('Customer Activation Code:', session.activationCode); // e.g. TC-4829

// 2. Poll connection status
const status = await tally.getConnectionStatus(session.connectionId);

// 3. Query permitted customer accounting data
const customers = await tally.getCustomers(session.connectionId);
console.log('Synchronized Customers:', customers);
```

For full integration instructions, see [docs/SAAS_DEVELOPER_QUICKSTART.md](docs/SAAS_DEVELOPER_QUICKSTART.md).
