/**
 * TDL (Tally Definition Language) and XML Request Builder
 * 
 * Constructs standard TDL envelope requests for TallyPrime's HTTP server (port 9000).
 * Supports:
 * - Master Data: Groups, Ledgers, Cost Centres, Stock Items, Stock Groups, Units, Godowns, Customers, Vendors
 * - Transactions: Sales Orders, Purchase Orders, Delivery Notes, Receipt Notes, Sales Register, Trial Balance
 * 
 * Compatible with Tally.ERP 9 and TallyPrime 1.0 – 4.x.
 */

/**
 * Formats a JavaScript Date or YYYY-MM-DD string to Tally YYYYMMDD format
 */
export function formatTallyDate(dateInput) {
  if (!dateInput) return '';
  if (typeof dateInput === 'string' && /^\d{8}$/.test(dateInput)) return dateInput;
  
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

export class TdlBuilder {
  /**
   * Request to discover active open companies in TallyPrime
   */
  static buildCompanyRequest() {
    return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>ActiveCompaniesCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="ActiveCompaniesCollection">
            <TYPE>Company</TYPE>
            <FETCH>NAME, GUID, STARTINGFROM, ENDINGAT</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
  }

  /**
   * Request to extract Customer Master ledgers under Sundry Debtors
   */
  static buildCustomerRequest() {
    return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>CustomerMasterCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="CustomerMasterCollection">
            <TYPE>Ledger</TYPE>
            <FILTER>IsSundryDebtor</FILTER>
            <FETCH>
              GUID, NAME, PARENT, MAILINGNAME, PINCODE, STATENAME,
              COUNTRYNAME, ADDRESS, PARTYGSTIN, PANNUMBER,
              BILLCREDITPERIOD, CREDITLIMIT, LEDGERPHONE, EMAIL,
              LEDGERCONTACT, BANKDETAILS.*, OPENINGBALANCE, CLOSINGBALANCE
            </FETCH>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="IsSundryDebtor">
            $$IsBelongsTo:$$GroupSundryDebtors:$Parent
          </SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
  }

  /**
   * Request to extract Vendor Master ledgers under Sundry Creditors
   */
  static buildVendorRequest() {
    return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>VendorMasterCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="VendorMasterCollection">
            <TYPE>Ledger</TYPE>
            <FILTER>IsSundryCreditor</FILTER>
            <FETCH>
              GUID, NAME, PARENT, MAILINGNAME, PINCODE, STATENAME,
              COUNTRYNAME, ADDRESS, PARTYGSTIN, PANNUMBER,
              BILLCREDITPERIOD, CREDITLIMIT, LEDGERPHONE, EMAIL,
              LEDGERCONTACT, BANKDETAILS.*, OPENINGBALANCE, CLOSINGBALANCE
            </FETCH>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="IsSundryCreditor">
            $$IsBelongsTo:$$GroupSundryCreditors:$Parent
          </SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
  }

  /**
   * Request to extract all Groups
   */
  static buildGroupRequest() {
    return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>GroupMasterCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="GroupMasterCollection">
            <TYPE>Group</TYPE>
            <FETCH>GUID, NAME, PARENT, BASICGROUPISCALCULATE, ISADDABLE, ISSUBLEDGER</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
  }

  /**
   * Request to extract all Ledgers
   */
  static buildLedgerRequest() {
    return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Collection of Ledgers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Collection of Ledgers">
            <TYPE>Ledger</TYPE>
            <FETCH>
              GUID, NAME, PARENT, DESCRIPTION, OPENINGBALANCE, CLOSINGBALANCE,
              GSTAPPLICABLE, ISCOSTCENTRESON, MAILINGNAME, PINCODE, STATENAME,
              COUNTRYNAME, PARTYGSTIN, PANNUMBER, LEDGERPHONE, EMAIL, NARRATION
            </FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
  }

  /**
   * Request to extract Chart of Accounts (all ledgers and parent groups)
   */
  static buildChartOfAccountsRequest() {
    return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>ChartOfAccountsCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="ChartOfAccountsCollection">
            <TYPE>Ledger</TYPE>
            <FETCH>
              GUID, NAME, PARENT, DESCRIPTION, OPENINGBALANCE, CLOSINGBALANCE,
              GSTAPPLICABLE, ISCOSTCENTRESON, MAILINGNAME, PINCODE, STATENAME,
              COUNTRYNAME, PARTYGSTIN, PANNUMBER, LEDGERPHONE, EMAIL, NARRATION
            </FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
  }

  /**
   * Request to extract Cost Centres
   */
  static buildCostCentreRequest() {
    return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>CostCentreCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="CostCentreCollection">
            <TYPE>Cost Centre</TYPE>
            <FETCH>GUID, NAME, PARENT, CATEGORY</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
  }

  /**
   * Request to extract Stock Items
   */
  static buildStockItemRequest() {
    return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>StockItemCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="StockItemCollection">
            <TYPE>StockItem</TYPE>
            <FETCH>
              GUID, NAME, PARENT, BASEUNITS, OPENINGBALANCE, OPENINGRATE, OPENINGVALUE,
              CLOSINGBALANCE, CLOSINGRATE, CLOSINGVALUE, GSTAPPLICABLE, GSTTYPEOFSUPPLY,
              HSNCODE, DESCRIPTION, COSTINGMETHOD, REORDERBASE, MINORDERQTY, MAXSTOCKLEVEL, GSTRATE
            </FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
  }

  /**
   * Request to extract Stock Groups
   */
  static buildStockGroupRequest() {
    return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>StockGroupCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="StockGroupCollection">
            <TYPE>StockGroup</TYPE>
            <FETCH>GUID, NAME, PARENT, ISADDABLE</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
  }

  /**
   * Request to extract Units of Measurement
   */
  static buildUnitRequest() {
    return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>UnitCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="UnitCollection">
            <TYPE>Unit</TYPE>
            <FETCH>GUID, NAME, ORIGINALNAME, DECIMALPLACES, ISGSTEXCLUDED</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
  }

  /**
   * Request to extract Godowns (Locations)
   */
  static buildGodownRequest() {
    return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>GodownCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="GodownCollection">
            <TYPE>Godown</TYPE>
            <FETCH>GUID, NAME, PARENT, ADDRESS, PINCODE</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
  }

  /**
   * Request to extract Sales Orders
   */
  static buildSalesOrderRequest(options = {}) {
    const fromDate = formatTallyDate(options.fromDate || '2026-04-01');
    const toDate = formatTallyDate(options.toDate || '2027-03-31');

    return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>SalesOrderCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVFROMDATE TYPE="Date">${fromDate}</SVFROMDATE>
        <SVTODATE TYPE="Date">${toDate}</SVTODATE>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="SalesOrderCollection">
            <TYPE>Voucher</TYPE>
            <FILTER>IsSalesOrderVch</FILTER>
            <FETCH>
              GUID, DATE, VOUCHERNUMBER, VOUCHERTYPENAME, REFERENCE,
              PARTYLEDGERNAME, PARTYGSTIN, PLACEOFSUPPLY, NARRATION,
              BASICDUEDATE, ALLINVENTORYENTRIES.*, LEDGERENTRIES.*
            </FETCH>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="IsSalesOrderVch">
            $$IsSalesOrder:$VoucherTypeName
          </SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
  }

  /**
   * Request to extract Purchase Orders
   */
  static buildPurchaseOrderRequest(options = {}) {
    const fromDate = formatTallyDate(options.fromDate || '2026-04-01');
    const toDate = formatTallyDate(options.toDate || '2027-03-31');

    return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>PurchaseOrderCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVFROMDATE TYPE="Date">${fromDate}</SVFROMDATE>
        <SVTODATE TYPE="Date">${toDate}</SVTODATE>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="PurchaseOrderCollection">
            <TYPE>Voucher</TYPE>
            <FILTER>IsPurchaseOrderVch</FILTER>
            <FETCH>
              GUID, DATE, VOUCHERNUMBER, VOUCHERTYPENAME, REFERENCE,
              PARTYLEDGERNAME, PARTYGSTIN, PLACEOFSUPPLY, NARRATION,
              BASICDUEDATE, ALLINVENTORYENTRIES.*, LEDGERENTRIES.*
            </FETCH>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="IsPurchaseOrderVch">
            $$IsPurchaseOrder:$VoucherTypeName
          </SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
  }

  /**
   * Request to extract Delivery Notes
   */
  static buildDeliveryNoteRequest(options = {}) {
    const fromDate = formatTallyDate(options.fromDate || '2026-04-01');
    const toDate = formatTallyDate(options.toDate || '2027-03-31');

    return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>DeliveryNoteCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVFROMDATE TYPE="Date">${fromDate}</SVFROMDATE>
        <SVTODATE TYPE="Date">${toDate}</SVTODATE>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="DeliveryNoteCollection">
            <TYPE>Voucher</TYPE>
            <FILTER>IsDelNoteVch</FILTER>
            <FETCH>
              GUID, DATE, VOUCHERNUMBER, VOUCHERTYPENAME, REFERENCE,
              PARTYLEDGERNAME, PARTYGSTIN, PLACEOFSUPPLY, NARRATION,
              ALLINVENTORYENTRIES.*, LEDGERENTRIES.*
            </FETCH>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="IsDelNoteVch">
            $$IsDeliveryNote:$VoucherTypeName
          </SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
  }

  /**
   * Request to extract Receipt Notes
   */
  static buildReceiptNoteRequest(options = {}) {
    const fromDate = formatTallyDate(options.fromDate || '2026-04-01');
    const toDate = formatTallyDate(options.toDate || '2027-03-31');

    return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>ReceiptNoteCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVFROMDATE TYPE="Date">${fromDate}</SVFROMDATE>
        <SVTODATE TYPE="Date">${toDate}</SVTODATE>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="ReceiptNoteCollection">
            <TYPE>Voucher</TYPE>
            <FILTER>IsRcptNoteVch</FILTER>
            <FETCH>
              GUID, DATE, VOUCHERNUMBER, VOUCHERTYPENAME, REFERENCE,
              PARTYLEDGERNAME, PARTYGSTIN, PLACEOFSUPPLY, NARRATION,
              ALLINVENTORYENTRIES.*, LEDGERENTRIES.*
            </FETCH>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="IsRcptNoteVch">
            $$IsReceiptNote:$VoucherTypeName
          </SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
  }

  /**
   * Request to extract Sales Register vouchers with date-range filters
   * and hierarchical inventory + ledger line items
   */
  static buildSalesRegisterRequest(options = {}) {
    const fromDate = formatTallyDate(options.fromDate || '2026-04-01');
    const toDate = formatTallyDate(options.toDate || '2027-03-31');

    return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>SalesRegisterVouchersCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVFROMDATE TYPE="Date">${fromDate}</SVFROMDATE>
        <SVTODATE TYPE="Date">${toDate}</SVTODATE>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="SalesRegisterVouchersCollection">
            <TYPE>Voucher</TYPE>
            <FILTER>IsSalesVch</FILTER>
            <FETCH>
              GUID, DATE, VOUCHERNUMBER, VOUCHERTYPENAME, REFERENCE,
              PARTYLEDGERNAME, PARTYGSTIN, PLACEOFSUPPLY, NARRATION,
              ALLINVENTORYENTRIES.*, LEDGERENTRIES.*
            </FETCH>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="IsSalesVch">
            $$IsSales:$VoucherTypeName
          </SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
  }

  /**
   * Request to extract Purchase Register vouchers with date-range filters
   * and hierarchical inventory + ledger line items
   */
  static buildPurchaseRegisterRequest(options = {}) {
    const fromDate = formatTallyDate(options.fromDate || '2026-04-01');
    const toDate = formatTallyDate(options.toDate || '2027-03-31');

    return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>PurchaseRegisterVouchersCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVFROMDATE TYPE="Date">${fromDate}</SVFROMDATE>
        <SVTODATE TYPE="Date">${toDate}</SVTODATE>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="PurchaseRegisterVouchersCollection">
            <TYPE>Voucher</TYPE>
            <FILTER>IsPurchaseVch</FILTER>
            <FETCH>
              GUID, DATE, VOUCHERNUMBER, VOUCHERTYPENAME, REFERENCE,
              PARTYLEDGERNAME, PARTYGSTIN, PLACEOFSUPPLY, NARRATION,
              BASICDUEDATE, ALLINVENTORYENTRIES.*, LEDGERENTRIES.*
            </FETCH>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="IsPurchaseVch">
            $$IsPurchase:$VoucherTypeName
          </SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
  }

  /**
   * Request to extract official Trial Balance Report (TYPE = Data, ID = TrialBalance)
   * Uses EXPLODEFLAG=Yes and SVCurrentCompany per official Tally XML specifications
   */
  static buildTrialBalanceRequest(options = {}) {
    const fromDate = formatTallyDate(options.fromDate || '2026-04-01');
    const toDate = formatTallyDate(options.toDate || '2026-09-30');
    const company = options.companyName || options.company || '';
    const companyTag = company ? `\n        <SVCurrentCompany>${company}</SVCurrentCompany>` : '';

    return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>TrialBalance</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVFROMDATE TYPE="Date">${fromDate}</SVFROMDATE>
        <SVTODATE TYPE="Date">${toDate}</SVTODATE>
        <EXPLODEFLAG>Yes</EXPLODEFLAG>${companyTag}
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
  }

  /**
   * Collection-based fallback request for Trial Balance ledger balances
   */
  static buildTrialBalanceCollectionRequest(options = {}) {
    const fromDate = formatTallyDate(options.fromDate || '2026-04-01');
    const toDate = formatTallyDate(options.toDate || '2026-09-30');

    return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>TrialBalanceLedgersCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVFROMDATE TYPE="Date">${fromDate}</SVFROMDATE>
        <SVTODATE TYPE="Date">${toDate}</SVTODATE>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="TrialBalanceLedgersCollection">
            <TYPE>Ledger</TYPE>
            <FETCH>
              GUID, NAME, PARENT, OPENINGBALANCE,
              DEBITTOTALS, CREDITTOTALS, CLOSINGBALANCE
            </FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`.trim();
  }
}
