/**
 * TypeScript Type Definitions for Tally Connect JavaScript SDK
 */

export interface TallyConnectOptions {
  baseUrl?: string;
  apiKey?: string;
}

export interface CreateSessionParams {
  appId: string;
  userId?: string;
  externalUserId?: string;
  companyName?: string;
  callbackUrl?: string;
}

export interface CreateSessionResult {
  sessionId: string;
  connectionId: string;
  activationCode: string;
  expiresAt: string;
  callbackUrl?: string;
}

export interface ConnectionPermissions {
  customers?: boolean;
  vendors?: boolean;
  sales?: boolean;
  inventory?: boolean;
  ledgers?: boolean;
  orders?: boolean;
  delivery_notes?: boolean;
  receipt_notes?: boolean;
  trial_balance?: boolean;
}

export interface ConnectionStatusResult {
  success: boolean;
  connection_id: string;
  status: 'PENDING' | 'ACTIVE' | 'OFFLINE' | 'SUSPENDED';
  company_name: string;
  agent_status: 'WAITING_FOR_AGENT' | 'ONLINE' | 'OFFLINE';
  tally_status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
  last_sync: string | null;
  permissions: ConnectionPermissions;
  error?: {
    code: string;
    message: string;
    solution: string;
  } | null;
}

export interface CustomerMaster {
  id: string;
  name: string;
  gstin: string;
  address: string;
}

export interface VendorMaster {
  id: string;
  name: string;
  gstin: string;
  address: string;
}

export interface SalesInvoiceItem {
  itemName: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface SalesInvoice {
  invoice: string;
  customer: string;
  amount: string;
  items: SalesInvoiceItem[];
}

export interface StockItem {
  id: string;
  name: string;
  parentGroup: string;
  baseUnits: string;
  closingBalance: {
    quantity: number;
    rate: number;
    value: number;
  };
}

export interface LedgerItem {
  id: string;
  name: string;
  parentGroup: string;
  openingBalance: number;
  closingBalance: number;
}

export interface TrialBalanceItem {
  id: string;
  ledgerName: string;
  parentGroup: string;
  debitTotal: number;
  creditTotal: number;
  closingBalance: number;
}

export class TallyConnect {
  constructor(options?: TallyConnectOptions);

  createSession(params: CreateSessionParams): Promise<CreateSessionResult>;
  createConnection(params: CreateSessionParams): Promise<CreateSessionResult>;

  getStatus(connectionId: string): Promise<ConnectionStatusResult>;
  getConnectionStatus(connectionId: string): Promise<ConnectionStatusResult>;

  getPermissions(connectionId: string): Promise<{ success: boolean; permissions: ConnectionPermissions }>;
  updatePermissions(connectionId: string, permissions: ConnectionPermissions): Promise<{ success: boolean; permissions: ConnectionPermissions }>;

  syncNow(connectionId: string): Promise<{ success: boolean; message: string; jobs: any[]; entities: string[] }>;
  sync(connectionId: string): Promise<{ success: boolean; message: string; jobs: any[]; entities: string[] }>;

  getSyncHistory(connectionId: string): Promise<{
    success: boolean;
    connection_id: string;
    status: string;
    last_sync: string | null;
    records_synced: number;
    history: any[];
  }>;

  getCustomers(connectionId: string): Promise<CustomerMaster[]>;
  getVendors(connectionId: string): Promise<VendorMaster[]>;
  getSales(connectionId: string): Promise<SalesInvoice[]>;
  getInventory(connectionId: string): Promise<StockItem[]>;
  getStockGroups(connectionId: string): Promise<any[]>;
  getUnits(connectionId: string): Promise<any[]>;
  getGodowns(connectionId: string): Promise<any[]>;
  getLedgers(connectionId: string): Promise<LedgerItem[]>;
  getGroups(connectionId: string): Promise<any[]>;
  getCostCenters(connectionId: string): Promise<any[]>;
  getSalesOrders(connectionId: string): Promise<any[]>;
  getPurchaseOrders(connectionId: string): Promise<any[]>;
  getDeliveryNotes(connectionId: string): Promise<any[]>;
  getReceiptNotes(connectionId: string): Promise<any[]>;
  getTrialBalance(connectionId: string): Promise<TrialBalanceItem[]>;

  static verifyWebhookSignature(rawBody: string | Buffer | object, signatureHeader: string, apiSecret: string): boolean;
}

export function connectTally(params: CreateSessionParams & { baseUrl?: string }): Promise<CreateSessionResult>;
