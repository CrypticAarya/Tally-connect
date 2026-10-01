# Tally Connect — Windows Customer Installation & Testing Guide
**Version:** 1.0 (Phase 9 Customer Validation)  
**Audience:** Non-technical testers, business owners, accountants, finance managers  

---

## Welcome to Tally Connect!

Tally Connect is designed to connect your local **TallyPrime** to your cloud application in less than **60 seconds**.

You do **NOT** need to:
- ❌ Install Node.js or Python
- ❌ Open the Windows Command Prompt or Terminal
- ❌ Edit configuration files or code
- ❌ Understand APIs, ports, or JSON

Everything works with a single installer and a simple **6-character code** (like `TC-4829`).

---

## 📋 What You Need Before Starting

| Item | Description | Where to find it |
| :--- | :--- | :--- |
| **Windows PC** | Windows 10 or 11 (64-bit) | Your workstation |
| **TallyPrime** | TallyPrime 1.0 to 4.x running | Open on your PC with your Company loaded |
| **Installer File** | `TallyConnectAgentSetup.exe` | Downloaded from your SaaS portal |
| **Activation Code** | 6-character code (e.g. `TC-9555`) | Displayed on your SaaS "Connect Tally" screen |
| **Internet Connection** | Active broadband or Wi-Fi | Normal web browsing access |

---

## Step 1: Ensure TallyPrime is Open & Port 9000 is Active (1-Minute Check)

Before running the installer, make sure TallyPrime is ready to communicate:

1. Open **TallyPrime** and load your company (e.g., *Apex Industrial Technologies*).
2. Look at the top menu bar in TallyPrime:
   - Click **Help (F1)** → **Settings** → **Connectivity**.
3. Check the **Client/Server configuration**:
   - **TallyPrime is acting as:** Both (or Server)
   - **Port:** `9000`
4. If you had to change any setting, press **Enter** to save, then restart TallyPrime once.

> **💡 Tip:** Once configured, TallyPrime will remember this setting permanently. You won't need to do this again.

---

## Step 2: Download & Run `TallyConnectAgentSetup.exe`

1. Double-click the downloaded **`TallyConnectAgentSetup.exe`** file.
2. The setup wizard opens with a clean, friendly window:
   ```text
   ===============================================================
   📦 Tally Connect Agent — Windows Setup Wizard
   ===============================================================
   Welcome to Tally Connect! Connecting your TallyPrime in seconds.
   No technical configuration, command line, or config editing required.
   ```

---

## Step 3: Enter Your 6-Character Activation Code

1. Look at your cloud application's **"Connect Tally"** screen on your web browser.
2. You will see a unique activation code (Example: `TC-9555`).
3. Type or paste your code into the prompt:
   ```text
   Enter your 6-character activation code: TC-9555
   ```
4. Press **Enter**.

---

## Step 4: Watch the Automatic Verification

The setup wizard will now automatically perform 5 quick checks:

```text
[1/5] Checking connection to Tally Connect Cloud...
  ✔ Connected to Tally Connect Cloud

[2/5] Checking local TallyPrime availability...
  ✔ TallyPrime detected on port 9000 (3ms)
  ✔ Active Company: "Apex Industrial Technologies Pvt Ltd"

[3/5] Activating agent with cloud...
  ✔ Agent activated successfully!
  ✔ Connected Company: "Apex Industrial Technologies Pvt Ltd"

[4/5] Saving local configuration...
  ✔ Saved configuration securely

[5/5] Configuring Windows auto-start...
  ✔ Background auto-start registered

===============================================================
Connected Successfully.
Tally Connect is now linked to your company!
Agent is running silently in the background.
===============================================================
```

**That’s it!** The agent is now running silently in your Windows background. You can close the installer window.

---

## Step 5: Choose What Data You Want to Share (Permissions)

Go back to your cloud application screen in your browser. You will see the **Permission Selection** screen with checkboxes:

- ☑ **Customers** (Customer names, GSTINs, addresses, balances)
- ☑ **Vendors** (Supplier names, GSTINs, contact info)
- ☑ **Ledgers** (Chart of accounts and general ledgers)
- ☑ **Inventory** (Stock items, units of measure, warehouses/godowns)
- ☑ **Orders** (Sales Orders and Purchase Orders)
- ☐ **Delivery Notes** *(Optional / Unchecked)*
- ☐ **Receipt Notes** *(Optional / Unchecked)*

> **🔒 Privacy Guarantee:** Any box you leave unchecked will be **strictly blocked** by Tally Connect. The cloud application cannot access unchecked data under any circumstances.

Click **"Save Permissions"**.

---

## Step 6: Click "Sync Now"

1. On your SaaS screen, click the blue **"Sync Now"** button.
2. In a few seconds, the screen updates with your live Tally data:
   - Your customer directory with GST numbers
   - Your supplier list
   - Your current stock levels and inventory valuations
   - Your open sales orders and purchase orders
3. Check the numbers against your Tally screen to confirm accuracy.

---

## Step 7: Zero-Maintenance Testing (Verify Daily Resilience)

We recommend testing these three everyday scenarios to see how Tally Connect handles them automatically:

### Test A: Computer Restart (Reboot)
1. Restart your Windows PC as you normally do at the end of the day.
2. Once Windows starts up, do **not** run the installer again.
3. Open your cloud application dashboard in your web browser.
4. Notice that your connection status shows **Agent: ONLINE**.
   - *Why?* Tally Connect automatically starts with Windows in the background.

### Test B: Closing TallyPrime (Lunch / End of Day)
1. Close TallyPrime on your computer.
2. Check your SaaS application screen:
   - It will display a friendly badge: **"Tally Closed"** or **"Tally Not Running"**.
   - The application does not freeze or crash.
3. Open TallyPrime again.
4. Within 30 seconds, the badge turns back to green: **"Tally: ONLINE"**.
   - *Why?* The background agent continually monitors TallyPrime and reconnects the instant you reopen it.

### Test C: Internet / Wi-Fi Drop
1. Disconnect your PC from Wi-Fi or unplug your network cable for 1 minute.
2. Notice that the agent does not throw annoying pop-up errors on your screen.
3. Reconnect your Wi-Fi.
4. The agent automatically resumes syncing your data with zero manual intervention.

---

## ❓ Frequently Asked Questions & Troubleshooting

### Q1: The installer says "Cannot reach Tally Connect Cloud". What should I do?
- **Cause:** Your computer might be offline or a corporate firewall is blocking outbound web traffic.
- **Solution:** Make sure you can open standard websites in your browser (e.g. Google). If using a corporate proxy or VPN, ensure standard HTTPS access to the cloud server is allowed.

### Q2: The installer says "TallyPrime not detected on port 9000".
- **Cause:** TallyPrime is either not running or its internal connectivity port is turned off.
- **Solution:** 
  1. Make sure TallyPrime is open on your desktop with a company open.
  2. Press **F1 (Help) → Settings → Connectivity**.
  3. Verify that **Port** is set to `9000` and **TallyPrime is acting as** is set to `Both` or `Server`.

### Q3: My activation code expired.
- **Cause:** For security, activation codes expire after 30 minutes if unused.
- **Solution:** Refresh your cloud application screen and click **"Generate New Code"**. Enter the new `TC-XXXX` code into the installer.

### Q4: Does Tally Connect ask for my Tally administrator password or Vault password?
- **Answer:** **No, never.** Tally Connect uses local Windows loopback XML communication. It never stores, transmits, or asks for your Tally username or password.

---

## Customer Support & Verification Checklist

When reporting your test results back to the engineering team, confirm these items:

- [x] Installer ran cleanly without requiring administrator command prompt
- [x] 6-character code (`TC-XXXX`) connected immediately
- [x] Active company name correctly matched your open Tally company
- [x] Permission checkboxes accurately controlled which data appeared
- [x] "Sync Now" extracted accurate real accounting figures
- [x] Agent recovered automatically after rebooting the PC
- [x] Agent reconnected automatically when Tally was closed and reopened
