# Tally Connect — SaaS Developer Integration Guide

## 1. What is Tally Connect?

**Tally Connect** connects TallyPrime directly to modern external applications.

Tally Connect is **not** an ERP, not Finlayer, not InvoiceFlow, and not an accounting SaaS. It is an extraction, normalization, and delivery engine designed to bridge the gap between desktop accounting software (TallyPrime) and cloud/SaaS software.

---

## 2. Architecture & Data Flow

```
+-------------------------------------------------------+
|                   Customer Computer                   |
|                                                       |
|  +-------------------+       +---------------------+  |
|  |    TallyPrime     | <---> | Tally Connect Agent |  |
|  |  (Local Port 9000)|  XML  |   (Windows Executable| |
|  +-------------------+       +----------+----------+  |
+-----------------------------------------|-------------+
                                          |
                        +-----------------+-----------------+
                        |                                   |
                        v                                   v
             [Local CSV Export]                   [Cloud Sync / API]
        %APPDATA%\TallyConnect\exports\           Tally Connect Cloud
                        |                                   |
                        v                                   v
             Clean Tabular Records                 Any External SaaS
             (Developers / Analysts)               (REST API / SDK)
```

---

## 3. What Runs on the Customer's Windows Computer?

The **Tally Connect Agent** (`TallyConnectAgent.exe`).

### Customer Prerequisites:
1. Windows OS (Windows 10, 11, Server 2016+)
2. TallyPrime (with local HTTP server enabled on port 9000)
3. Tally Connect Agent

The customer does **NOT** need:
- Node.js, npm, or Python
- Developer command-line tools
- TDL scripting knowledge
- Database servers or configuration files

---

## 4. What the Agent Does

1. **Auto-Detects TallyPrime:** Probes `http://127.0.0.1:9000` to verify Tally is running.
2. **Validates Active Company:** Retrieves the currently open company name directly from TallyPrime. Fails gracefully if no company is open.
3. **Selective Extraction:** Fetches only the datasets requested by the user or scheduled sync jobs.
4. **Zero-Mock Parsing:** Converts genuine Tally XML envelopes into structured data with zero synthetic fallback data.
5. **Data Normalization:** Converts Tally-specific internal data structures into clean, standardized business models.
6. **Local CSV Export:** Streams records into clean, UTF-8 encoded CSV files saved locally to `%APPDATA%\TallyConnect\exports\`.
7. **Downstream Cloud Delivery:** When linked to a cloud tenant, securely pushes normalized data upstream to Tally Connect Cloud.

---

## 5. What the External SaaS Developer Gets

External SaaS developers integrate with **Tally Connect**, not TallyPrime:
- **No Tally XML:** You never write XML envelopes, collections, or TDL definitions.
- **No Port 9000 Exposure:** You never need network tunnels or direct inbound access to the customer's port 9000.
- **Standard JSON REST API:** Query normalized data endpoints:
  - `GET /api/v1/customers`
  - `GET /api/v1/vendors`
  - `GET /api/v1/ledgers`
  - `GET /api/v1/inventory`
  - `GET /api/v1/orders`
- **Official SDK (`@tallyconnect/sdk`):**
  ```javascript
  import { connectTally, TallyConnect } from '@tallyconnect/sdk';

  // Provision an activation code for your customer
  const session = await connectTally({
    apiKey: process.env.TALLY_CONNECT_API_KEY,
    apiSecret: process.env.TALLY_CONNECT_API_SECRET,
    companyName: 'ACME Corp'
  });

  console.log(`Give this code to your customer: ${session.activationCode}`);
  ```
- **Webhooks:** Receive signed HMAC-SHA256 event notifications whenever customer data syncs.
