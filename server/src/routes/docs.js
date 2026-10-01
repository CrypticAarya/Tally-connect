import express from 'express';

const router = express.Router();

export const API_DOCUMENTATION = {
  platform: 'Tally Connect Developer Platform',
  version: '1.0.0',
  description: 'REST APIs for consuming synchronized accounting and financial data from TallyPrime.',
  authentication: {
    type: 'API Key',
    header: 'x-api-key',
    description: 'All requests to /api/v1/* require an active SaaS application API key passed in the x-api-key HTTP header. When an application manages multiple active customer connections, the target connection must be specified in the x-connection-id header.',
    example: 'x-api-key: tc_live_8f39b1a0e7d5c4b3a2...',
    tenantIsolationHeader: {
      header: 'x-connection-id',
      description: 'Customer connection ID (e.g. conn_mul89a2_001943) representing the specific connected Tally company.',
      required: 'Mandatory when your SaaS application has more than one active customer connection.'
    }
  },
  developerApis: [
    {
      action: 'Register Developer',
      method: 'POST',
      path: '/api/developer/register',
      description: 'Creates a new developer account and returns an authentication Bearer token.',
      request_body: { name: 'Your Name', email: 'developer@example.com', password: 'YourSecurePassword' },
      response_example: { success: true, developer: { id: 'dev_123', name: 'Your Name', email: 'developer@example.com' }, token: 'dev_tok_...' }
    },
    {
      action: 'Developer Login',
      method: 'POST',
      path: '/api/developer/login',
      description: 'Authenticates developer credentials and returns an authentication Bearer token.',
      request_body: { email: 'developer@example.com', password: 'YourSecurePassword' },
      response_example: { success: true, developer: { id: 'dev_123', name: 'Your Name' }, token: 'dev_tok_...' }
    },
    {
      action: 'Create Application',
      method: 'POST',
      path: '/api/developer/apps',
      description: 'Provisions a new SaaS application with an API key and webhook configuration.',
      headers: { 'Authorization': 'Bearer <developerToken>' },
      request_body: { app_name: 'Billing & GST Sync', webhook_url: 'https://yourapp.com/webhooks/tally' },
      response_example: { success: true, app: { id: 'app_123', app_name: 'Billing & GST Sync', api_key: 'tc_live_...', api_secret: 'sec_live_...' } }
    },
    {
      action: 'Get API Key & Credentials',
      method: 'GET',
      path: '/api/developer/apps/:id/api-key',
      description: 'Retrieves the API credentials for an application (strictly requires developer ownership).',
      headers: { 'Authorization': 'Bearer <developerToken>' },
      response_example: { success: true, app_id: 'app_123', api_key: 'tc_live_...', api_secret: 'sec_live_...', status: 'ACTIVE' }
    },
    {
      action: 'Regenerate API Key',
      method: 'POST',
      path: '/api/developer/apps/:id/regenerate-key',
      description: 'Rotates and invalidates the previous API key, issuing a new API key and secret immediately.',
      headers: { 'Authorization': 'Bearer <developerToken>' },
      response_example: { success: true, message: 'API Key regenerated successfully', app: { api_key: 'tc_live_new_...' } }
    }
  ],
  connectionApis: [
    {
      action: 'Create Connection Session',
      method: 'POST',
      path: '/api/connect/session',
      description: 'Initiates an embedded customer connection session, generating a 6-character activation code for the Windows agent.',
      headers: { 'x-api-key': 'tc_live_...' },
      request_body: { app_id: 'app_123', external_user_id: 'cust_org_4829', company_name: 'Acme Traders' },
      response_example: { success: true, session_id: 'conn_123', connection_id: 'conn_123', activation_code: 'TC-8491', expires_at: '2026-10-01T13:20:00.000Z' }
    },
    {
      action: 'Get Connection Status',
      method: 'GET',
      path: '/api/connect/:connectionId/status',
      description: 'Retrieves real-time status of agent connectivity, local Tally state, active company, and permission flags.',
      headers: { 'x-api-key': 'tc_live_...' },
      response_example: { success: true, connection_id: 'conn_123', status: 'ACTIVE', company_name: 'Acme Traders', agent_status: 'ONLINE', tally_status: 'ONLINE', last_sync: '2026-10-01T12:00:00.000Z', permissions: { customers: true, sales: true } }
    },
    {
      action: 'Get Connection Permissions',
      method: 'GET',
      path: '/api/connect/:connectionId/permissions',
      description: 'Retrieves the current entity permission matrix for this customer connection.',
      headers: { 'x-api-key': 'tc_live_...' },
      response_example: { success: true, connection_id: 'conn_123', permissions: { allow_customers: 1, allow_vendors: 1, allow_sales: 1, allow_inventory: 0, allow_ledgers: 1, allow_orders: 0, allow_trial_balance: 0 } }
    },
    {
      action: 'Update Connection Permissions',
      method: 'POST',
      path: '/api/connect/:connectionId/permissions',
      description: 'Enables or disables data access permissions for specific accounting entities on this connection.',
      headers: { 'x-api-key': 'tc_live_...' },
      request_body: { permissions: { customers: true, vendors: true, sales: true, inventory: true, ledgers: true, orders: true, trial_balance: true } },
      response_example: { success: true, message: 'Permissions updated successfully', connection_id: 'conn_123' }
    },
    {
      action: 'Trigger Immediate Sync',
      method: 'POST',
      path: '/api/connect/:connectionId/sync',
      description: 'Triggers an immediate background synchronization cycle for all permitted entities.',
      headers: { 'x-api-key': 'tc_live_...' },
      response_example: { success: true, message: 'Immediate sync triggered', connection_id: 'conn_123', jobs: [{ id: 'job_1', entity_type: 'customers', status: 'PENDING' }] }
    },
    {
      action: 'Get Sync History',
      method: 'GET',
      path: '/api/connect/:connectionId/sync-history',
      description: 'Retrieves sync execution history, total records synced, and error details.',
      headers: { 'x-api-key': 'tc_live_...' },
      response_example: { success: true, connection_id: 'conn_123', status: 'ACTIVE', records_synced: 450, errors: [], history: [{ job_id: 'job_1', entity_type: 'customers', status: 'COMPLETED', records_synced: 120 }] }
    }
  ],
  availableApis: [
    {
      entity: 'customers',
      method: 'GET',
      path: '/api/v1/customers',
      description: 'Retrieve verified customer masters (Sundry Debtors) with GSTIN and addresses.',
      permission_required: 'allow_customers',
      request_example: {
        method: 'GET',
        url: 'https://api.tallyconnect.io/api/v1/customers',
        headers: {
          'x-api-key': 'tc_live_8f39b1a0e7d5c4b3a2...',
          'x-connection-id': 'conn_mul89a2_001943'
        }
      },
      response_example: {
        success: true,
        count: 2,
        data: [
          {
            id: 'cust-guid-00101',
            name: 'Apex Retail Enterprises Pvt Ltd',
            gstin: '27AAACA1234D1Z5',
            address: 'Unit 402, Trade Tower, Lower Parel, Mumbai, Maharashtra, 400013'
          },
          {
            id: 'cust-guid-00102',
            name: 'Kaveri Industrial Supplies',
            gstin: '29ABCDE1234F2Z5',
            address: 'Plot 12B, Peenya Industrial Area, Bengaluru, Karnataka, 560058'
          }
        ]
      },
      error_codes: [
        { code: 400, reason: 'Bad Request', description: 'Missing x-connection-id header when multiple connections exist.' },
        { code: 401, reason: 'Unauthorized', description: 'Missing x-api-key header or invalid credentials.' },
        { code: 403, reason: 'Permission Denied', description: 'The connected Tally customer has not granted permission for customer data (allow_customers=false), or the API key is disabled.' },
        { code: 503, reason: 'Service Unavailable', description: 'No real Tally data available yet.' }
      ]
    },
    {
      entity: 'vendors',
      method: 'GET',
      path: '/api/v1/vendors',
      description: 'Retrieve vendor masters (Sundry Creditors) with GSTIN and address details.',
      permission_required: 'allow_vendors',
      request_example: {
        method: 'GET',
        url: 'https://api.tallyconnect.io/api/v1/vendors',
        headers: {
          'x-api-key': 'tc_live_8f39b1a0e7d5c4b3a2...',
          'x-connection-id': 'conn_mul89a2_001943'
        }
      },
      response_example: {
        success: true,
        data: [
          {
            id: 'ven-guid-00201',
            name: 'Global Metals & Alloys Corp',
            gstin: '27AAACG5678H1Z8',
            address: 'Plot 55, MIDC Industrial Area, Taloja, Maharashtra, 410208'
          }
        ]
      },
      error_codes: [
        { code: 401, reason: 'Unauthorized', description: 'Missing x-api-key header.' },
        { code: 403, reason: 'Permission Denied', description: 'Vendor access has not been permitted by customer (allow_vendors=false).' }
      ]
    },
    {
      entity: 'sales',
      method: 'GET',
      path: '/api/v1/sales',
      description: 'Retrieve real-time sales vouchers and invoices including item line items and tax breakdown.',
      permission_required: 'allow_sales',
      request_example: {
        method: 'GET',
        url: 'https://api.tallyconnect.io/api/v1/sales',
        headers: {
          'x-api-key': 'tc_live_8f39b1a0e7d5c4b3a2...',
          'x-connection-id': 'conn_mul89a2_001943'
        }
      },
      response_example: {
        success: true,
        count: 1,
        data: [
          {
            invoice: 'INV/2026-27/00108',
            customer: 'Apex Retail Enterprises Pvt Ltd',
            amount: '144700',
            items: [
              {
                itemName: 'Industrial Valve 50mm Brass',
                quantity: 100,
                rate: 800,
                amount: 76000
              },
              {
                itemName: 'High Pressure Rubber Gasket 2-inch',
                quantity: 250,
                rate: 180,
                amount: 45000
              }
            ]
          }
        ]
      },
      error_codes: [
        { code: 401, reason: 'Unauthorized', description: 'Missing x-api-key header.' },
        { code: 403, reason: 'Permission Denied', description: 'Sales voucher access has not been permitted by customer (allow_sales=false).' }
      ]
    },
    {
      entity: 'inventory',
      method: 'GET',
      path: '/api/v1/inventory',
      description: 'Retrieve stock items, quantities, standard cost, and closing valuation.',
      permission_required: 'allow_inventory',
      request_example: {
        method: 'GET',
        url: 'https://api.tallyconnect.io/api/v1/inventory',
        headers: {
          'x-api-key': 'tc_live_8f39b1a0e7d5c4b3a2...',
          'x-connection-id': 'conn_mul89a2_001943'
        }
      },
      response_example: {
        success: true,
        count: 1,
        data: [
          {
            id: 'stock-item-001',
            name: 'Industrial Valve 50mm Brass',
            parentGroup: 'Valves & Fittings',
            baseUnits: 'NOS',
            closingBalance: {
              quantity: 100,
              rate: 800,
              value: 80000
            }
          }
        ]
      },
      error_codes: [
        { code: 401, reason: 'Unauthorized', description: 'Missing x-api-key header.' },
        { code: 403, reason: 'Permission Denied', description: 'Inventory access has not been permitted by customer (allow_inventory=false).' }
      ]
    },
    {
      entity: 'stock-groups',
      method: 'GET',
      path: '/api/v1/stock-groups',
      description: 'Retrieve stock categories and product hierarchy.',
      permission_required: 'allow_inventory',
      request_example: {
        method: 'GET',
        url: 'https://api.tallyconnect.io/api/v1/stock-groups',
        headers: { 'x-api-key': 'tc_live_...', 'x-connection-id': 'conn_...' }
      },
      response_example: {
        success: true,
        data: [{ id: 'grp-001', name: 'Valves & Fittings', parent: 'Primary' }]
      },
      error_codes: [{ code: 403, reason: 'Permission Denied' }]
    },
    {
      entity: 'units',
      method: 'GET',
      path: '/api/v1/units',
      description: 'Retrieve Units of Measurement (UOM) configured in Tally.',
      permission_required: 'allow_inventory',
      request_example: {
        method: 'GET',
        url: 'https://api.tallyconnect.io/api/v1/units',
        headers: { 'x-api-key': 'tc_live_...', 'x-connection-id': 'conn_...' }
      },
      response_example: {
        success: true,
        data: [{ id: 'uom-001', name: 'NOS', formalName: 'Numbers', decimalPlaces: 0 }]
      },
      error_codes: [{ code: 403, reason: 'Permission Denied' }]
    },
    {
      entity: 'godowns',
      method: 'GET',
      path: '/api/v1/godowns',
      description: 'Retrieve Godowns / Warehouses / Locations.',
      permission_required: 'allow_inventory',
      request_example: {
        method: 'GET',
        url: 'https://api.tallyconnect.io/api/v1/godowns',
        headers: { 'x-api-key': 'tc_live_...', 'x-connection-id': 'conn_...' }
      },
      response_example: {
        success: true,
        data: [{ id: 'godown-001', name: 'Central Warehouse Bhiwandi', parent: 'Primary' }]
      },
      error_codes: [{ code: 403, reason: 'Permission Denied' }]
    },
    {
      entity: 'ledgers',
      method: 'GET',
      path: '/api/v1/ledgers',
      description: 'Retrieve Chart of Accounts and general ledger masters.',
      permission_required: 'allow_ledgers',
      request_example: {
        method: 'GET',
        url: 'https://api.tallyconnect.io/api/v1/ledgers',
        headers: {
          'x-api-key': 'tc_live_8f39b1a0e7d5c4b3a2...',
          'x-connection-id': 'conn_mul89a2_001943'
        }
      },
      response_example: {
        success: true,
        count: 2,
        data: [
          {
            id: 'led-001',
            name: 'HDFC Bank Operational A/c',
            parentGroup: 'Bank Accounts',
            openingBalance: 154000,
            closingBalance: 298700
          },
          {
            id: 'led-002',
            name: 'Output CGST 9%',
            parentGroup: 'Duties & Taxes',
            openingBalance: 0,
            closingBalance: 11034
          }
        ]
      },
      error_codes: [
        { code: 401, reason: 'Unauthorized', description: 'Missing x-api-key header.' },
        { code: 403, reason: 'Permission Denied', description: 'Ledger access has not been permitted (allow_ledgers=false).' }
      ]
    },
    {
      entity: 'groups',
      method: 'GET',
      path: '/api/v1/groups',
      description: 'Retrieve accounting groups hierarchy.',
      permission_required: 'allow_ledgers',
      request_example: {
        method: 'GET',
        url: 'https://api.tallyconnect.io/api/v1/groups',
        headers: { 'x-api-key': 'tc_live_...', 'x-connection-id': 'conn_...' }
      },
      response_example: {
        success: true,
        data: [{ id: 'grp-001', name: 'Sundry Debtors', parent: 'Current Assets' }]
      },
      error_codes: [{ code: 403, reason: 'Permission Denied' }]
    },
    {
      entity: 'cost-centers',
      method: 'GET',
      path: '/api/v1/cost-centers',
      description: 'Retrieve cost centers for multi-dimensional expense allocation.',
      permission_required: 'allow_ledgers',
      request_example: {
        method: 'GET',
        url: 'https://api.tallyconnect.io/api/v1/cost-centers',
        headers: { 'x-api-key': 'tc_live_...', 'x-connection-id': 'conn_...' }
      },
      response_example: {
        success: true,
        data: [{ id: 'cc-001', name: 'Mumbai Branch Operations', parent: 'Primary' }]
      },
      error_codes: [{ code: 403, reason: 'Permission Denied' }]
    },
    {
      entity: 'sales-orders',
      method: 'GET',
      path: '/api/v1/sales-orders',
      description: 'Retrieve pending and fulfilled Sales Orders.',
      permission_required: 'allow_orders',
      request_example: {
        method: 'GET',
        url: 'https://api.tallyconnect.io/api/v1/sales-orders',
        headers: { 'x-api-key': 'tc_live_...', 'x-connection-id': 'conn_...' }
      },
      response_example: {
        success: true,
        data: [{ orderNumber: 'SO/2026/001', customer: 'Apex Retail Enterprises', amount: '85000', items: [] }]
      },
      error_codes: [{ code: 403, reason: 'Permission Denied' }]
    },
    {
      entity: 'purchase-orders',
      method: 'GET',
      path: '/api/v1/purchase-orders',
      description: 'Retrieve pending and fulfilled Purchase Orders.',
      permission_required: 'allow_orders',
      request_example: {
        method: 'GET',
        url: 'https://api.tallyconnect.io/api/v1/purchase-orders',
        headers: { 'x-api-key': 'tc_live_...', 'x-connection-id': 'conn_...' }
      },
      response_example: {
        success: true,
        data: [{ orderNumber: 'PO/2026/044', vendor: 'Global Metals Corp', amount: '120000', items: [] }]
      },
      error_codes: [{ code: 403, reason: 'Permission Denied' }]
    },
    {
      entity: 'delivery-notes',
      method: 'GET',
      path: '/api/v1/delivery-notes',
      description: 'Retrieve Delivery Notes (Challans) issued to customers.',
      permission_required: 'allow_delivery_notes',
      request_example: {
        method: 'GET',
        url: 'https://api.tallyconnect.io/api/v1/delivery-notes',
        headers: { 'x-api-key': 'tc_live_...', 'x-connection-id': 'conn_...' }
      },
      response_example: {
        success: true,
        data: [{ noteNumber: 'DN/2026/009', party: 'Apex Retail', items: [] }]
      },
      error_codes: [{ code: 403, reason: 'Permission Denied' }]
    },
    {
      entity: 'receipt-notes',
      method: 'GET',
      path: '/api/v1/receipt-notes',
      description: 'Retrieve Goods Receipt Notes (GRN) received from suppliers.',
      permission_required: 'allow_receipt_notes',
      request_example: {
        method: 'GET',
        url: 'https://api.tallyconnect.io/api/v1/receipt-notes',
        headers: { 'x-api-key': 'tc_live_...', 'x-connection-id': 'conn_...' }
      },
      response_example: {
        success: true,
        data: [{ noteNumber: 'RN/2026/012', party: 'Global Metals Corp', items: [] }]
      },
      error_codes: [{ code: 403, reason: 'Permission Denied' }]
    },
    {
      entity: 'trial-balance',
      method: 'GET',
      path: '/api/v1/trial-balance',
      description: 'Retrieve verified Trial Balance with opening balances, debit/credit totals, and closing balances.',
      permission_required: 'allow_trial_balance',
      request_example: {
        method: 'GET',
        url: 'https://api.tallyconnect.io/api/v1/trial-balance',
        headers: {
          'x-api-key': 'tc_live_8f39b1a0e7d5c4b3a2...',
          'x-connection-id': 'conn_mul89a2_001943'
        }
      },
      response_example: {
        success: true,
        count: 2,
        data: [
          {
            id: 'tb-001',
            ledgerName: 'Sales Domestic - GST',
            parentGroup: 'Sales Accounts',
            debitTotal: 0,
            creditTotal: 121000,
            closingBalance: -121000
          },
          {
            id: 'tb-002',
            ledgerName: 'HDFC Bank Operational A/c',
            parentGroup: 'Bank Accounts',
            debitTotal: 144700,
            creditTotal: 0,
            closingBalance: 144700
          }
        ]
      },
      error_codes: [
        { code: 401, reason: 'Unauthorized', description: 'Missing x-api-key header.' },
        { code: 403, reason: 'Permission Denied', description: 'Trial Balance access has not been permitted (allow_trial_balance=false).' }
      ]
    }
  ],
  webhooks: {
    description: 'Real-time event notifications delivered via HTTP POST to your configured webhook_url with HMAC-SHA256 signature verification in X-Tally-Signature header.',
    headers: {
      'X-Tally-Event': 'Event name (e.g. sync.completed, sync.failed, connection.offline)',
      'X-Tally-Signature': 'HMAC-SHA256 signature calculated with your app api_secret: sha256=<hex_hash>',
      'X-Tally-Attempt': 'Delivery attempt counter (1, 2, or 3)',
      'User-Agent': 'TallyConnect-Webhook/1.0'
    },
    events: [
      {
        event: 'sync.completed',
        description: 'Fired whenever the agent finishes extracting and uploading an entity dataset to the Cloud cache.',
        sample_payload: {
          event: 'sync.completed',
          app_id: 'app_123',
          timestamp: '2026-10-01T12:00:00.000Z',
          data: { connection_id: 'conn_123', company_name: 'Acme Traders', entity_type: 'customers', count: 45, job_id: 'job_456' }
        }
      },
      {
        event: 'sync.failed',
        description: 'Fired when a dataset extraction fails due to network or Tally errors.',
        sample_payload: {
          event: 'sync.failed',
          app_id: 'app_123',
          timestamp: '2026-10-01T12:00:00.000Z',
          data: { connection_id: 'conn_123', entity_type: 'sales', error: 'Tally connection timeout' }
        }
      },
      {
        event: 'connection.offline',
        description: 'Fired when an agent misses heartbeats or reports Tally as offline.',
        sample_payload: {
          event: 'connection.offline',
          app_id: 'app_123',
          timestamp: '2026-10-01T12:00:00.000Z',
          data: { connection_id: 'conn_123', machine: 'DESKTOP-01', tallyStatus: 'OFFLINE' }
        }
      }
    ],
    signatureVerificationCode: `import crypto from 'crypto';

export function verifyTallyWebhook(rawBody, signatureHeader, apiSecret) {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const cleanSig = signatureHeader.slice(7).trim();
  const bodyString = typeof rawBody === 'string' ? rawBody : (Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : JSON.stringify(rawBody));
  const expected = crypto.createHmac('sha256', apiSecret).update(bodyString).digest('hex');
  if (cleanSig.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(cleanSig, 'utf8'), Buffer.from(expected, 'utf8'));
}`
  },
  sdk: {
    packageName: '@tallyconnect/sdk',
    description: 'Official JavaScript/TypeScript SDK for seamless SaaS integration.',
    installCommand: 'npm install @tallyconnect/sdk',
    example: `import { TallyConnect } from '@tallyconnect/sdk';

const client = new TallyConnect({
  baseUrl: 'https://api.tallyconnect.io',
  apiKey: 'tc_live_your_api_key'
});

// 1. Create a customer connection session
const session = await client.createConnection({
  appId: 'app_123',
  externalUserId: 'customer_99'
});
console.log('Customer activation code:', session.activationCode);

// 2. Poll connection status
const status = await client.getConnectionStatus(session.connectionId);

// 3. Trigger immediate sync
await client.sync(session.connectionId);

// 4. Retrieve synchronized customer masters
const customers = await client.getCustomers(session.connectionId);`
  },
  customerErrors: {
    description: 'Standardized friendly error definitions returned by connection and sync APIs.',
    schema: {
      code: 'string',
      message: 'string',
      solution: 'string'
    },
    codes: [
      { code: 'TALLY_NOT_RUNNING', message: 'TallyPrime application is not running or XML communication port is disabled.', solution: 'Open TallyPrime on your desktop and verify that port 9000 is enabled in F12 > Advanced Configuration > Enable ODBC/XML.' },
      { code: 'AGENT_OFFLINE', message: 'The Tally Connect Desktop Agent is currently offline.', solution: 'Launch the Tally Connect Desktop Agent application on your computer.' },
      { code: 'INVALID_PERMISSION', message: 'Access to this accounting data entity has not been permitted.', solution: 'Ask your organization administrator to enable access for this entity in your Tally Connect connection settings.' },
      { code: 'SYNC_FAILED', message: 'Data extraction from Tally encountered an unexpected synchronization failure.', solution: 'Ensure your active company in TallyPrime has finished loading and retry the sync.' },
      { code: 'NETWORK_ERROR', message: 'Network connection between desktop agent and cloud server timed out.', solution: 'Check your internet connection and verify firewall allows outbound HTTP access.' }
    ]
  }
};

/**
 * GET /api/docs
 * Developer API documentation endpoint
 */
router.get('/', (req, res) => {
  return res.json({
    success: true,
    documentation: API_DOCUMENTATION
  });
});

export default router;
