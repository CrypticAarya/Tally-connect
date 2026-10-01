# Tally Connect Customer Pilot: TallyPrime Setup Checklist

This document details how to configure **TallyPrime** to expose its standard local XML HTTP server so the desktop connector can extract data.

---

## 1. Enable TallyPrime Local XML Server

TallyPrime includes an internal HTTP server that listens for TDL/XML requests on a local TCP port (default: `9000`).

### Step-by-Step Configuration:
1. Open **TallyPrime** on the host machine.
2. In the top navigation bar, click **Help** (or press `F1`).
3. Navigate to **Settings** → **Connectivity**.
4. In the Connectivity Settings menu, set the following parameters:

| Setting Parameter | Required Value | Notes |
| :--- | :--- | :--- |
| **TallyPrime act as** | `Both` (or `Server`) | Allows TallyPrime to serve XML queries |
| **Enable ODBC** | `Yes` | Recommended for auxiliary querying |
| **Port** | `9000` | Must match connector agent `tallyPort` config |

5. Press `Ctrl + A` to save the configuration changes.
6. **Restart TallyPrime** for the connectivity settings to take effect.

---

## 2. Verify Port 9000 Availability

To confirm that TallyPrime's XML server is listening:

1. Open your web browser on the host machine and visit:
   ```text
   http://127.0.0.1:9000
   ```
2. You should see a response header confirming TallyPrime Server is running:
   ```html
   <html><head><title>Tally Server</title></head><body><h1>Tally Server is Running</h1></body></html>
   ```
3. Alternatively, test via Windows PowerShell:
   ```powershell
   Test-NetConnection -ComputerName 127.0.0.1 -Port 9000
   ```
   Output must show: `TcpTestSucceeded : True`

---

## 3. Active Company Verification

The connector extracts data from the **currently loaded/active company** in TallyPrime:

- [ ] Ensure the target company is loaded in TallyPrime (e.g. `National Trading Corporation` or your legal company name).
- [ ] Ensure the company name matches the company linked to your Tally Connect tenant.
- [ ] If using a multi-user TallyPrime Gold edition, ensure the host machine has read access to the shared company data directory.

---

## 4. Windows Firewall & Antivirus Whitelist

Because Tally Connect Desktop Agent and TallyPrime communicate strictly over local loopback (`127.0.0.1`), external inbound ports do **not** need to be opened to the internet.

However, local antivirus software (e.g. Windows Defender, McAfee, Quick Heal) must not block localhost socket connections:
- Allow inbound and outbound TCP traffic on port `9000` for loopback: `127.0.0.1`.
- Add an exception in Windows Defender Firewall:
  ```powershell
  New-NetFirewallRule -DisplayName "Tally XML Port 9000 Loopback" -Direction Inbound -LocalPort 9000 -Protocol TCP -Action Allow -RemoteAddress 127.0.0.1
  ```
