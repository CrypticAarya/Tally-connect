# Tally Connect — External SaaS Developer Quickstart
**Document Version:** 1.0.0  
**Estimated Time to First Connected Tally:** 10 Minutes  

This guide provides the fastest path to integrate **Tally Connect** into your SaaS application, connect customer TallyPrime systems, and retrieve structured accounting data.

---

## Prerequisites
1. Running Tally Connect Cloud Server (e.g. `http://127.0.0.1:5001` or `https://api.tallyconnect.cloud`).
2. Your Developer Account credentials.

---

## 1. Developer Authentication & App Creation

### A. Register / Login to Developer Portal

```bash
# Register
curl -s -X POST http://127.0.0.1:5001/api/developer/register \
  -H "Content-Type: application/json" \
  -d '{"name":"SaaS Developer","email":"dev@yourfintech.com","password":"SecurePassword123!"}'

# Login to receive JWT token
curl -s -X POST http://127.0.0.1:5001/api/developer/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@yourfintech.com","password":"SecurePassword123!"}'
```

Response:
```json
{
  "success": true,
  "token": "eyJhbGciOi...",
  "developer": { "id": "dev_01", "email": "dev@yourfintech.com" }
}
```

### B. Create Your SaaS Application

```bash
curl -s -X POST http://127.0.0.1:5001/api/developer/apps \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"appName":"Automated Invoicing","webhookUrl":"https://your-saas.com/webhooks/tally"}'
```

Response:
```json
{
  "success": true,
  "app": {
    "id": "app_mup9vdcj_4c600a",
    "app_name": "Automated Invoicing",
    "api_key": "tc_live_493a6ea...",
    "api_secret": "sec_live_901c23eb..."
  }
}
```
> **Save your `api_key` and `api_secret` securely.** All subsequent requests authenticate with `x-api-key`.

---

## 2. Initiate a Customer Connection Session

When a customer clicks **"Connect Tally"** in your web app:

```javascript
import { TallyConnect } from '@tallyconnect/sdk';

const tally = new TallyConnect({
  baseUrl: 'http://127.0.0.1:5001',
  apiKey: 'tc_live_493a6ea...'
});

const session = await tally.createSession({
  appId: 'app_mup9vdcj_4c600a',
  userId: 'customer_tenant_4491' // Your internal customer ID
});

console.log('Activation Code:', session.activationCode); // e.g. "TC-7837"
console.log('Connection ID:', session.connectionId);     // e.g. "conn_mup9pxuh_6a2a43"
```

Or via direct HTTP:
```bash
curl -s -X POST http://127.0.0.1:5001/api/connect/session \
  -H "x-api-key: tc_live_493a6ea..." \
  -H "Content-Type: application/json" \
  -d '{"app_id":"app_mup9vdcj_4c600a","external_user_id":"customer_tenant_4491"}'
```

---

## 3. Customer Downloads & Activates Desktop Agent

1. Provide your customer the download link for `TallyConnectAgent.exe`.
2. Display the 6-character activation code (`TC-7837`) in your onboarding screen.
3. The customer launches `TallyConnectAgent.exe`, enters the code, and presses **Enter**.
4. The agent detects the active TallyPrime company and connects automatically.

---

## 4. Check Connection & Tally Status

Poll or check connection status to confirm Tally is online:

```javascript
const status = await tally.getStatus(session.connectionId);

console.log(status);
// {
//   "status": "ACTIVE",
//   "company_name": "Apex Industrial Technologies Ltd",
//   "agent_status": "ONLINE",
//   "tally_status": "ONLINE",
//   "permissions": { "customers": true, "sales": true, "inventory": false }
// }
```

Direct HTTP:
```bash
curl -s http://127.0.0.1:5001/api/connect/conn_mup9pxuh_6a2a43/status \
  -H "x-api-key: tc_live_493a6ea..."
```

---

## 5. Request Immediate Synchronization

Trigger extraction of permitted accounting entities:

```javascript
const syncResult = await tally.sync(session.connectionId);
console.log(syncResult);
```

Direct HTTP:
```bash
curl -s -X POST http://127.0.0.1:5001/api/connect/conn_mup9pxuh_6a2a43/sync \
  -H "x-api-key: tc_live_493a6ea..."
```

---

## 6. Retrieve Normalized Accounting Data

Once synchronized, query accounting entities via REST API:

```javascript
// Customers (Sundry Debtors)
const customers = await tally.getCustomers(session.connectionId);

// Vendors (Sundry Creditors)
const vendors = await tally.getVendors(session.connectionId);

// Sales Register / Invoices
const sales = await tally.getSales(session.connectionId);
```

Direct HTTP:
```bash
curl -s http://127.0.0.1:5001/api/v1/customers \
  -H "x-api-key: tc_live_493a6ea..." \
  -H "x-connection-id: conn_mup9pxuh_6a2a43"
```

Response:
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "CUST-001",
      "name": "Apex Retail Enterprises Pvt Ltd",
      "gstin": "27AAACA1234D1Z5",
      "phone": "+91 98200 12345",
      "email": "accounts@apexretail.in",
      "billing_address": "Lower Parel, Mumbai, Maharashtra 400013",
      "closing_balance": 750000.00
    }
  ]
}
```

---

## 7. Webhook Event Handling

When background sync jobs complete, Tally Connect posts an event to your configured webhook URL:

```javascript
import express from 'express';
import { TallyConnect } from '@tallyconnect/sdk';

const app = express();

app.post('/webhooks/tally', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-tally-signature'];
  const isValid = TallyConnect.verifyWebhookSignature(
    req.body,
    signature,
    process.env.TALLY_CONNECT_API_SECRET
  );

  if (!isValid) return res.status(401).send('Invalid signature');

  const event = JSON.parse(req.body.toString('utf-8'));
  console.log(`Received event: ${event.event} for connection ${event.connection_id}`);

  if (event.event === 'sync.completed') {
    console.log(`Entities synced: ${event.entities.join(', ')}`);
  }

  res.sendStatus(200);
});
```
