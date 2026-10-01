# Tally Connect — Architecture & System Design
**Document Version:** 1.0.0  
**Target Audience:** Software Architects, SaaS Engineers, Integration Leads  
**Date:** October 2026  

---

## 1. System Vision & Problem Statement

TallyPrime is the dominant accounting software across India and Southeast Asia, but it runs as an on-premise desktop application listening on a local loopback port (`http://127.0.0.1:9000`). It has:
- No native public cloud connectivity
- No cloud authentication mechanism
- No multi-tenant data isolation
- No public webhook infrastructure
- Complex, undocumented XML / TDL query syntax

**Tally Connect** solves this by acting as a secure, bi-directional cloud integration layer. It allows SaaS applications to query TallyPrime data via standard REST APIs, receive real-time webhooks, and manage customer connections using a simple 6-character activation code.

---

## 2. End-to-End Runtime Architecture

```text
┌────────────────────────┐
│   SaaS Application     │
│ (Fintech / ERP / CRM)  │
└───────────┬────────────┘
            │
            │ 1. Create Session (`POST /api/connect/session`)
            │ 2. Displays Activation Code ("TC-7837") to Customer
            ▼
┌────────────────────────────────────────────────────────┐
│              Tally Connect Cloud (REST API)            │
│  - Multi-tenant Isolation                              │
│  - API Key & Secret Validation (`x-api-key`)           │
│  - Customer Permission Enforcement                     │
│  - MySQL Entity Cache & Sync Queue                     │
└───────────┬────────────────────────────────────────────┘
            │
            │ 3. Agent Activates with Code (`POST /api/agent/activate`)
            │ 4. Outbound HTTPS Heartbeats & Task Polling
            ▼
┌────────────────────────────────────────────────────────┐
│             Customer Windows Host Machine              │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │     TallyConnectAgent.exe (Background Daemon)  │   │
│   │  - Config & Token Storage                      │   │
│   │  - TDL XML Generation & Querying               │   │
│   │  - Local Data Normalization                    │   │
│   └───────────────────────┬────────────────────────┘   │
│                           │                            │
│                           │ 5. HTTP POST (TDL XML)     │
│                           │    Port 9000               │
│                           ▼                            │
│   ┌────────────────────────────────────────────────┐   │
│   │           TallyPrime (Desktop Software)        │   │
│   │  - Active Company Ledger Data                  │   │
│   │  - Inventory & Stock Balances                  │   │
│   │  - Sales & Purchase Orders                     │   │
│   └────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

---

## 3. Core Domain Entities & Capabilities

### Master Data
1. **Party Details (Customers & Vendors):**  
   - Extracted from `Sundry Debtors` and `Sundry Creditors` ledger groups.
   - Normalized with GSTIN, PAN, credit limit, phone, email, billing address, and bank account details.
   - Available via `GET /api/v1/customers` and `GET /api/v1/vendors`.
2. **Chart of Accounts (Ledgers & Groups):**  
   - Master account hierarchy, parent groups, opening balances, closing balances, and classification.
   - Available via `GET /api/v1/ledgers`.
3. **Inventory Masters (Stock Items, Groups, Godowns):**  
   - Stock items, base units of measure (UOM), alternate units, standard pricing, stock groups, and physical godown/warehouse locations.
   - Available via `GET /api/v1/inventory`.

### Transactional & Balance Data
1. **Sales Register & Invoices:**  
   - Sales vouchers, voucher numbers, buyer name, GST breakup (CGST, SGST, IGST), line items, and invoice dates.
   - Available via `GET /api/v1/sales`.
2. **Unsettled Orders:**  
   - Open Sales Orders and Purchase Orders with pending delivery quantities and fulfillment status.
   - Available via `GET /api/v1/orders`.
3. **Delivery & Receipt Notes:**  
   - Goods receipt and dispatch vouchers.
   - Available via `GET /api/v1/delivery-notes` and `GET /api/v1/receipt-notes`.
4. **Trial Balance:**  
   - Consolidated accounting trial balance with debit/credit closing totals.
   - Available via `GET /api/v1/trial-balance`.

---

## 4. Multi-Tenant Security & Permission Governance

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Security Layer Boundaries                       │
├────────────────────────────────┬───────────────────────────────────────┤
│ BOUNDARY                       │ MECHANISM                             │
├────────────────────────────────┼───────────────────────────────────────┤
│ SaaS Developer Authentication  │ `x-api-key: tc_live_...`               │
│ Connection Tenant Isolation    │ `x-connection-id: conn_...`            │
│ Desktop Agent Authentication   │ `x-agent-token: agt_tok_...` (HMAC)   │
│ Customer Data Privacy Consent  │ `customer_permissions` (Boolean Flags)│
│ Webhook Integrity Verification │ `X-Tally-Signature: <hmac-sha256>`     │
│ Rate Limiting & DoS Guard      │ Sliding-window per-client bucket      │
└────────────────────────────────┴───────────────────────────────────────┘
```

### Server-Side Permission Enforcement (Zero Trust)
Tally Connect enforces customer data privacy **on the server**:
1. When a connection is created, all permissions default to `true` (or customer-selected subsets).
2. The customer or SaaS can adjust permissions at any time via `POST /api/connect/:id/permissions`:
   ```json
   {
     "allow_customers": true,
     "allow_vendors": true,
     "allow_sales": true,
     "allow_inventory": false
   }
   ```
3. Before syncing, the agent requests active permissions. If an entity is denied, the agent skips Tally extraction.
4. **Independent Server Validation:** Even if an agent uploads disabled data or cached records exist in MySQL, any API request for a denied entity is rejected immediately with `HTTP 403 Forbidden`:
   ```json
   {
     "success": false,
     "error": "Permission denied."
   }
   ```

---

## 5. Webhook System & Cryptographic Signature Verification

When background sync jobs complete or desktop agent status changes, the cloud delivers an HTTP POST notification to the SaaS developer's configured webhook endpoint.

Every webhook payload is signed with the SaaS application's `api_secret` using **HMAC-SHA256**:
- **Header:** `X-Tally-Signature: <64-hex-digest>`
- **Header:** `X-Tally-Event: sync.completed`
- **Header:** `X-Tally-Attempt: 1`
- **Verification Logic:**
  ```javascript
  import { TallyConnect } from '@tallyconnect/sdk';

  // Verify HMAC-SHA256 signature
  const isValid = TallyConnect.verifyWebhookSignature(rawBody, headerSignature, apiSecret);
  ```
  *(Built directly into `TallyConnect.verifyWebhookSignature` in the official SDK).*

---

## 6. Failure Recovery & Error Catalog

| Error Code | Meaning | User-Facing Actionable Guidance |
|:---|:---|:---|
| `TALLY_NOT_RUNNING` | Agent cannot connect to port 9000 | Ensure TallyPrime is open on the host machine. |
| `COMPANY_NOT_OPEN` | Tally is running, but no company is selected | Open your accounting company in TallyPrime. |
| `INVALID_ACTIVATION_CODE` | Code does not exist or expired | Generate a fresh activation code from your SaaS portal. |
| `PERMISSION_DENIED` | Customer opted out of sharing this entity | Request customer consent to enable this data category. |
| `CONNECTION_OFFLINE` | Desktop agent has not reported heartbeat | Verify the Windows host is powered on and connected to internet. |
| `INVALID_API_KEY` | Missing or revoked developer credential | Rotate or re-issue your API key in the Developer Portal. |
