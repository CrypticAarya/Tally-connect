# Tally Connect — Public REST API Reference
**Document Version:** 1.0.0  
**Base URL:** `http://127.0.0.1:5001` or `https://api.tallyconnect.cloud`  

---

## 1. Authentication

All SaaS API requests must provide your Live API key via HTTP headers:

```http
x-api-key: tc_live_8f39b1a0e7d5c4b3a2...
x-connection-id: conn_mul2l9ya_001943
```

- `x-api-key`: Issued when creating an app in the Developer Portal.
- `x-connection-id`: Required for all `/api/v1/*` data queries to identify the specific customer's Tally company.

---

## 2. Customer Connection & Onboarding Endpoints

### `POST /api/connect/session`
Initiates a new customer connection session and generates an activation code.
- **Headers:** `x-api-key: <API_KEY>`, `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "app_id": "app_123",
    "external_user_id": "usr_cust_9981",
    "company_name": "Optional Preferred Company",
    "callback_url": "https://your-saas.com/redirect"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "session_id": "conn_mul2l9ya_001943",
    "connection_id": "conn_mul2l9ya_001943",
    "activation_code": "TC-7837",
    "expires_at": "2026-10-01T15:00:00.000Z"
  }
  ```

### `GET /api/connect/:connectionId/status`
Retrieves live status, desktop agent health, active company, and permissions.
- **Headers:** `x-api-key: <API_KEY>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "status": "ACTIVE",
    "company_name": "Apex Industrial Technologies Ltd",
    "agent_status": "ONLINE",
    "tally_status": "ONLINE",
    "last_sync": "2026-10-01T13:30:00.000Z",
    "permissions": {
      "customers": true,
      "vendors": true,
      "sales": true,
      "inventory": false,
      "ledgers": true,
      "orders": false,
      "delivery_notes": false,
      "receipt_notes": false,
      "trial_balance": false
    }
  }
  ```

### `POST /api/connect/:connectionId/permissions`
Configures allowed data entities for a customer connection.
- **Headers:** `x-api-key: <API_KEY>`, `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "allow_customers": true,
    "allow_vendors": true,
    "allow_sales": true,
    "allow_inventory": false
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "permissions": {
      "customers": true,
      "vendors": true,
      "sales": true,
      "inventory": false
    }
  }
  ```

### `POST /api/connect/:connectionId/sync`
Triggers an immediate background synchronization job for permitted entities.
- **Headers:** `x-api-key: <API_KEY>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Sync initiated for permitted entities",
    "jobs": ["job_1", "job_2", "job_3"]
  }
  ```

### `GET /api/connect/:connectionId/sync-history`
Fetches historical sync job executions and records counts.
- **Headers:** `x-api-key: <API_KEY>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "history": [
      {
        "id": "job_1",
        "entity_type": "customers",
        "status": "COMPLETED",
        "records_synced": 45,
        "created_at": "2026-10-01T13:30:00.000Z"
      }
    ]
  }
  ```

---

## 3. Standardized Accounting Data Endpoints (`/api/v1/*`)

All `/api/v1/*` endpoints require both headers:
- `x-api-key: <API_KEY>`
- `x-connection-id: <CONNECTION_ID>`

### `GET /api/v1/customers`
Retrieves customer party records (Sundry Debtors).
- **Query Params:** `limit` (default 50), `offset` (default 0), `state` (e.g. `Maharashtra`)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "count": 1,
    "data": [
      {
        "id": "CUST-00101",
        "name": "Apex Retail Enterprises Pvt Ltd",
        "gstin": "27AAACA1234D1Z5",
        "pan": "AAACA1234D",
        "phone": "+91 98200 12345",
        "email": "accounts@apexretail.in",
        "billing_address": "Unit 402, Trade Tower, Lower Parel, Mumbai",
        "state": "Maharashtra",
        "country": "India",
        "credit_limit": 750000.00,
        "closing_balance": 144700.00
      }
    ]
  }
  ```

### `GET /api/v1/vendors`
Retrieves vendor/supplier party records (Sundry Creditors).
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "count": 1,
    "data": [
      {
        "id": "VEND-00201",
        "name": "Bharat Precision Engineering Ltd",
        "gstin": "27AAACG5678H1Z8",
        "bank_name": "HDFC Bank Ltd",
        "bank_account_number": "50200012345678",
        "bank_ifsc": "HDFC0000123",
        "closing_balance": 350000.00
      }
    ]
  }
  ```

### `GET /api/v1/sales`
Retrieves sales register vouchers and invoices.
- **Query Params:** `from_date`, `to_date`, `voucher_type`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "count": 1,
    "data": [
      {
        "id": "INV/2026-27/00108",
        "voucher_number": "INV/2026-27/00108",
        "date": "2026-04-12",
        "party_name": "Apex Retail Enterprises Pvt Ltd",
        "party_gstin": "27AAACA1234D1Z5",
        "total_amount": 144700.00,
        "tax_breakup": {
          "cgst": 4050.00,
          "sgst": 4050.00,
          "igst": 0.00
        },
        "line_items": [
          {
            "item_name": "Industrial Valve 50mm Brass",
            "quantity": 100,
            "unit": "NOS",
            "rate": 800.00,
            "amount": 76000.00
          }
        ]
      }
    ]
  }
  ```

### `GET /api/v1/inventory`
Retrieves stock items, inventory valuation, units, and godowns.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "count": 1,
    "data": [
      {
        "id": "ITEM-101",
        "name": "High Precision Bearing Model 44",
        "part_number": "84821010",
        "base_unit": "NOS",
        "stock_group": "Bearings",
        "closing_quantity": 250,
        "closing_rate": 450.00,
        "closing_value": 112500.00,
        "godown": "Warehouse-1"
      }
    ]
  }
  ```

### `GET /api/v1/ledgers`
Retrieves Chart of Accounts ledgers, parent groups, and balances.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "count": 1,
    "data": [
      {
        "id": "LEDG-301",
        "name": "Sales - Domestic 18%",
        "parent_group": "Sales Accounts",
        "opening_balance": 0.00,
        "closing_balance": 1850000.00
      }
    ]
  }
  ```

### `GET /api/v1/orders`
Retrieves open Sales Orders and Purchase Orders.
- **Query Params:** `type=sales` or `type=purchase`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "count": 1,
    "data": [
      {
        "id": "SO-2026-081",
        "order_number": "SO-2026-081",
        "order_type": "sales",
        "party_name": "Apex Retail Enterprises Pvt Ltd",
        "date": "2026-05-10",
        "total_amount": 54000.00,
        "status": "PENDING"
      }
    ]
  }
  ```

### `GET /api/v1/delivery-notes` and `GET /api/v1/receipt-notes`
Retrieves goods delivery and receipt vouchers.

### `GET /api/v1/trial-balance`
Retrieves consolidated trial balance accounts and closing debit/credit totals.

---

## 4. Webhook Notification Format

Real-time event notifications delivered via HTTP POST to your configured `webhook_url` with HMAC-SHA256 signature verification:

```http
POST https://your-saas.com/webhooks/tally
X-Tally-Signature: sha256=e6f2841216c9ffe8e7...
X-Tally-Event: sync.completed
X-Tally-Attempt: 1
Content-Type: application/json
```

Payload Envelope:
```json
{
  "event": "sync.completed",
  "app_id": "app_mup9vdcj_4c600a",
  "timestamp": "2026-10-01T13:30:15.120Z",
  "data": {
    "connection_id": "conn_mul2l9ya_001943",
    "company_name": "Apex Industrial Technologies Ltd",
    "entities": ["customers", "vendors", "sales", "ledgers"],
    "records_synced": 158
  }
}
```

---

## 5. Standard Error Format

All error responses return a standardized JSON structure with appropriate HTTP status codes:

```json
{
  "success": false,
  "error": "Permission denied."
}
```

For authentication errors:
```json
{
  "error": "Authentication required. Please provide an \"x-api-key\" header."
}
```
