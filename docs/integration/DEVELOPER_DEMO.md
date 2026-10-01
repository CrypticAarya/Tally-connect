# Tally Connect — SaaS Developer Integration Guide

> **"I am a SaaS developer. How do I integrate Tally Connect into my SaaS?"**

This guide provides the complete, production-ready walkthrough for external SaaS engineering teams integrating **Tally Connect**. It uses real endpoints, live SDK methods, and copy-pasteable code examples.

---

## 1. What I Integrate (SaaS Developer Responsibilities)

As a SaaS developer, you only write standard cloud web application code:

1. **"Connect Tally" UI / Button:** A modal or settings page in your dashboard where customers initiate connection.
2. **Customer-to-Connection Mapping:** Storing `connection_id` alongside your internal `customer_id` or `tenant_id` in your database.
3. **Secure API Credential Storage:** Storing your `api_key` and `api_secret` in server environment variables.
4. **Connection Status Display:** Showing your customer their live connection state (`PENDING`, `ACTIVE`, `OFFLINE`).
5. **Data Consumption:** Reading normalized accounting entities via standard REST API or the Node.js SDK.
6. **Webhook Endpoint:** An HTTP POST route in your backend receiving `sync.completed` events.
7. **SaaS-Side Error Handling:** Graceful retry and UI feedback if a customer's Tally is closed or a permission is disabled.

---

## 2. What Tally Connect Handles

Tally Connect eliminates all desktop Windows and TallyPrime complexity:

- **Windows Agent:** A lightweight, zero-dependency standalone executable (`TallyConnectAgent.exe` / `TallyConnectAgentSetup.exe`).
- **TallyPrime Communication:** Local loopback communication with TallyPrime on port 9000.
- **XML / TDL Query Generation:** Automatically generating and executing complex TDL collection definitions.
- **Data Transformation:** Parsing raw Tally XML into clean, normalized JSON schemas.
- **Permission Enforcement:** Server-side 403 access control ensuring customers retain complete data ownership.
- **Sync Jobs & Heartbeats:** Reliable background job queue with exponential backoff and recovery.
- **Cloud Entity Cache:** Fast, paginated MySQL 8.0 cache of accounting datasets.
- **Multi-Tenant REST API:** Secure endpoints (`/api/v1/*`) protected by your live API key.
- **HMAC-SHA256 Webhooks:** Cryptographically signed real-time webhook dispatching.

---

## 3. Architecture

The integration architecture is strictly **outbound-only**:

```text
SaaS Backend
    ↓ (1) POST /api/connect/session (or SDK connectTally)
Tally Connect Cloud
    ↓ (2) Returns Activation Code (e.g. "TC-7837")
Customer UI (Browser)
    ↓ (3) Customer enters code into TallyConnectAgent.exe
Windows Desktop Agent
    ↓ (4) Connects to local TallyPrime (http://127.0.0.1:9000)
    ↓ (5) Extracts permitted entities via TDL XML
    ↓ (6) Uploads normalized JSON to Cloud over TLS
Tally Connect Cloud (MySQL Cache)
    ↓ (7) REST API (/api/v1/*) & Signed Webhooks (X-Tally-Signature)
SaaS Backend
```

Customers never need static IP addresses, VPNs, or inbound firewall port-forwarding.

---

## 4. Create a Connection

When a customer clicks "Connect Tally", your backend requests an activation session from Tally Connect Cloud.

### Using the Node.js SDK
```javascript
import { connectTally } from '@tallyconnect/sdk';

// In your SaaS backend route: POST /api/integrations/tally/connect
export async function createTallySession(req, res) {
  const currentCustomerId = req.user.tenantId; // e.g. "cust_9981"
  const customerCompanyName = req.user.companyName; // e.g. "Acme Traders"

  const session = await connectTally({
    appId: process.env.TALLY_CONNECT_APP_ID,
    userId: currentCustomerId,
    companyName: customerCompanyName,
    baseUrl: process.env.TALLY_CONNECT_API_URL || 'https://api.tallyconnect.cloud'
  });

  // Save session.connectionId to your customer's record in your database
  await db.customers.update({
    where: { id: currentCustomerId },
    data: { tallyConnectionId: session.connectionId }
  });

  // Return activation code and agent download link to frontend
  res.json({
    connectionId: session.connectionId,
    activationCode: session.activationCode, // e.g. "TC-7837"
    expiresAt: session.expiresAt,
    downloadUrl: `${process.env.TALLY_CONNECT_API_URL}/api/agent/download`
  });
}
```

### Direct HTTP Request
```http
POST /api/connect/session HTTP/1.1
Host: api.tallyconnect.cloud
Content-Type: application/json

{
  "app_id": "app_your_app_id",
  "external_user_id": "cust_9981",
  "company_name": "Acme Traders"
}
```

---

## 5. Show Activation Code to Customer

Your frontend modal displays the single-use 6-character code and download link:

```html
<!-- Example Frontend Modal (React / Vanilla HTML) -->
<div class="connect-tally-modal">
  <h3>Link Your TallyPrime Company</h3>
  <p>Step 1: Download and install the connector agent on the Windows PC running Tally.</p>
  <a href="/download-agent" class="btn-download">Download TallyConnectAgentSetup.exe</a>

  <p>Step 2: Enter this single-use activation code when prompted:</p>
  <div class="code-box">TC-7837</div>
  <span class="expiry-note">Code expires in 30 minutes</span>
</div>
```

---

## 6. Customer Installs Windows Agent

The customer runs `TallyConnectAgentSetup.exe`:
1. The wizard opens with a simple greeting.
2. The customer enters the 6-character code (`TC-7837`).
3. The agent handshakes with Tally Connect Cloud over outbound HTTPS.
4. The agent detects active companies on `http://127.0.0.1:9000`.
5. The activation code is immediately consumed (replay-proof), and an ongoing `agentToken` is stored securely on the customer machine.
6. The agent installs as a silent background Windows daemon starting with Windows boot.

---

## 7. Customer Grants Permissions

Customer privacy is enforced **server-side**. The customer selects which entities your app is permitted to read:

- **Customers** (`customers`): Sundry Debtors
- **Vendors** (`vendors`): Sundry Creditors
- **Ledgers** (`ledgers`): Chart of Accounts
- **Sales Invoices** (`sales`): Invoices and line items
- **Inventory** (`inventory`): Stock items, groups, units, godowns
- **Orders** (`orders`): Sales orders & purchase orders
- **Challans** (`delivery_notes`, `receipt_notes`): Unsettled vouchers

```javascript
// Programmatically inspect or update permissions via SDK
import { TallyConnect } from '@tallyconnect/sdk';

const tally = new TallyConnect({
  apiKey: process.env.TALLY_CONNECT_API_KEY,
  baseUrl: process.env.TALLY_CONNECT_API_URL
});

// Check permissions
const { permissions } = await tally.getPermissions('conn_mupb...');
console.log('Customer permissions:', permissions);

// If an entity is disallowed (e.g. inventory: false), querying it returns HTTP 403:
// { "success": false, "error": "Permission denied." }
```

---

## 8. Detect Connection Status

Your backend or UI polls or listens for connection activation:

```javascript
const status = await tally.getStatus(connectionId);

console.log(status);
// {
//   "success": true,
//   "connection_id": "conn_mupb...",
//   "status": "ACTIVE",              // PENDING | ACTIVE | OFFLINE
//   "company_name": "Acme Traders",
//   "agent_status": "ONLINE",        // ONLINE | OFFLINE
//   "tally_status": "ONLINE",        // ONLINE | OFFLINE
//   "last_sync": "2026-10-01T10:00:00.000Z",
//   "permissions": { "customers": true, "sales": true, "inventory": false }
// }
```

---

## 9. Fetch Tally Data

Once status is `ACTIVE`, query cached accounting records with instant sub-50ms latency:

```javascript
// 1. Fetch Customers (Sundry Debtors)
const customers = await tally.getCustomers(connectionId);
customers.forEach(c => {
  console.log(`${c.name} | GSTIN: ${c.gstin} | Balance: ₹${c.closing_balance}`);
});

// 2. Fetch Sales Invoices
const sales = await tally.getSales(connectionId);

// 3. Fetch Inventory Stock Items
const stock = await tally.getInventory(connectionId);

// 4. Fetch Unsettled Orders
const salesOrders = await tally.getSalesOrders(connectionId);
const purchaseOrders = await tally.getPurchaseOrders(connectionId);

// 5. Trigger an on-demand sync cycle
await tally.syncNow(connectionId);
```

### Direct HTTP REST API
```http
GET /api/v1/customers?page=1&limit=50 HTTP/1.1
Host: api.tallyconnect.cloud
x-api-key: tc_live_your_api_key
x-connection-id: conn_your_connection_id
```

---

## 10. Receive Webhooks

Configure your `webhook_url` in the Developer Portal. Tally Connect sends an HTTP POST event whenever data changes or synchronization completes:

```http
POST /api/webhooks/tally HTTP/1.1
Host: your-saas.com
Content-Type: application/json
X-Tally-Signature: 8d1f2a3c4b5e...hmac-sha256...
X-Tally-Event: sync.completed
X-Tally-Attempt: 1

{
  "event": "sync.completed",
  "app_id": "app_your_app_id",
  "timestamp": 1727784000000,
  "data": {
    "connection_id": "conn_mupb...",
    "company_name": "Acme Traders",
    "status": "COMPLETED",
    "records_synced": 482
  }
}
```

---

## 11. Verify Webhook Signatures

Always verify webhook authenticity using your application's `api_secret`:

```javascript
import express from 'express';
import { TallyConnect } from '@tallyconnect/sdk';

const app = express();

// Capture raw body for signature verification
app.post(
  '/api/webhooks/tally',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const rawBody = req.body.toString('utf-8');
    const signature = req.headers['x-tally-signature'];
    const apiSecret = process.env.TALLY_CONNECT_API_SECRET;

    // Verify HMAC-SHA256 signature
    const isValid = TallyConnect.verifyWebhookSignature(rawBody, signature, apiSecret);
    if (!isValid) {
      console.error('Unauthorized webhook signature!');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = JSON.parse(rawBody);
    console.log(`Received verified webhook: ${payload.event} for connection ${payload.data.connection_id}`);

    if (payload.event === 'sync.completed') {
      // Invalidate your local cache or trigger data refresh
    }

    res.status(200).json({ received: true });
  }
);
```

---

## 12. Handle Failures

| Error Scenario | HTTP Status | Response Contract | Action to Take |
|:---|:---:|:---|:---|
| **Invalid API Key** | `401 / 403` | `{ "error": "Invalid API key" }` | Check `x-api-key` header in environment configuration. |
| **Permission Denied** | `403` | `{ "success": false, "error": "Permission denied." }` | Inform customer they have disabled this category in settings. |
| **Customer Tally Closed** | `200` | `status.tally_status: "OFFLINE"` | Display UI banner: *"TallyPrime is not open on the host PC."* |
| **Agent PC Powered Off** | `200` | `status.agent_status: "OFFLINE"` | Display UI banner: *"Desktop agent offline. Data reflects last sync."* |
| **Activation Code Expired**| `400 / 404`| `{ "error": "Activation code expired" }` | Click "Generate New Code" to start a fresh 30-minute session. |

---

## 13. Production Checklist

Before launching Tally Connect to your customers:

- [ ] **HTTPS:** Ensure all API calls use TLS (`https://api.tallyconnect.cloud`).
- [ ] **Secrets Management:** Keep `api_key` and `api_secret` in backend environment variables, never in frontend bundles.
- [ ] **Webhook Idempotency:** Webhooks may be retried up to 3 times; verify your webhook endpoint processes events idempotently.
- [ ] **Permission Fallbacks:** Ensure your UI gracefully handles disabled permission states.
- [ ] **Storage Mapping:** Store `connection_id` indexed by your internal tenant ID for sub-millisecond lookups.
- [ ] **Rate Limiting:** Tally Connect allows up to 120 req/min per API key; cache GET requests locally where appropriate.
