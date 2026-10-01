# Tally Connect — 5-Minute SaaS Developer Live Demo Script

**Purpose:** Use this script to demonstrate Tally Connect live to an external SaaS CTO, Engineering Lead, or Product Manager.  
**Total Running Time:** 5 Minutes  
**Format:** Screen-by-Screen walkthrough with exact speaker prompts and click actions.

---

## Pre-Demo Checklist (1 Minute Before Call)
- [ ] Browser open with developer playground or terminal: `http://localhost:5001/api/docs`
- [ ] Windows Agent setup wizard ready: `connector-agent/dist/TallyConnectAgentSetup.exe`
- [ ] Local TallyPrime open with sample company loaded (or test XML server running)
- [ ] Terminal open listening for webhooks (e.g. `nc -l 5096` or webhook logger)

---

## STEP 1: The Problem & The Solution (30 Seconds)

**Show:**  
Your browser showing a mock SaaS dashboard with a simple **"Connect TallyPrime"** button.

**Say:**  
> *"Over 2 million businesses in India run their daily accounting on desktop TallyPrime. But connecting your cloud SaaS to Tally usually requires writing nightmare XML/TDL queries, opening inbound firewall ports on client routers, or hiring Windows consultants.*  
> *With Tally Connect, your customer connects their local Tally in 60 seconds with a single 6-character code, and your SaaS receives clean JSON REST APIs and webhooks. Let me show you how it works."*

---

## STEP 2: Initiate Connection & Generate Code (45 Seconds)

**Show:**  
Click **"Connect Tally"** in the UI, or execute the session creation request in your terminal:
```bash
curl -X POST http://127.0.0.1:5001/api/connect/session \
  -H "Content-Type: application/json" \
  -d '{"app_id":"app_demo","external_user_id":"tenant_101","company_name":"Acme Traders"}'
```

**Show on Screen:**
- `connection_id`: `conn_mupb...`
- `activation_code`: `TC-7837`
- Modal popup displaying the code: **`TC-7837`** and a download link.

**Say:**  
> *"Your SaaS backend makes a single POST request to `/api/connect/session` or calls `connectTally()` using our Node.js SDK. In response, you get a temporary 6-character code—here it is: `TC-7837`—valid for 30 minutes. You show this code to your customer in your onboarding modal."*

---

## STEP 3: The Customer Windows Experience (60 Seconds)

**Show:**  
Launch `TallyConnectAgentSetup.exe` on the Windows machine.  
Type in the activation code: `TC-7837`. Click **Next**.

**Show on Screen:**
- Step 1: Connecting to cloud service... ✔
- Step 2: Checking TallyPrime... ✔
- Step 3: Verifying code... ✔ Connected Company: *"Apex Industrial Technologies Ltd"*
- Step 4: Saving secure settings... ✔
- Step 5: Setting up automatic startup... ✔

**Say:**  
> *"Your customer downloads our lightweight Windows executable—no Node.js or Python needed. They enter the 6-character code and click Next. The agent immediately handshakes with Tally Connect Cloud over outbound HTTPS, binds to their local TallyPrime, and registers as a background Windows service. Notice: no port forwarding, no static IP, zero network configuration."*

---

## STEP 4: TallyPrime Detection (30 Seconds)

**Show:**  
Switch to the active TallyPrime window. Point to the Gateway of Tally showing company *"Apex Industrial Technologies Ltd"*.

**Say:**  
> *"The agent communicates locally with TallyPrime on loopback port 9000 using native XML protocols. It identifies the active open company, checks compatibility, and reports status back to the cloud."*

---

## STEP 5: Customer Permissions (30 Seconds)

**Show:**  
Show the Customer Permission settings screen or API call (`GET /api/connect/:id/permissions`).  
Show checkboxes:
- [x] Customers (Sundry Debtors)
- [x] Vendors (Sundry Creditors)
- [x] Sales Invoices
- [ ] Inventory (Disabled)

**Say:**  
> *"Customers demand data privacy. Here, the customer chooses exactly what they want to share. If they disable Inventory, our server strictly rejects any SaaS attempt to read inventory with a 403 Forbidden error. The agent will never even upload it. This builds tremendous trust with conservative CFOs."*

---

## STEP 6: Trigger Synchronization (30 Seconds)

**Show:**  
Click **"Sync Now"** in the dashboard, or call:
```bash
curl -X POST http://127.0.0.1:5001/api/connect/conn_mupb.../sync \
  -H "x-api-key: tc_live_your_key"
```

**Say:**  
> *"Sync can run on a schedule or be triggered instantly via our API. When triggered, the background agent executes optimized TDL queries, extracts customer and sales records, and uploads clean normalized JSON to the cloud cache."*

---

## STEP 7: Fetch Normalized JSON Data (45 Seconds)

**Show:**  
Query the REST API or run the SDK call:
```bash
curl -s http://127.0.0.1:5001/api/v1/customers \
  -H "x-api-key: tc_live_your_key" \
  -H "x-connection-id: conn_mupb..." | jq
```

**Show on Screen:**
```json
[
  {
    "id": "cust-pioneer-1001",
    "name": "Pioneer Engineering Solutions",
    "parent": "Sundry Debtors",
    "gstin": "27AABCP1234A1Z5",
    "closing_balance": -45000.00,
    "state": "Maharashtra",
    "credit_limit": 100000.00
  }
]
```

**Say:**  
> *"And here is the magic. Your SaaS gets instant, paginated, clean JSON. You didn't write a single line of TDL, you didn't parse raw XML dates like '20260401', and you didn't have to handle Windows network timeouts. You get standardized parties, invoices, and chart of accounts ready to populate your CRM or ERP."*

---

## STEP 8: Real-Time Webhooks (30 Seconds)

**Show:**  
Terminal showing the incoming HTTP POST webhook event:
```json
{
  "event": "sync.completed",
  "app_id": "app_demo",
  "timestamp": 1727784000000,
  "data": {
    "connection_id": "conn_mupb...",
    "company_name": "Apex Industrial Technologies Ltd",
    "status": "COMPLETED",
    "records_synced": 482
  }
}
```
Show the header: `X-Tally-Signature: sha256=...`

**Say:**  
> *"When sync finishes, our cloud fires an HMAC-SHA256 signed webhook directly to your server. Your backend verifies the signature with one SDK line (`TallyConnect.verifyWebhookSignature`), refreshes your UI, and your users see their live numbers immediately."*

---

## STEP 9: What You Actually Need to Build (30 Seconds)

**Show:**  
Show the summary table:

| SaaS Developer Builds (You) | Tally Connect Handles (Us) |
|---|---|
| • "Connect Tally" button & modal | • Windows Agent (.exe installer) |
| • Save `connectionId` in your DB | • Tally XML / TDL queries |
| • Query REST API / SDK | • Server-side permission guards |
| • Handle webhook notifications | • Outbound HTTPS cloud sync & retries |

**Say:**  
> *"To summarize: you build a Connect button, save the connection ID, and consume our JSON API or SDK. We handle the Windows installer, TallyPrime extraction, retry engine, permissions, and cloud syncing.*  
> *You can have your first customer connected in an afternoon. Let me share our 10-minute Quickstart guide and SDK with your team."*
