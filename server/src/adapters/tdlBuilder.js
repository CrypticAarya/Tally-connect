/**
 * TDL (Tally Definition Language) and XML Request Builder
 * 
 * Constructs standard TDL envelope requests for TallyPrime's HTTP server (port 9000).
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
              LEDGERCONTACT, BANKDETAILS.*
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
              GUID, NAME, PARENT, DESCRIPTION, AFFECTSSTOCK,
              ISCOSTCENTRESON, GSTAPPLICABLE, TDSAPPLICABLE,
              NARRATION
            </FETCH>
          </COLLECTION>
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
   * Request to extract Trial Balance balances
   */
  static buildTrialBalanceRequest(options = {}) {
    const fromDate = formatTallyDate(options.fromDate || '2026-04-01');
    const toDate = formatTallyDate(options.toDate || '2027-03-31');

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
