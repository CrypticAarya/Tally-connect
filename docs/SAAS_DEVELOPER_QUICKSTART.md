# Tally Connect — External SaaS Developer Quickstart Guide

This guide is designed for external SaaS developers integrating Tally Connect into their web or mobile applications.

With Tally Connect, your SaaS can read real-time, verified accounting data from your customers' local **TallyPrime** installations without handling XML, TDL, network firewalls, or desktop daemons.

---

## 1. What Tally Connect Does

Tally Connect bridges the gap between desktop accounting software (**TallyPrime**) and cloud SaaS applications:
1. Your customer installs a lightweight Windows desktop connector agent (**`TallyConnectAgentSetup.exe`**).
2. The agent connects to TallyPrime locally via its native port 9000 XML interface.
3. The customer authorizes which accounting entities (e.g., customers, sales, inventory) your application is allowed to read.
4. The agent synchronizes permitted data to the secure Tally Connect Cloud cache.
5. Your application queries standardized, clean JSON REST APIs and receives webhook notifications upon sync completion.

---

## 2. Architecture Overview

```
SaaS Platform Backend / SDK
            │
            ▼ (REST API / Webhooks: x-api-key, x-connection-id)
   Tally Connect Cloud Gateway
            ▲
            │ (TLS WebSocket / HTTPS: Agent Token)
  Tally Connect Windows Agent (Daemon)
            │
            ▼ (Local loopback: Port 9000 XML)
  Customer's TallyPrime (Local Company)
```

---

## 3. Developer Account & App Setup

### Step 1: Register as a Developer
Make an HTTP request to register your organization's developer account:

```http
POST /api/developer/register HTTP/1.1
Host: api.tallyconnect.io
Content-Type: application/json

{
  "name": "Alex Rivera",
  "email": "dev@fintechcorp.com",
  "password": "YourSecurePassword@2026"
}
```

**Response (HTTP 201):**
```json
{
  "success": true,
  "developer": {
    "id": "dev_mul381x_9812",
    "name": "Alex Rivera",
    "email": "dev@fintechcorp.com"
  },
  "token": "dev_tok_eyJkZXZlbG9wZXJJZCI6ImRldl8..."
}
```

Save the `token` to authenticate subsequent developer management operations.

### Step 2: Create Your SaaS Application
Register your application and configure your webhook URL:

```http
POST /api/developer/apps HTTP/1.1
Host: api.tallyconnect.io
Authorization: Bearer dev_tok_eyJkZXZlbG9wZXJJZCI6ImRldl8...
Content-Type: application/json

{
  "app_name": "Fintech Invoice Automation",
  "webhook_url": "https://api.fintechcorp.com/webhooks/tally"
}
```

**Response (HTTP 201):**
```json
{
  "success": true,
  "app": {
    "id": "app_mn619a_72bf01",
    "app_name": "Fintech Invoice Automation",
    "api_key": "tc_live_79a0f4c281e5491bb40d...",
    "api_secret": "sec_live_901c23eb12aa44f0...",
    "webhook_url": "https://api.fintechcorp.com/webhooks/tally",
    "status": "ACTIVE"
  }
}
```

Store your `api_key` and `api_secret` securely in your server environment variables.

---

## 4. Customer Onboarding & Connection Flow

### Step 3: Initiate a Customer Connection Session
When a customer clicks "Connect Tally" in your SaaS interface, your backend initiates a connection session:

```http
POST /api/connect/session HTTP/1.1
Host: api.tallyconnect.io
x-api-key: tc_live_79a0f4c281e5491bb40d...
Content-Type: application/json

{
  "app_id": "app_mn619a_72bf01",
  "external_user_id": "customer_tenant_9042",
  "company_name": "Apex Engineering Supplies Pvt Ltd",
  "callback_url": "https://fintechcorp.com/dashboard/tally"
}
```

**Response (HTTP 201):**
```json
{
  "success": true,
  "session_id": "conn_mul89a2_001943",
  "connection_id": "conn_mul89a2_001943",
  "activation_code": "TC-8491",
  "expires_at": "2026-10-01T13:20:00.000Z"
}
```

### Step 4: Show Activation Code to Customer
In your UI, instruct the customer:
1. Download **`TallyConnectAgentSetup.exe`**.
2. Run the installer on the Windows PC or Server running TallyPrime.
3. Enter the Activation Code: **`TC-8491`**.
4. The desktop agent automatically detects the open Tally company and activates.

---

## 5. Permission Governance

The customer controls what data your application can access. You can inspect or update these settings programmatically.

### View Permissions:
```http
GET /api/connect/conn_mul89a2_001943/permissions HTTP/1.1
Host: api.tallyconnect.io
x-api-key: tc_live_79a0f4c281e5491bb40d...
```

### Update Permissions:
```http
POST /api/connect/conn_mul89a2_001943/permissions HTTP/1.1
Host: api.tallyconnect.io
x-api-key: tc_live_79a0f4c281e5491bb40d...
Content-Type: application/json

{
  "permissions": {
    "customers": true,
    "vendors": true,
    "sales": true,
    "inventory": true,
    "ledgers": true,
    "orders": true,
    "trial_balance": true
  }
}
```

---

## 6. Check Connection Status & Trigger Sync

### Check Connection Health:
```http
GET /api/connect/conn_mul89a2_001943/status HTTP/1.1
Host: api.tallyconnect.io
x-api-key: tc_live_79a0f4c281e5491bb40d...
```

**Response (HTTP 200):**
```json
{
  "success": true,
  "connection_id": "conn_mul89a2_001943",
  "status": "ACTIVE",
  "company_name": "Apex Engineering Supplies Pvt Ltd",
  "agent_status": "ONLINE",
  "tally_status": "ONLINE",
  "last_sync": "2026-10-01T12:00:00.000Z",
  "permissions": {
    "customers": true,
    "vendors": true,
    "sales": true,
    "inventory": true,
    "ledgers": true,
    "orders": true,
    "trial_balance": true
  }
}
```

### Trigger Immediate Sync ("Sync Now"):
```http
POST /api/connect/conn_mul89a2_001943/sync HTTP/1.1
Host: api.tallyconnect.io
x-api-key: tc_live_79a0f4c281e5491bb40d...
```

---

## 7. Retrieving Accounting Data (`/api/v1/*`)

All `/api/v1/*` requests require:
1. **`x-api-key`**: Your application's API key.
2. **`x-connection-id`**: The target customer connection ID.

### Retrieve Customers:
```http
GET /api/v1/customers HTTP/1.1
Host: api.tallyconnect.io
x-api-key: tc_live_79a0f4c281e5491bb40d...
x-connection-id: conn_mul89a2_001943
```

**Response (HTTP 200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "cust-guid-00101",
      "name": "Apex Retail Enterprises Pvt Ltd",
      "gstin": "27AAACA1234D1Z5",
      "address": "Unit 402, Trade Tower, Lower Parel, Mumbai, Maharashtra, 400013"
    }
  ]
}
```

### Available Data Endpoints:
| Entity | Method | Path | Description |
| :--- | :---: | :--- | :--- |
| **Customers** | `GET` | `/api/v1/customers` | Sundry Debtors masters with addresses and GSTIN |
| **Vendors** | `GET` | `/api/v1/vendors` | Sundry Creditors masters with GSTIN |
| **Sales** | `GET` | `/api/v1/sales` | Sales invoices and line-item breakdowns |
| **Inventory** | `GET` | `/api/v1/inventory` | Stock items, closing quantities, and rates |
| **Stock Groups** | `GET` | `/api/v1/stock-groups` | Product and inventory categories |
| **Units** | `GET` | `/api/v1/units` | Units of measurement (NOS, KGS, etc.) |
| **Godowns** | `GET` | `/api/v1/godowns` | Warehouses and storage locations |
| **Ledgers** | `GET` | `/api/v1/ledgers` | General ledgers and Chart of Accounts |
| **Groups** | `GET` | `/api/v1/groups` | Accounting parent groups hierarchy |
| **Cost Centers**| `GET` | `/api/v1/cost-centers` | Cost centres and division allocations |
| **Sales Orders**| `GET` | `/api/v1/sales-orders` | Unfulfilled and fulfilled sales orders |
| **Purchase Orders**| `GET`| `/api/v1/purchase-orders`| Purchase orders placed with suppliers |
| **Delivery Notes**| `GET`| `/api/v1/delivery-notes` | Delivery challans |
| **Receipt Notes** | `GET`| `/api/v1/receipt-notes` | Goods Receipt Notes (GRN) |
| **Trial Balance**| `GET` | `/api/v1/trial-balance` | Trial balance debits, credits, and closing |

---

## 8. Receiving & Verifying Webhooks

Tally Connect notifies your server whenever data finishes synchronizing.

### Incoming Webhook Request:
```http
POST /webhooks/tally HTTP/1.1
Host: api.fintechcorp.com
Content-Type: application/json
X-Tally-Event: sync.completed
X-Tally-Signature: sha256=4f6a8e8b91f0a2c5d6e7f8a9...
X-Tally-Attempt: 1

{
  "event": "sync.completed",
  "app_id": "app_mn619a_72bf01",
  "timestamp": "2026-10-01T12:05:00.000Z",
  "data": {
    "connection_id": "conn_mul89a2_001943",
    "company_name": "Apex Engineering Supplies Pvt Ltd",
    "entity_type": "customers",
    "count": 120,
    "job_id": "job_c101"
  }
}
```

### Signature Verification (Node.js):
```javascript
import crypto from 'crypto';

export function verifyWebhook(rawBody, signatureHeader, apiSecret) {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }
  const cleanSignature = signatureHeader.slice(7).trim();
  const bodyString = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);

  const expectedSignature = crypto
    .createHmac('sha256', apiSecret)
    .update(bodyString)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(cleanSignature, 'utf8'),
    Buffer.from(expectedSignature, 'utf8')
  );
}
```

---

## 9. Using the JavaScript / TypeScript SDK

Instead of manually managing HTTP requests, install the official SDK:

```bash
npm install @tallyconnect/sdk
```

### Complete End-to-End Example:

```javascript
import { TallyConnect } from '@tallyconnect/sdk';

// 1. Initialize client with your API key
const client = new TallyConnect({
  baseUrl: 'https://api.tallyconnect.io', // or http://127.0.0.1:5001 for local development
  apiKey: process.env.TALLY_CONNECT_API_KEY
});

// 2. Start a connection session for a customer
const session = await client.createConnection({
  appId: process.env.TALLY_CONNECT_APP_ID,
  externalUserId: 'customer_tenant_9042',
  companyName: 'Apex Engineering Supplies Pvt Ltd'
});

console.log('Provide this activation code to customer:', session.activationCode);
console.log('Connection ID:', session.connectionId);

// 3. Check live connection status
const status = await client.getConnectionStatus(session.connectionId);
console.log('Tally status:', status.tally_status);

// 4. Trigger an immediate synchronization
await client.sync(session.connectionId);

// 5. Fetch customer masters
const customers = await client.getCustomers(session.connectionId);
console.log(`Fetched ${customers.length} customers from TallyPrime.`);

// 6. Fetch invoices
const sales = await client.getSales(session.connectionId);
console.log(`Fetched ${sales.length} sales invoices.`);
```

---

## 10. Error Handling & Standard Error Codes

Tally Connect returns actionable, non-technical error codes:

| Error Code | HTTP Status | Meaning | Action / Solution |
| :--- | :---: | :--- | :--- |
| `CONNECTION_ID_REQUIRED` | 400 | Missing `x-connection-id` header | Pass target connection ID in header |
| `UNAUTHORIZED` | 401 | Missing or invalid API key | Verify `x-api-key` header |
| `CONNECTION_ACCESS_DENIED`| 403 | Connection belongs to another app | Check that API key owns the connection ID |
| `PERMISSION_DENIED` | 403 | Customer disabled entity access | Ask customer to enable entity in settings |
| `TALLY_NOT_RUNNING` | 503 | TallyPrime port 9000 unreachable | Customer should open TallyPrime & enable port 9000 |
| `AGENT_OFFLINE` | 503 | Desktop agent is not running | Customer should launch desktop agent app |
| `TALLY_CONNECTION_REQUIRED`| 503 | Real data not yet synchronized | Trigger sync or wait for agent upload |
| `SYNC_FAILED` | 500 | Tally extraction failure | Reopen company in TallyPrime and retry sync |
