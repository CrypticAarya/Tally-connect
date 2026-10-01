# Tally Connect SDK & Customer Connection Experience

The Tally Connect SDK allows SaaS platforms to connect their end-users' local TallyPrime installations seamlessly without technical friction.

---

## 1. Quickstart

### JavaScript Example:

```javascript
import { connectTally, TallyConnect } from '@tallyconnect/sdk';

// 1. Initialize embedded customer connection session
const session = await connectTally({
  appId: "app_demo_fintech",
  userId: "cust_user_48291"
});

console.log("Customer Activation Code:", session.activationCode); // e.g. "TC-4829"
console.log("Expires At:", session.expiresAt);
```

---

## 2. API Endpoints Reference

### 1. Create Connection Session
`POST /api/connect/session`

**Request Body:**
```json
{
  "app_id": "app_demo_fintech",
  "external_user_id": "cust_user_48291",
  "callback_url": "https://yourapp.com/settings/tally/callback"
}
```

**Response:**
```json
{
  "success": true,
  "session_id": "conn_mul482a_19283f",
  "activation_code": "TC-4829",
  "expires_at": "2026-09-28T17:00:00.000Z"
}
```

---

### 2. Poll Connection Status
`GET /api/connect/:connectionId/status`

**Response:**
```json
{
  "status": "ACTIVE",
  "company_name": "National Trading Corporation",
  "agent_status": "ONLINE",
  "tally_status": "ONLINE",
  "last_sync": "2026-09-28T16:20:00.000Z",
  "permissions": {
    "customers": true,
    "sales": true,
    "inventory": false,
    "ledgers": true,
    "trial_balance": false
  }
}
```

---

### 3. Trigger Immediate Sync
`POST /api/connect/:connectionId/sync`

**Response:**
```json
{
  "success": true,
  "message": "Immediate sync triggered",
  "jobs": [
    { "id": "job_1", "entity_type": "customers", "status": "PENDING" },
    { "id": "job_2", "entity_type": "sales", "status": "PENDING" }
  ]
}
```

---

### 4. Fetch Sync History
`GET /api/connect/:connectionId/sync-history`

**Response:**
```json
{
  "last_sync": "2026-09-28T16:20:00.000Z",
  "status": "ACTIVE",
  "records_synced": 450,
  "errors": [],
  "history": [
    {
      "job_id": "job_1",
      "entity_type": "customers",
      "status": "COMPLETED",
      "records_synced": 120,
      "completed_at": "2026-09-28T16:20:05.000Z"
    }
  ]
}
```

---

## 3. Customer Friendly Error Codes

All errors returned by the customer connection layer adhere to a standardized schema:

```json
{
  "code": "TALLY_NOT_RUNNING",
  "message": "TallyPrime application is not running or XML communication port is disabled.",
  "solution": "Open TallyPrime on your desktop and verify that port 9000 is enabled in F12 > Advanced Configuration > Enable ODBC/XML."
}
```

### Standard Codes Catalog:
| Code | Meaning | Actionable Solution |
| :--- | :--- | :--- |
| `TALLY_NOT_RUNNING` | Tally is closed or port 9000 is not listening | Open TallyPrime and enable XML port 9000 |
| `AGENT_OFFLINE` | Windows agent daemon is not active | Start the TallyConnectAgent desktop app |
| `INVALID_PERMISSION`| Requested entity is not permitted | Enable the entity in connection settings |
| `SYNC_FAILED` | Tally extraction failure | Reopen company in TallyPrime and retry sync |
| `NETWORK_ERROR` | Cloud communication timeout | Verify internet and outbound HTTP access |
