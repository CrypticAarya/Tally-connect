# Tally Connect Customer Pilot: Desktop Agent Installation Checklist

Welcome to the **Tally Connect Beta Customer Pilot**. This checklist guides IT administrators and accounting managers through installing and provisioning the Tally Connect Desktop Agent on the Windows host machine running TallyPrime.

---

## 1. System Requirements

Ensure the host machine satisfies the following prerequisites:

| Requirement | Specification | Verification Command / Step |
| :--- | :--- | :--- |
| **Operating System** | Windows 10, Windows 11, or Windows Server 2016+ (64-bit) | `winver` |
| **Hardware** | Minimum 4 GB RAM (8 GB recommended for >100k voucher books) | Task Manager |
| **Network** | Outbound HTTPS access to `https://api.tallyconnect.cloud` (or port 5001/5002 in staging) | `curl -I https://api.tallyconnect.cloud/api/health` |
| **Tally Version** | TallyPrime 2.0 or higher (TallyPrime 3.x / 4.x recommended) | Help → About in TallyPrime |
| **Permissions** | Administrator privileges on the Windows machine | Right-click executable → "Run as administrator" |

---

## 2. Pre-Installation Preparation

1. **Obtain Connector Credentials**:
   - Log into your Tally Connect Dashboard: `https://app.tallyconnect.cloud` (or local port `5173`).
   - Navigate to **Connectors** → **+ Provision New Connector**.
   - Note your credentials:
     - `Connector ID`: e.g. `conn_apex_logistics_01`
     - `Secret Token`: e.g. `sec_beta_a8f9c2...`
   > [!IMPORTANT]
   > The secret token is only displayed once upon generation. Save it in your enterprise password manager.

2. **Download the Agent**:
   - Download `TallyConnectAgentSetup.exe` directly from the Dashboard button: **Download Agent (.exe)**.
   - Alternatively, download via CLI:
     ```powershell
     Invoke-WebRequest -Uri "https://api.tallyconnect.cloud/api/agent/download" -OutFile "TallyConnectAgentSetup.exe"
     ```

---

## 3. Installation Steps

### Option A: Automated CLI Installation (Recommended)
Open Windows PowerShell as Administrator and run:
```powershell
.\TallyConnectAgentSetup.exe --connector-id "YOUR_CONNECTOR_ID" --secret "YOUR_SECRET_TOKEN"
```

### Option B: Interactive Setup Wizard
1. Double-click `TallyConnectAgentSetup.exe`.
2. Accept the software license agreement and select destination folder (default: `C:\Program Files\TallyConnectAgent`).
3. Enter your **Connector ID** and **Secret Token** when prompted.
4. Click **Test Cloud Connectivity**. A green checkmark confirms authentication.
5. Click **Install as Windows Background Service**.

---

## 4. Post-Installation Verification Checklist

- [ ] **Windows Service Running**: Open `services.msc` and verify `TallyConnectAgentService` status is **Running** with Startup Type set to **Automatic**.
- [ ] **Log File Initialized**: Check `C:\Program Files\TallyConnectAgent\logs\agent.log` for:
  ```text
  ✔ Connector registered successfully with cloud backend
  ✔ Telemetry heartbeat acknowledged (Status: ONLINE)
  ```
- [ ] **Dashboard Check**: Return to the Tally Connect Dashboard. In the **Connectors** tab, your machine should display:
  - **Status**: `ONLINE`
  - **Last Seen**: `< 30s ago`
  - **Health**: `Operational`
