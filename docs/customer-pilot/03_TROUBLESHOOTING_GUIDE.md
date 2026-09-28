# Tally Connect Customer Pilot: Troubleshooting Guide

This guide provides rapid diagnostic steps for common issues encountered during customer pilot deployment.

---

## Issue 1: Connector Status Shows "OFFLINE" on Dashboard

### Symptoms:
- Dashboard status dot is red (`OFFLINE`).
- Telemetry card displays: `Timed out (>90s without pulse)`.

### Root Causes & Solutions:
1. **Desktop Agent Service Stopped**:
   - Open Windows Services (`services.msc`).
   - Locate **TallyConnectAgentService**.
   - If status is `Stopped`, right-click and click **Start**. Set Startup Type to **Automatic**.
2. **Outbound Internet Blocked**:
   - Check if outbound HTTPS traffic to `https://api.tallyconnect.cloud` is blocked by corporate firewall/proxy.
   - Run in PowerShell:
     ```powershell
     curl.exe -I https://api.tallyconnect.cloud/api/health
     ```
3. **Invalid Host System Time**:
   - Ensure the Windows machine time is synchronized via NTP (`time.windows.com`). An out-of-sync clock may cause heartbeat timestamps to appear delayed.

---

## Issue 2: TallyPrime Link Shows "DISCONNECTED"

### Symptoms:
- Dashboard shows Connector is `ONLINE`, but TallyPrime Link is red (`Port 9000 DISCONNECTED`).
- Active Company is blank or shows "Tally Closed".

### Root Causes & Solutions:
1. **TallyPrime is Not Running**:
   - Launch TallyPrime and open your target company.
2. **Connectivity Setting Disabled in TallyPrime**:
   - In TallyPrime, press `F1` (Help) → **Settings** → **Connectivity**.
   - Verify **TallyPrime act as** is set to `Both` or `Server`.
   - Verify **Port** is set to `9000`.
   - Save and restart TallyPrime.
3. **Port Conflict**:
   - Another process might be using port 9000 (e.g. SonarQube, PHP dev server).
   - Check what is listening on port 9000:
     ```powershell
     netstat -ano | findstr :9000
     ```
   - If another application occupies port 9000, change TallyPrime's port to `9001` and update `config.json` in `C:\Program Files\TallyConnectAgent\config.json`:
     ```json
     { "tallyPort": 9001 }
     ```

---

## Issue 3: Authentication Failed: Invalid Connector Secret

### Symptoms:
- Agent logs show: `Authentication failed: Invalid credentials for connector "conn_..."`.
- Connector fails to enroll or heartbeats are rejected with HTTP 401.

### Root Causes & Solutions:
1. **Credential Mismatch**:
   - The token in `config.json` does not match the hashed secret stored in the cloud database.
2. **Resolution**:
   - Go to Tally Connect Dashboard → **Connectors** → **+ Provision New Connector**.
   - Copy the newly issued `Connector ID` and `Secret Token`.
   - Update `config.json` and restart the agent service.

---

## Issue 4: Export Download Shows "Expired" (HTTP 410 Gone)

### Symptoms:
- Download button is disabled or clicking it returns `HTTP 410 Gone: Export download has expired`.

### Explanation & Resolution:
- For security and regulatory data hygiene, exported CSV files are retained for **7 calendar days**.
- To obtain fresh data, simply click **⚡ Export** in the Dashboard to trigger an immediate, updated export from your live TallyPrime instance.

---

## Issue 5: Locating Agent Diagnostic Logs

For in-depth diagnostics or when contacting Tally Connect support, collect local logs:

| Log File | Default Path | Contents |
| :--- | :--- | :--- |
| **Agent Operational Log** | `C:\Program Files\TallyConnectAgent\logs\agent.log` | Heartbeat telemetry, polling cycles, Tally queries |
| **Error Trace Log** | `C:\Program Files\TallyConnectAgent\logs\errors.log` | Network disconnects, XML parse errors, stack traces |

To view real-time logs in PowerShell:
```powershell
Get-Content -Path "C:\Program Files\TallyConnectAgent\logs\agent.log" -Wait -Tail 30
```
