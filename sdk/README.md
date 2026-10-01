# @tallyconnect/sdk — Official Node.js SDK

Official JavaScript / TypeScript SDK for **Tally Connect**. Easily connect your B2B SaaS platform to your customers' on-premise **TallyPrime** systems.

---

## Installation

```bash
npm install @tallyconnect/sdk
```

---

## 7-Step Integration Quickstart

### 1. Initialize the SDK

```javascript
import { TallyConnect } from '@tallyconnect/sdk';

const tallyConnect = new TallyConnect({
  baseUrl: process.env.TALLY_CONNECT_URL || 'https://api.tallyconnect.cloud',
  apiKey: process.env.TALLY_CONNECT_API_KEY // 'tc_live_...'
});
```

### 2. Create a Customer Connection Session
When your customer clicks **"Connect Tally"** in your application:

```javascript
const session = await tallyConnect.createSession({
  appId: 'app_mup9vdcj_4c600a',
  userId: 'usr_cust_9981' // Your internal customer ID
});

console.log('Connection ID:', session.connectionId);
console.log('Activation Code:', session.activationCode); // e.g. "TC-7837"
```

### 3. Display Activation Code to the Customer
Show `session.activationCode` in your UI. The customer downloads `TallyConnectAgent.exe`, enters the 6-character code, and links their local TallyPrime in seconds.

### 4. Check Connection & Tally Status

```javascript
const status = await tallyConnect.getStatus(session.connectionId);

console.log('Connection Status:', status.status);           // 'ACTIVE' | 'PENDING'
console.log('Tally Running:', status.tally_status);        // 'ONLINE' | 'OFFLINE'
console.log('Company Name:', status.company_name);         // 'Apex Hardware Ltd'
console.log('Active Permissions:', status.permissions);
```

### 5. Trigger an Immediate Sync

```javascript
const syncJob = await tallyConnect.sync(session.connectionId);
console.log(`Sync initiated: ${syncJob.jobs.length} entity jobs queued`);
```

### 6. Retrieve Normalized Accounting Data
Once synchronized, fetch standard accounting domain entities:

```javascript
// Retrieve Customers (Sundry Debtors)
const customers = await tallyConnect.getCustomers(session.connectionId);

// Retrieve Vendors (Sundry Creditors)
const vendors = await tallyConnect.getVendors(session.connectionId);

// Retrieve Invoices / Sales Register
const sales = await tallyConnect.getSales(session.connectionId);

// Retrieve Inventory / Stock Items
const items = await tallyConnect.getInventory(session.connectionId);

// Retrieve General Ledgers
const ledgers = await tallyConnect.getLedgers(session.connectionId);
```

### 7. Receive & Verify Webhooks
Tally Connect sends HMAC-SHA256 signed event notifications when data syncs or agent status changes:

```javascript
import express from 'express';
const app = express();

app.post('/api/tally-webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-tally-signature'];
  const isValid = TallyConnect.verifyWebhookSignature(
    req.body,
    signature,
    process.env.TALLY_CONNECT_API_SECRET
  );

  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }

  const payload = JSON.parse(req.body.toString('utf-8'));
  console.log(`Received event: ${payload.event} for connection: ${payload.data?.connection_id}`);
  
  if (payload.event === 'sync.completed') {
    // Process new accounting data
  }

  res.sendStatus(200);
});
```

---

## SDK Methods Reference

| Method | Description |
|:---|:---|
| `connectTally(params)` | Top-level convenience helper to initiate a customer connection session. |
| `createSession(params)` | Creates a new customer connection session and generates an activation code. |
| `getStatus(connectionId)` | Retrieves live status, agent heartbeat, active company, and permissions. |
| `getPermissions(connectionId)` | Retrieves customer permission matrix. |
| `updatePermissions(connectionId, permissions)` | Configures allowed accounting entities for a connection. |
| `syncNow(connectionId)` / `sync(connectionId)` | Triggers an immediate synchronization for permitted entities. |
| `getCustomers(connectionId)` | Fetches customer party records (Sundry Debtors). |
| `getVendors(connectionId)` | Fetches vendor party records (Sundry Creditors). |
| `getSales(connectionId)` | Fetches sales register vouchers and tax breakdowns. |
| `getInventory(connectionId)` | Fetches stock items and inventory valuation. |
| `getStockGroups(connectionId)` | Fetches inventory stock groups. |
| `getUnits(connectionId)` | Fetches inventory units of measurement. |
| `getGodowns(connectionId)` | Fetches godowns and warehouse locations. |
| `getLedgers(connectionId)` | Fetches Chart of Accounts ledgers and balances. |
| `getGroups(connectionId)` | Fetches account groups. |
| `getCostCenters(connectionId)` | Fetches cost centres. |
| `getSalesOrders(connectionId)` | Fetches open sales orders. |
| `getPurchaseOrders(connectionId)` | Fetches open purchase orders. |
| `getDeliveryNotes(connectionId)` | Fetches delivery note vouchers. |
| `getReceiptNotes(connectionId)` | Fetches receipt note vouchers. |
| `getTrialBalance(connectionId)` | Fetches opening, transaction, and closing balances. |
| `getSyncHistory(connectionId)` | Fetches historical synchronization logs and record counts. |
| `TallyConnect.verifyWebhookSignature(payload, sig, secret)` | Verifies HMAC-SHA256 signature on incoming webhooks. |

---

## License

MIT © Tally Connect Team
