# Tally Connect — Windows Desktop Connector Agent

The **Tally Connect Desktop Agent** is a lightweight, standalone daemon that runs on a customer's Windows machine. It bridges local installations of **TallyPrime** (via HTTP XML port 9000) to the **Tally Connect Cloud API** without requiring public IP addresses, inbound port forwarding, or firewall modifications.

---

## Architecture Overview

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Customer Windows Host                           │
│                                                                        │
│   ┌────────────────────┐                   ┌───────────────────────┐   │
│   │     TallyPrime     │   Port 9000 (XML) │   TallyConnectAgent   │   │
│   │ (Accounting Soft)  │ ◄───────────────► │       (Daemon)        │   │
│   └────────────────────┘                   └───────────┬───────────┘   │
└────────────────────────────────────────────────────────┼───────────────┘
                                                         │ HTTPS (Outbound Only)
                                                         ▼
                                             ┌───────────────────────┐
                                             │  Tally Connect Cloud  │
                                             │     (REST API)        │
                                             └───────────────────────┘
```

---

## Key Operational Concepts

### 1. How the Agent Starts
The agent entry point is [`connector-agent/src/index.js`](file:///Users/eunoia/Desktop/Tally%20Connect/connector-agent/src/index.js).
- When launched without arguments, it searches for `config.json` in the current working directory or application directory.
- If `config.json` is missing or inactive, it automatically launches the interactive activation wizard ([`src/installer.js`](file:///Users/eunoia/Desktop/Tally%20Connect/connector-agent/src/installer.js)).
- If `config.json` exists and is marked `ACTIVE`, it starts the background daemon ([`src/agent.js`](file:///Users/eunoia/Desktop/Tally%20Connect/connector-agent/src/agent.js)).

### 2. How Activation Works
1. The customer initiates connection on their SaaS web app, which generates a 6-character code (e.g., `TC-7837`).
2. The customer runs `TallyConnectAgent.exe` (or `npm run install-wizard`).
3. The wizard prompts for the activation code.
4. The agent posts to `POST /api/agent/activate` with the code and local Tally metadata.
5. The cloud verifies the code, links the connection, and returns a secure `agentToken` (`agt_tok_...`).

### 3. How Credentials Are Stored
The agent saves connection settings locally in `config.json` within its installation directory:
```json
{
  "cloudUrl": "https://api.tallyconnect.cloud",
  "connectionId": "conn_...",
  "agentId": "agt_...",
  "agentToken": "agt_tok_...",
  "companyName": "Acme Hardware Ltd",
  "status": "ACTIVE",
  "activatedAt": "2026-10-01T12:00:00.000Z"
}
```
Credentials never leave the local machine except during authenticated API requests.

### 4. How It Communicates with Cloud
All communication is **outbound-only** over HTTPS using [`src/cloudClient.js`](file:///Users/eunoia/Desktop/Tally%20Connect/connector-agent/src/cloudClient.js). The cloud never makes inbound socket or HTTP connections to the customer machine. Requests include the headers:
- `x-connection-id`: Identifies the tenant connection.
- `x-agent-token`: Authenticates the desktop daemon.

### 5. How It Detects Tally
The agent queries `http://127.0.0.1:9000` using [`src/tallyClient.js`](file:///Users/eunoia/Desktop/Tally%20Connect/connector-agent/src/tallyClient.js):
- Sends an XML `<ENVELOPE>` containing `<STATICVARIABLES>` requesting `##SVCURRENTCOMPANY`.
- If TallyPrime responds with an active company name, Tally status is marked **ONLINE**.
- If connection is refused (ECONNREFUSED) or times out, status is marked **OFFLINE** (`TALLY_NOT_RUNNING`).

### 6. How It Extracts Data
Data extraction is handled by [`src/adapters/tallyXmlHttpAdapter.js`](file:///Users/eunoia/Desktop/Tally%20Connect/connector-agent/src/adapters/tallyXmlHttpAdapter.js):
- Uses [`src/adapters/tdlBuilder.js`](file:///Users/eunoia/Desktop/Tally%20Connect/connector-agent/src/adapters/tdlBuilder.js) to construct specialized Tally Definition Language (TDL) report requests.
- Executes HTTP POST with TDL payload to `http://127.0.0.1:9000`.
- Parses the XML response via [`src/adapters/xmlParser.js`](file:///Users/eunoia/Desktop/Tally%20Connect/connector-agent/src/adapters/xmlParser.js) into structured objects.

### 7. How Permissions Work
Customer privacy is enforced before extraction begins:
- The agent calls `GET /api/agent/permissions` via [`src/syncWorker.js`](file:///Users/eunoia/Desktop/Tally%20Connect/connector-agent/src/syncWorker.js).
- If the customer denied access to an entity (e.g., `allow_inventory = false`), the agent skips extraction entirely.
- Cloud validation provides a second layer of enforcement if an unauthorized sync is attempted.

### 8. How Sync Works
1. Immediate sync can be triggered from the SaaS API or scheduled periodically.
2. The agent polls for pending sync jobs or receives sync signals during heartbeats ([`src/jobProcessor.js`](file:///Users/eunoia/Desktop/Tally%20Connect/connector-agent/src/jobProcessor.js)).
3. [`src/syncWorker.js`](file:///Users/eunoia/Desktop/Tally%20Connect/connector-agent/src/syncWorker.js) extracts each permitted entity.
4. Extracted records are transformed into standardized JSON via [`src/engine/jsonTransformer.js`](file:///Users/eunoia/Desktop/Tally%20Connect/connector-agent/src/engine/jsonTransformer.js).
5. The agent uploads normalized payloads to `POST /api/agent/sync`.

### 9. How Heartbeat Works
Implemented in [`src/heartbeat.js`](file:///Users/eunoia/Desktop/Tally%20Connect/connector-agent/src/heartbeat.js):
- Fires every 30 seconds to `POST /api/agent/heartbeat`.
- Transmits agent health, Tally connectivity status, active company name, and local agent version.
- Allows cloud to track whether the customer's TallyPrime is currently running.

### 10. How Windows Startup Works
[`src/windowsService.js`](file:///Users/eunoia/Desktop/Tally%20Connect/connector-agent/src/windowsService.js) configures automatic startup:
- Creates a registry key under `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`.
- When Windows boots and the user logs in, `TallyConnectAgent.exe` starts silently in the background.

### 11. How Errors Are Logged
[`src/logger.js`](file:///Users/eunoia/Desktop/Tally%20Connect/connector-agent/src/logger.js) provides diagnostic logging:
- Console output with timestamps and severity levels.
- File logging written to `logs/agent.log` with automatic log rotation.
- Errors are normalized with helpful troubleshooting codes (`TALLY_NOT_RUNNING`, `INVALID_ACTIVATION_CODE`, etc.).

### 12. How the EXE Is Built
Compiled via [`connector-agent/scripts/build.js`](file:///Users/eunoia/Desktop/Tally%20Connect/connector-agent/scripts/build.js):
```bash
npm --prefix connector-agent run build
```
1. Bundles JavaScript source into a single standalone CommonJS bundle (`dist/agent-bundle.cjs`) using `esbuild`.
2. Packages the bundle into a standalone native Windows x64 binary (`dist/TallyConnectAgent.exe`) using `pkg`.
3. Requires zero Node.js installation on the customer's machine.

---

## Local Development & Testing

```bash
# Run agent in development mode
npm --prefix connector-agent start

# Run interactive activation wizard locally
npm --prefix connector-agent run install-wizard

# Compile standalone executable
npm --prefix connector-agent run build
```
