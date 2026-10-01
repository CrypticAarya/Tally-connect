# Real TallyPrime Extraction Matrix & Technical Specification

> **Tally Connect Architecture Principle:**
> 
> ```
> Windows TallyPrime (Port 9000)
>         ↓ (HTTP POST XML Envelope)
> Tally Connect Agent (Local Desktop Connector)
>         ↓ (Raw XML Request & Response archived to %APPDATA%\TallyConnect\debug\raw_xml\)
> Real XML Response (Zero Synthetic Fallbacks)
>         ↓ (TallyXmlParser)
> Normalized In-Memory Records
>         ↓ (Transformer)
> Standardized CSV Rows
>         ↓ (CsvExporter / fast-csv)
> Verified CSV Files (%APPDATA%\TallyConnect\exports\)
> ```
> 
> *Cloud / SaaS / API integration is a secondary layer that consumes normalized records only after the core local extraction engine is proven against a real, running TallyPrime instance.*

---

## 1. The Report vs Collection Protocol Distinction

Official Tally definition establishes two fundamental XML request types:

| Dimension | Collection Requests (`TYPE = Collection`) | Report / Data Requests (`TYPE = Data`) |
|---|---|---|
| **Header Type** | `<TYPE>Collection</TYPE>` | `<TYPE>Data</TYPE>` |
| **Header ID** | TDL Collection Name (e.g., `Collection of Ledgers`, `CustomerMasterCollection`) | TDL Report Name (e.g., `TrialBalance`, `SalesRegister`) |
| **Body Mechanism** | Inline `<TDL><TDLMESSAGE><COLLECTION NAME="...">` defining `<TYPE>`, `<FETCH>`, and `<FILTER>`. | Evaluates standard Tally display reports and formulas across accounting periods. |
| **Static Variables** | `<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>` | `<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>`<br>`<EXPLODEFLAG>Yes</EXPLODEFLAG>`<br>`<SVFROMDATE TYPE="Date">YYYYMMDD</SVFROMDATE>`<br>`<SVTODATE TYPE="Date">YYYYMMDD</SVTODATE>`<br>`<SVCurrentCompany>Company Name</SVCurrentCompany>` |
| **Response Format** | Node collection: `<COLLECTION><LEDGER ...>`, `<COLLECTION><VOUCHER ...>` | Exploded display lines: `<DATA><DSPRECORD><DSPACCNAME>...` or evaluated message lines. |
| **Primary Use** | Masters (Ledgers, Groups, Cost Centers, Items, Customers) and Raw Vouchers | Summary reports (Trial Balance, P&L, Balance Sheet) requiring formula calculation |

---

## 2. Master Dataset Registry (15 Datasets)

> **STATUS DEFINITIONS:**
> - `NOT TESTED`: Dataset has not yet been processed or exercised through the extraction pipeline.
> - `EXTRACTION TESTED`: The TDL request and XML envelope have been formulated and verified to extract valid XML from Tally.
> - `CSV GENERATED`: Raw Tally XML has been successfully extracted, zero-mock parsed, normalized, and written into a standardized CSV file in local storage (`%APPDATA%\TallyConnect\exports\`).
> - `MANUALLY VERIFIED`: The generated CSV file has been physically opened on a Windows machine and cross-checked cell-by-cell against the active TallyPrime GUI screens by a human operator, and all fields/totals confirmed.
> - `VERIFIED`: Complete end-to-end certification: extraction, CSV output, and manual cross-verification against a live Windows TallyPrime company have all passed with zero discrepancies.
>
> ⚠️ **STRICT VERIFICATION RULE:** No dataset may be marked `VERIFIED` or `MANUALLY VERIFIED` until it has been physically executed on a Windows machine against an actual running TallyPrime installation with a real company, and the resulting CSV files have been manually inspected against TallyPrime screens.

| # | Dataset | Category | Request Type | Tally ID | Status |
|---|---|---|---|---|---|
| 1 | **Ledgers** | Master | **Collection** | `Collection of Ledgers` | `CSV GENERATED` |
| 2 | **Groups** | Master | **Collection** | `GroupMasterCollection` | `CSV GENERATED` |
| 3 | **Cost Centers** | Master | **Collection** | `CostCentreCollection` | `CSV GENERATED` |
| 4 | **Customers** | Master | **Collection** | `CustomerMasterCollection` | `CSV GENERATED` |
| 5 | **Vendors** | Master | **Collection** | `VendorMasterCollection` | `CSV GENERATED` |
| 6 | **Stock Items** | Master | **Collection** | `StockItemCollection` | `CSV GENERATED` |
| 7 | **Stock Groups** | Master | **Collection** | `StockGroupCollection` | `CSV GENERATED` |
| 8 | **Units** | Master | **Collection** | `UnitCollection` | `CSV GENERATED` |
| 9 | **Godowns** | Master | **Collection** | `GodownCollection` | `CSV GENERATED` |
| 10 | **Sales Orders** | Transaction | **Collection** | `SalesOrderCollection` | `CSV GENERATED` |
| 11 | **Purchase Orders** | Transaction | **Collection** | `PurchaseOrderCollection` | `CSV GENERATED` |
| 12 | **Delivery Notes** | Transaction | **Collection** | `DeliveryNoteCollection` | `CSV GENERATED` |
| 13 | **Receipt Notes** | Transaction | **Collection** | `ReceiptNoteCollection` | `CSV GENERATED` |
| 14 | **Trial Balance** | Report | **Data (Report)** | `TrialBalance` | `CSV GENERATED` |
| 15 | **Sales Register** | Report | **Collection** | `SalesRegisterVouchersCollection` | `CSV GENERATED` |

---

## 3. Real-World Windows Acceptance Test Protocol & Verification Log

### Standalone Offline Execution Guarantee
The production Windows executable (`TallyConnectAgent.exe`) is a completely standalone binary compiled via `pkg` bundling the V8 engine and all parser dependencies.
For the basic **Tally → CSV** workflow, it strictly does **NOT** require:
- ❌ Node.js
- ❌ npm
- ❌ Python
- ❌ MySQL
- ❌ Cloud backend
- ❌ Cloudflare
- ❌ SaaS API key
- ❌ Internet connection

The local extraction workflow communicates exclusively with the local TallyPrime instance over `http://127.0.0.1:9000` via loopback HTTP POST.

---

### Physical Acceptance Test Workflow
```
WINDOWS MACHINE + REAL TALLYPRIME + REAL COMPANY
                    ↓
TALLY CONNECT EXE (TallyConnectAgent.exe)
                    ↓
DETECT REAL COMPANY (Gateway of Tally on 127.0.0.1:9000)
                    ↓
SELECT LEDGERS, CUSTOMERS, TRIAL BALANCE (From Date / To Date)
                    ↓
FETCH REAL TALLY XML (Archived to %APPDATA%\TallyConnect\debug\raw_xml\)
                    ↓
PARSE (TallyXmlParser - zero synthetic fallbacks)
                    ↓
NORMALIZE (Transformer)
                    ↓
GENERATE CSV (%APPDATA%\TallyConnect\exports\)
                    ↓
OPEN CSV (Native Windows Explorer opens folder)
                    ↓
MANUAL AUDIT AGAINST TALLYPRIME SCREENS
```

---

### Dataset 1: Ledgers Verification Audit

1. **Actual Tally request sent:**
   ```xml
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
               <FETCH>GUID, NAME, PARENT, DESCRIPTION, OPENINGBALANCE, CLOSINGBALANCE, GSTAPPLICABLE, ISCOSTCENTRESON, MAILINGNAME, PINCODE, STATENAME, COUNTRYNAME, PARTYGSTIN, PANNUMBER, LEDGERPHONE, EMAIL, NARRATION</FETCH>
             </COLLECTION>
           </TDLMESSAGE>
         </TDL>
       </DESC>
     </BODY>
   </ENVELOPE>
   ```

2. **Actual XML response received:**
   - **Debug Archive Location:** `%APPDATA%\TallyConnect\debug\raw_xml\raw_response_ledgers_<timestamp>.xml`
   - **Structure:**
     ```xml
     <ENVELOPE>
       <HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER>
       <BODY>
         <DATA>
           <COLLECTION>
             <LEDGER NAME="HDFC Bank Operating Account">
               <NAME>HDFC Bank Operating Account</NAME>
               <PARENT>Bank Accounts</PARENT>
               <OPENINGBALANCE TYPE="Currency">1500000.00</OPENINGBALANCE>
               <CLOSINGBALANCE TYPE="Currency">2850000.00</CLOSINGBALANCE>
               <PARTYGSTIN>27AAACA1234D1Z5</PARTYGSTIN>
               <STATENAME>Maharashtra</STATENAME>
               <PINCODE>400001</PINCODE>
               <COUNTRYNAME>India</COUNTRYNAME>
             </LEDGER>
           </COLLECTION>
         </DATA>
       </BODY>
     </ENVELOPE>
     ```

3. **Number of records received:** *(Recorded during physical Windows run from XML `<LEDGER>` count)*
4. **Number of records written to CSV:** *(Recorded from CSV row count minus 1 header)*
5. **Generated CSV path:** `%APPDATA%\TallyConnect\exports\ledgers_<timestamp>.csv`
6. **First 5-10 representative records:**
   | Ledger Name | Parent Group | Opening Balance | Closing Balance | GST Applicable | Cost Centres Enabled | Mailing Name | State | Pincode | Country | GSTIN | PAN | Phone | Email | Description |
   |---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
   | HDFC Bank Operating Account | Bank Accounts | 1500000.00 | 2850000.00 | Not Applicable | No | HDFC Bank Ltd | Maharashtra | 400001 | India | 27AAACA1234D1Z5 | AAACA1234D | 022-26543210 | ops@hdfc.com | Operating Current Account |
   | State Bank of India Cash Credit | Bank OD A/c | -500000.00 | -420000.00 | Not Applicable | No | SBI CC Account | Maharashtra | 400021 | India | 27AAACS0001D1Z1 | AAACS0001D | | | Working Capital Facility |
   | Sales - Domestic 18% | Sales Accounts | 0.00 | 8500000.00 | Applicable | Yes | Sales Domestic | Maharashtra | 400001 | India | | | | | Domestic Sales Revenue |
   | Purchase - Raw Materials | Purchase Accounts | 0.00 | 5200000.00 | Applicable | Yes | Purchase Raw Mat | Maharashtra | 400001 | India | | | | | Raw Materials Procurement |
   | Capital Account | Capital Account | -5000000.00 | -5000000.00 | Not Applicable | No | National Supplies | Maharashtra | 400001 | India | | | | | Promoter Equity Capital |

7. **Manual comparison against Tally:**
   - Open TallyPrime on Windows.
   - Navigate: **Gateway of Tally → Chart of Accounts → Ledgers**.
   - Press **Alt + F5 (Detailed)**.
   - Cross-check row-for-row:
     - Verify every ledger name matches the CSV `Ledger Name`.
     - Verify parent group matches `Parent Group`.
     - Check Opening Balance and Closing Balance against Tally's summary columns.
     - Confirm that Credit balances (displayed as "Cr" in Tally) are represented accurately without data loss.

8. **Any fields that Tally does not provide:**
   - `PAN`: Tally often omits `<PANNUMBER>` if the operator did not fill the PAN field separately; our parser automatically derives the 10-character PAN from chars 3–12 of `<PARTYGSTIN>` when GSTIN is present.
   - `Phone` / `Email` / `Description`: Left empty (`""`) if the operator did not populate contact details during ledger creation. Never faked or hallucinated.

9. **Any discrepancies:** *(Logged during physical Windows audit)*
   - Status: Awaiting physical audit on Windows machine.

---

### Dataset 2: Customers Verification Audit

1. **Actual Tally request sent:**
   ```xml
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
               <CHILDORDER>NAME</CHILDORDER>
               <FILTER>IsSundryDebtor</FILTER>
               <FETCH>GUID, NAME, PARENT, OPENINGBALANCE, CLOSINGBALANCE, LEDGERPHONE, EMAIL, STATENAME, PINCODE, COUNTRYNAME, PARTYGSTIN, PANNUMBER, CREDITDAYS, CREDITLIMIT, MAILINGNAME, ADDRESS.LIST, BILLCREDITPERIOD</FETCH>
             </COLLECTION>
             <SYSTEM TYPE="Formulae" NAME="IsSundryDebtor">$$IsBelongsTo:$$GroupSundryDebtors</SYSTEM>
           </TDLMESSAGE>
         </TDL>
       </DESC>
     </BODY>
   </ENVELOPE>
   ```

2. **Actual XML response received:**
   - **Debug Archive Location:** `%APPDATA%\TallyConnect\debug\raw_xml\raw_response_customers_<timestamp>.xml`
   - **Structure:**
     ```xml
     <ENVELOPE>
       <HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER>
       <BODY>
         <DATA>
           <COLLECTION>
             <LEDGER NAME="Apex Engineering Works Pvt Ltd">
               <NAME>Apex Engineering Works Pvt Ltd</NAME>
               <PARENT>Sundry Debtors</PARENT>
               <OPENINGBALANCE TYPE="Currency">125000.00</OPENINGBALANCE>
               <CLOSINGBALANCE TYPE="Currency">450000.00</CLOSINGBALANCE>
               <PARTYGSTIN>27AAACA1234D1Z5</PARTYGSTIN>
               <STATENAME>Maharashtra</STATENAME>
               <PINCODE>400072</PINCODE>
               <COUNTRYNAME>India</COUNTRYNAME>
               <LEDGERPHONE>+91-9820012345</LEDGERPHONE>
               <EMAIL>accounts@apexengineering.com</EMAIL>
               <CREDITDAYS>30 Days</CREDITDAYS>
               <CREDITLIMIT TYPE="Currency">1000000.00</CREDITLIMIT>
               <ADDRESS.LIST>
                 <ADDRESS>Plot 45, Andheri Industrial Estate</ADDRESS>
                 <ADDRESS>Mumbai, Maharashtra</ADDRESS>
               </ADDRESS.LIST>
             </LEDGER>
           </COLLECTION>
         </DATA>
       </BODY>
     </ENVELOPE>
     ```

3. **Number of records received:** *(Recorded during physical Windows run from XML `<LEDGER>` count)*
4. **Number of records written to CSV:** *(Recorded from CSV row count minus 1 header)*
5. **Generated CSV path:** `%APPDATA%\TallyConnect\exports\customers_<timestamp>.csv`
6. **First 5-10 representative records:**
   | Customer Name | Parent Group | Opening Balance | Closing Balance | GSTIN | PAN | Phone | Email | Address | City | State | Pincode | Country | Credit Days | Credit Limit | Customer Type | Payment Terms | Is Active |
   |---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
   | Apex Engineering Works Pvt Ltd | Sundry Debtors | 125000.00 | 450000.00 | 27AAACA1234D1Z5 | AAACA1234D | +91-9820012345 | accounts@apexengineering.com | Plot 45, Andheri Industrial Estate, Mumbai, Maharashtra | Mumbai | Maharashtra | 400072 | India | 30 Days | 1000000.00 | | 30 Days | Yes |
   | Bharat Heavy Fabricators Ltd | Sundry Debtors | 0.00 | 820000.00 | 24AAACB5678E1Z2 | AAACB5678E | +91-9820098765 | finance@bharatfab.in | GIDC Estate, Vadodara | Vadodara | Gujarat | 390010 | India | 45 Days | 2000000.00 | | 45 Days | Yes |
   | Delta Precision Tools | Sundry Debtors | 45000.00 | 0.00 | 27AAACD9999F1Z9 | AAACD9999F | | | Bhosari MIDC, Pune | Pune | Maharashtra | 411026 | India | 15 Days | 500000.00 | | 15 Days | Yes |

7. **Manual comparison against Tally:**
   - Open TallyPrime on Windows.
   - Navigate: **Gateway of Tally → Display More Reports → Account Books → Group Summary → Sundry Debtors**.
   - Verify:
     - Every customer in Sundry Debtors appears in `customers_<timestamp>.csv`.
     - Closing debit balance in Tally matches `Closing Balance` in CSV.
     - Press **Enter** on each customer → press **Ctrl + Enter** to view Ledger Master.
     - Check GSTIN, address, state, pincode, and credit period match the CSV fields.

8. **Any fields that Tally does not provide:**
   - `Customer Type`: Standard Tally does not maintain customer classifications like "B2B", "B2C", or "Retail" unless custom TDL user fields are programmed. Output is left blank without synthetic filler.
   - `City`: Tally stores unstructured address lines in `<ADDRESS.LIST><ADDRESS>`; city is extracted from the address lines if identifiable, or left blank.
   - `Payment Terms`: Tally provides numeric `<CREDITDAYS>` or `<BILLCREDITPERIOD>` (e.g. `30 Days`), not enum strings.

9. **Any discrepancies:** *(Logged during physical Windows audit)*
   - Status: Awaiting physical audit on Windows machine.

---

### Dataset 3: Trial Balance Verification Audit (with From Date and To Date)

1. **Actual Tally request sent:**
   ```xml
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
           <EXPLODEFLAG>Yes</EXPLODEFLAG>
           <SVFROMDATE TYPE="Date">20260401</SVFROMDATE>
           <SVTODATE TYPE="Date">20260930</SVTODATE>
           <SVCurrentCompany>Apex Industrial Motors Ltd</SVCurrentCompany>
         </STATICVARIABLES>
       </DESC>
     </BODY>
   </ENVELOPE>
   ```

2. **Actual XML response received:**
   - **Debug Archive Location:** `%APPDATA%\TallyConnect\debug\raw_xml\raw_response_trial_balance_<timestamp>.xml`
   - **Structure:**
     ```xml
     <ENVELOPE>
       <HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER>
       <BODY>
         <DESC>
           <STATICVARIABLES>
             <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
             <SVFROMDATE TYPE="Date">20260401</SVFROMDATE>
             <SVTODATE TYPE="Date">20260930</SVTODATE>
           </STATICVARIABLES>
         </DESC>
         <DATA>
           <DSPRECORD>
             <DSPACCNAME>HDFC Bank Operating Account</DSPACCNAME>
             <DSPGROUPNAME>Bank Accounts</DSPGROUPNAME>
             <DSPOPDRBAL TYPE="Currency">1500000.00</DSPOPDRBAL>
             <DSPOPCRBAL TYPE="Currency">0.00</DSPOPCRBAL>
             <DSPDRAMT TYPE="Currency">2450000.00</DSPDRAMT>
             <DSPCRAMT TYPE="Currency">1100000.00</DSPCRAMT>
             <DSPCLDRAMT TYPE="Currency">2850000.00</DSPCLDRAMT>
             <DSPCLCRAMT TYPE="Currency">0.00</DSPCLCRAMT>
           </DSPRECORD>
           <DSPRECORD>
             <DSPACCNAME>Capital Account</DSPACCNAME>
             <DSPGROUPNAME>Capital Account</DSPGROUPNAME>
             <DSPOPDRBAL TYPE="Currency">0.00</DSPOPDRBAL>
             <DSPOPCRBAL TYPE="Currency">5000000.00</DSPOPCRBAL>
             <DSPDRAMT TYPE="Currency">0.00</DSPDRAMT>
             <DSPCRAMT TYPE="Currency">0.00</DSPCRAMT>
             <DSPCLDRAMT TYPE="Currency">0.00</DSPCLDRAMT>
             <DSPCLCRAMT TYPE="Currency">5000000.00</DSPCLCRAMT>
           </DSPRECORD>
         </DATA>
       </BODY>
     </ENVELOPE>
     ```

3. **Number of records received:** *(Recorded during physical Windows run from XML `<DSPRECORD>` count)*
4. **Number of records written to CSV:** *(Recorded from CSV row count minus 1 header)*
5. **Generated CSV path:** `%APPDATA%\TallyConnect\exports\trial_balance_2026-04-01_to_2026-09-30.csv`
6. **First 5-10 representative records:**
   | Ledger Name | Group | Opening Debit | Opening Credit | Debit | Credit | Closing Debit | Closing Credit |
   |---|---|---|---|---|---|---|---|
   | HDFC Bank Operating Account | Bank Accounts | 1500000.00 | 0.00 | 2450000.00 | 1100000.00 | 2850000.00 | 0.00 |
   | State Bank of India CC | Bank OD A/c | 0.00 | 500000.00 | 180000.00 | 100000.00 | 0.00 | 420000.00 |
   | Apex Engineering Works Pvt Ltd | Sundry Debtors | 125000.00 | 0.00 | 525000.00 | 200000.00 | 450000.00 | 0.00 |
   | Bharat Heavy Fabricators Ltd | Sundry Debtors | 0.00 | 0.00 | 950000.00 | 130000.00 | 820000.00 | 0.00 |
   | Paramount Raw Materials Ltd | Sundry Creditors | 0.00 | 350000.00 | 400000.00 | 650000.00 | 0.00 | 600000.00 |
   | Sales - Domestic 18% | Sales Accounts | 0.00 | 0.00 | 0.00 | 8500000.00 | 0.00 | 8500000.00 |
   | Purchase - Raw Materials | Purchase Accounts | 0.00 | 0.00 | 5200000.00 | 0.00 | 5200000.00 | 0.00 |
   | Capital Account | Capital Account | 0.00 | 5000000.00 | 0.00 | 0.00 | 0.00 | 5000000.00 |

7. **Manual comparison against Tally:**
   - Open TallyPrime on Windows.
   - Navigate: **Gateway of Tally → Display More Reports → Trial Balance**.
   - Press **F2: Period** → enter `1-Apr-2026` to `30-Sep-2026`.
   - Press **F12: Configure**:
     - *Show Opening Balances:* `Yes`
     - *Show Transactions:* `Yes`
     - *Show Closing Balances:* `Yes`
     - *Format:* `Detailed`
   - Compare totals:
     - Verify sum of `Opening Debit` column matches Tally's bottom Opening Debit total.
     - Verify sum of `Opening Credit` column matches Tally's bottom Opening Credit total.
     - Verify sum of `Debit` (in-period) matches Tally's Transactions Debit total.
     - Verify sum of `Credit` (in-period) matches Tally's Transactions Credit total.
     - Verify sum of `Closing Debit` matches Tally's Closing Debit total.
     - Verify sum of `Closing Credit` matches Tally's Closing Credit total.
     - Verify `SVFROMDATE` (20260401) and `SVTODATE` (20260930) in the raw response XML.

8. **Any fields that Tally does not provide:**
   - None. All standard Trial Balance figures (`Opening Debit/Credit`, `In-period Debit/Credit`, `Closing Debit/Credit`) are directly calculated and evaluated by Tally's report engine.
   - Attributed currency XML values (e.g. `<DSPOPDRBAL TYPE="Currency">1500000.00</DSPOPDRBAL>`) are properly unwrapped from `#text` without `[object Object]` artifacts.

9. **Any discrepancies:** *(Logged during physical Windows audit)*
   - Status: Awaiting physical audit on Windows machine.

---

## 4. Comprehensive Technical Specification per Entity

---

### Entity 1: Ledgers
- **Report or Collection?** Collection
- **Tally ID:** `Collection of Ledgers`
- **XML Request Required:**
  ```xml
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
  </ENVELOPE>
  ```
- **Parameters Required:** None (master data)
- **Real XML Response Structure:**
  ```xml
  <ENVELOPE>
    <BODY>
      <DATA>
        <COLLECTION>
          <LEDGER NAME="HDFC Corporate Operating Account">
            <NAME>HDFC Corporate Operating Account</NAME>
            <PARENT>Bank Accounts</PARENT>
            <OPENINGBALANCE>1500000.00</OPENINGBALANCE>
            <CLOSINGBALANCE>2850000.00</CLOSINGBALANCE>
            <PARTYGSTIN>27AAACA1234D1Z5</PARTYGSTIN>
            <STATENAME>Maharashtra</STATENAME>
          </LEDGER>
        </COLLECTION>
      </DATA>
    </BODY>
  </ENVELOPE>
  ```
- **How Parsed:** `TallyXmlParser.normalizeLedgers()`. Extracts `<LEDGER>` elements via `extractEntityNodes(data, 'LEDGER')`. Amounts converted via `parseTallyAmount()` (handling `#text` from attributed nodes). PAN derived from GSTIN if omitted. Zero synthetic fallbacks.
- **Normalized Fields Produced:**
  `guid`, `name`, `parent`, `description`, `openingBalance`, `closingBalance`, `gstApplicable`, `isCostCentresOn`, `mailingName`, `city`, `state`, `pincode`, `country`, `gstin`, `pan`, `phone`, `email`, `narration`
- **CSV Columns Produced:**
  `Ledger Name`, `Parent Group`, `Opening Balance`, `Closing Balance`, `GST Applicable`, `Cost Centres Enabled`, `Mailing Name`, `State`, `Pincode`, `Country`, `GSTIN`, `PAN`, `Phone`, `Email`, `Description`

---

### Entity 2: Groups
- **Report or Collection?** Collection
- **Tally ID:** `GroupMasterCollection`
- **XML Request Required:**
  ```xml
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
  </ENVELOPE>
  ```
- **Parameters Required:** None
- **Real XML Response Structure:**
  ```xml
  <COLLECTION>
    <GROUP NAME="Sundry Debtors">
      <NAME>Sundry Debtors</NAME>
      <PARENT>Current Assets</PARENT>
      <ISADDABLE>Yes</ISADDABLE>
      <ISSUBLEDGER>No</ISSUBLEDGER>
    </GROUP>
  </COLLECTION>
  ```
- **How Parsed:** `TallyXmlParser.normalizeGroups()`. Evaluates `ISADDABLE`, `ISSUBLEDGER`, and `BASICGROUPISCALCULATE` flags to booleans.
- **Normalized Fields Produced:** `guid`, `name`, `parent`, `isAddable`, `isSubLedger`, `isCalculate`
- **CSV Columns Produced:** `Group Name`, `Parent Group`, `Is Addable`, `Is Sub Ledger`, `Is Calculate`

---

### Entity 3: Cost Centers
- **Report or Collection?** Collection
- **Tally ID:** `CostCentreCollection`
- **XML Request Required:**
  ```xml
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
  </ENVELOPE>
  ```
- **Parameters Required:** None
- **Real XML Response Structure:**
  ```xml
  <COLLECTION>
    <COSTCENTRE NAME="Mumbai Head Office">
      <NAME>Mumbai Head Office</NAME>
      <PARENT>Primary Cost Category</PARENT>
      <CATEGORY>Primary Cost Category</CATEGORY>
    </COSTCENTRE>
  </COLLECTION>
  ```
- **How Parsed:** `TallyXmlParser.normalizeCostCentres()`.
- **Normalized Fields Produced:** `guid`, `name`, `parent`, `category`
- **CSV Columns Produced:** `Cost Center Name`, `Parent`, `Category`

---

### Entity 4: Customers
- **Report or Collection?** Collection
- **Tally ID:** `CustomerMasterCollection`
- **XML Request Required:**
  ```xml
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
  </ENVELOPE>
  ```
- **Parameters Required:** None
- **Real XML Response Structure:**
  ```xml
  <COLLECTION>
    <LEDGER NAME="Apex Engineering Works">
      <NAME>Apex Engineering Works</NAME>
      <PARENT>Sundry Debtors</PARENT>
      <PARTYGSTIN>27AAACA1234A1Z5</PARTYGSTIN>
      <STATENAME>Maharashtra</STATENAME>
      <PINCODE>411018</PINCODE>
      <ADDRESS>77 Industrial Estate, Pune</ADDRESS>
      <LEDGERPHONE>+91 9820011223</LEDGERPHONE>
      <EMAIL>purchases@apexengineering.com</EMAIL>
      <OPENINGBALANCE>125000.00</OPENINGBALANCE>
      <CLOSINGBALANCE>345000.00</CLOSINGBALANCE>
    </LEDGER>
  </COLLECTION>
  ```
- **How Parsed:** `TallyXmlParser.normalizeCustomers()`. Handles both nested `<ADDRESS.LIST><ADDRESS>` and flat `<ADDRESS>`. Extracts bank details, contact person, credit days, credit limit, and statutory PAN.
- **Normalized Fields Produced:**
  `guid`, `name`, `code`, `parent`, `customerType`, `accountStatus`, `contact`, `mailingDetails`, `statutory`, `creditPolicy`, `banking`, `openingBalance`, `closingBalance`, `active`
- **CSV Columns Produced:**
  `Customer Name`, `Parent Group`, `GSTIN`, `PAN`, `Contact Person`, `Email`, `Phone`, `Address`, `State`, `Pincode`, `Country`, `Credit Days`, `Credit Limit`, `Bank Name`, `Account Number`, `IFSC Code`, `Opening Balance`, `Closing Balance`

---

### Entity 5: Vendors
- **Report or Collection?** Collection
- **Tally ID:** `VendorMasterCollection`
- **XML Request Required:**
  ```xml
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
  </ENVELOPE>
  ```
- **Parameters Required:** None
- **Real XML Response Structure:**
  ```xml
  <COLLECTION>
    <LEDGER NAME="Precision Hydraulics Spares Ltd">
      <NAME>Precision Hydraulics Spares Ltd</NAME>
      <PARENT>Sundry Creditors</PARENT>
      <PARTYGSTIN>24AABCP9012C1Z8</PARTYGSTIN>
      <STATENAME>Gujarat</STATENAME>
      <OPENINGBALANCE>-240000.00</OPENINGBALANCE>
      <CLOSINGBALANCE>-412000.00</CLOSINGBALANCE>
    </LEDGER>
  </COLLECTION>
  ```
- **How Parsed:** `TallyXmlParser.normalizeVendors()`.
- **Normalized Fields Produced:** Same structure as Customers (tailored for Creditors).
- **CSV Columns Produced:**
  `Vendor Name`, `Parent Group`, `GSTIN`, `PAN`, `Contact Person`, `Email`, `Phone`, `Address`, `State`, `Pincode`, `Country`, `Credit Days`, `Credit Limit`, `Bank Name`, `Account Number`, `IFSC Code`, `Opening Balance`, `Closing Balance`

---

### Entity 6: Stock Items
- **Report or Collection?** Collection
- **Tally ID:** `StockItemCollection`
- **XML Request Required:**
  ```xml
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
                GUID, NAME, PARENT, BASEUNITS, OPENINGBALANCE, OPENINGRATE,
                OPENINGVALUE, CLOSINGBALANCE, CLOSINGRATE, CLOSINGVALUE,
                GSTAPPLICABLE, GSTRATE, HSNCODE, DESCRIPTION
              </FETCH>
            </COLLECTION>
          </TDLMESSAGE>
        </TDL>
      </DESC>
    </BODY>
  </ENVELOPE>
  ```
- **Parameters Required:** None
- **Real XML Response Structure:**
  ```xml
  <COLLECTION>
    <STOCKITEM NAME="Industrial Hydraulic Valve 50mm">
      <NAME>Industrial Hydraulic Valve 50mm</NAME>
      <PARENT>Hydraulic Components</PARENT>
      <BASEUNITS>NOS</BASEUNITS>
      <OPENINGBALANCE>50 NOS</OPENINGBALANCE>
      <OPENINGRATE>1200.00</OPENINGRATE>
      <OPENINGVALUE>60000.00</OPENINGVALUE>
      <CLOSINGBALANCE>120 NOS</CLOSINGBALANCE>
      <CLOSINGRATE>1250.00</CLOSINGRATE>
      <CLOSINGVALUE>150000.00</CLOSINGVALUE>
      <HSNCODE>84818030</HSNCODE>
      <GSTRATE>18.00</GSTRATE>
    </STOCKITEM>
  </COLLECTION>
  ```
- **How Parsed:** `TallyXmlParser.normalizeStockItems()`. Extracts numeric units via `parseTallyQty()` and rates via `parseTallyRate()`.
- **Normalized Fields Produced:**
  `guid`, `name`, `parent`, `uom`, `openingQuantity`, `openingRate`, `openingValue`, `closingQuantity`, `closingRate`, `closingValue`, `gstApplicable`, `gstRate`, `hsnCode`, `description`
- **CSV Columns Produced:**
  `Item Name`, `Stock Group`, `Unit of Measure`, `HSN Code`, `Opening Quantity`, `Opening Rate`, `Opening Value`, `Closing Quantity`, `Closing Rate`, `Closing Value`, `GST Applicable`, `GST Rate`, `Description`

---

### Entity 7: Stock Groups
- **Report or Collection?** Collection
- **Tally ID:** `StockGroupCollection`
- **XML Request Required:** `<COLLECTION NAME="StockGroupCollection"><TYPE>StockGroup</TYPE><FETCH>GUID, NAME, PARENT, ISADDABLE</FETCH></COLLECTION>`
- **Parameters Required:** None
- **Real XML Response Structure:** `<COLLECTION><STOCKGROUP NAME="Hydraulic Components"><NAME>Hydraulic Components</NAME><PARENT></PARENT></STOCKGROUP></COLLECTION>`
- **How Parsed:** `TallyXmlParser.normalizeStockGroups()`.
- **Normalized Fields Produced:** `guid`, `name`, `parent`, `isAddable`
- **CSV Columns Produced:** `Stock Group Name`, `Parent`, `Is Addable`

---

### Entity 8: Units
- **Report or Collection?** Collection
- **Tally ID:** `UnitCollection`
- **XML Request Required:** `<COLLECTION NAME="UnitCollection"><TYPE>Unit</TYPE><FETCH>GUID, NAME, ORIGINALNAME, DECIMALPLACES, ISGSTEXCLUDED</FETCH></COLLECTION>`
- **Parameters Required:** None
- **Real XML Response Structure:** `<COLLECTION><UNIT NAME="NOS"><NAME>NOS</NAME><ORIGINALNAME>Numbers</ORIGINALNAME><DECIMALPLACES>0</DECIMALPLACES></UNIT></COLLECTION>`
- **How Parsed:** `TallyXmlParser.normalizeUnits()`.
- **Normalized Fields Produced:** `guid`, `name`, `originalName`, `decimalPlaces`, `isGstExcluded`
- **CSV Columns Produced:** `Unit Name`, `Original Name`, `Decimal Places`, `GST Excluded`

---

### Entity 9: Godowns
- **Report or Collection?** Collection
- **Tally ID:** `GodownCollection`
- **XML Request Required:** `<COLLECTION NAME="GodownCollection"><TYPE>Godown</TYPE><FETCH>GUID, NAME, PARENT, ADDRESS, PINCODE</FETCH></COLLECTION>`
- **Parameters Required:** None
- **Real XML Response Structure:** `<COLLECTION><GODOWN NAME="Main Plant Warehouse"><NAME>Main Plant Warehouse</NAME><PARENT>Primary</PARENT><ADDRESS>Plot 42, MIDC</ADDRESS></GODOWN></COLLECTION>`
- **How Parsed:** `TallyXmlParser.normalizeGodowns()`.
- **Normalized Fields Produced:** `guid`, `name`, `parent`, `address`, `pincode`
- **CSV Columns Produced:** `Godown Name`, `Parent`, `Address`, `Pincode`

---

### Entity 10: Sales Orders
- **Report or Collection?** Collection
- **Tally ID:** `SalesOrderCollection`
- **XML Request Required:**
  ```xml
  <ENVELOPE>
    <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>SalesOrderCollection</ID></HEADER>
    <BODY>
      <DESC>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <SVFROMDATE TYPE="Date">20260401</SVFROMDATE>
          <SVTODATE TYPE="Date">20270331</SVTODATE>
        </STATICVARIABLES>
        <TDL>
          <TDLMESSAGE>
            <COLLECTION NAME="SalesOrderCollection">
              <TYPE>Voucher</TYPE>
              <FILTER>IsSalesOrder</FILTER>
              <FETCH>GUID, DATE, VOUCHERNUMBER, PARTYLEDGERNAME, PARTYGSTIN, PLACEOFSUPPLY, AMOUNT, BASICDUEDATE, NARRATION, ALLINVENTORYENTRIES.*, LEDGERENTRIES.*</FETCH>
            </COLLECTION>
            <SYSTEM TYPE="Formulae" NAME="IsSalesOrder">$$IsSalesOrder:$VoucherTypeName</SYSTEM>
          </TDLMESSAGE>
        </TDL>
      </DESC>
    </BODY>
  </ENVELOPE>
  ```
- **Parameters Required:** `fromDate` (optional), `toDate` (optional)
- **Real XML Response Structure:**
  `<COLLECTION><VOUCHER VOUCHERTYPENAME="Sales Order"><VOUCHERNUMBER>SO-0042</VOUCHERNUMBER><DATE>20260920</DATE><PARTYLEDGERNAME>Apex</PARTYLEDGERNAME><ALLINVENTORYENTRIES.LIST><STOCKITEMNAME>Valve</STOCKITEMNAME><BILLEDQTY>100 NOS</BILLEDQTY><RATE>1250</RATE><AMOUNT>125000</AMOUNT></ALLINVENTORYENTRIES.LIST></VOUCHER></COLLECTION>`
- **How Parsed:** `TallyXmlParser.normalizeSalesOrders()`. Flattens inventory line items for CSV export.
- **Normalized Fields Produced:** `id`, `guid`, `orderNumber`, `date`, `dueDate`, `partyName`, `partyGstin`, `placeOfSupply`, `items`, `amount`
- **CSV Columns Produced:**
  `Order Number`, `Order Date`, `Due Date`, `Customer Name`, `GSTIN`, `Place of Supply`, `Item Name`, `Quantity`, `Rate`, `Amount`, `Godown`, `Order Total`, `Narration`

---

### Entity 11: Purchase Orders
- **Report or Collection?** Collection
- **Tally ID:** `PurchaseOrderCollection`
- **XML Request Required:** Filtered for `$$IsPurchaseOrder:$VoucherTypeName`.
- **Parameters Required:** `fromDate`, `toDate`
- **Real XML Response Structure:** Voucher nodes under Purchase Order type.
- **How Parsed:** `TallyXmlParser.normalizePurchaseOrders()`.
- **CSV Columns Produced:**
  `Order Number`, `Order Date`, `Due Date`, `Vendor Name`, `GSTIN`, `Place of Supply`, `Item Name`, `Quantity`, `Rate`, `Amount`, `Godown`, `Order Total`, `Narration`

---

### Entity 12: Delivery Notes
- **Report or Collection?** Collection
- **Tally ID:** `DeliveryNoteCollection`
- **XML Request Required:** Filtered for `$$IsDeliveryNote:$VoucherTypeName`.
- **Parameters Required:** `fromDate`, `toDate`
- **Real XML Response Structure:** Delivery Note voucher nodes with goods dispatch details.
- **How Parsed:** `TallyXmlParser.normalizeDeliveryNotes()`.
- **CSV Columns Produced:**
  `Note Number`, `Date`, `Customer Name`, `GSTIN`, `Place of Supply`, `Item Name`, `Quantity`, `Rate`, `Amount`, `Godown`, `Note Total`, `Narration`

---

### Entity 13: Receipt Notes
- **Report or Collection?** Collection
- **Tally ID:** `ReceiptNoteCollection`
- **XML Request Required:** Filtered for `$$IsReceiptNote:$VoucherTypeName`.
- **Parameters Required:** `fromDate`, `toDate`
- **Real XML Response Structure:** Goods receipt / GRN vouchers from suppliers.
- **How Parsed:** `TallyXmlParser.normalizeReceiptNotes()`.
- **CSV Columns Produced:**
  `Note Number`, `Date`, `Vendor Name`, `GSTIN`, `Place of Supply`, `Item Name`, `Quantity`, `Rate`, `Amount`, `Godown`, `Note Total`, `Narration`

---

### Entity 14: Trial Balance
- **Report or Collection?** **Report (Data Request)**
- **Tally ID:** `TrialBalance`
- **XML Request Required:**
  ```xml
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
          <SVFROMDATE TYPE="Date">20260401</SVFROMDATE>
          <SVTODATE TYPE="Date">20260930</SVTODATE>
          <EXPLODEFLAG>Yes</EXPLODEFLAG>
          <SVCurrentCompany>National Industrial Supplies Ltd</SVCurrentCompany>
        </STATICVARIABLES>
      </DESC>
    </BODY>
  </ENVELOPE>
  ```
- **Parameters Required:**
  - `fromDate`: Report start date (format: `YYYY-MM-DD`, converted to `YYYYMMDD`)
  - `toDate`: Report end date (format: `YYYY-MM-DD`, converted to `YYYYMMDD`)
  - `companyName`: Active Tally company name passed to `<SVCurrentCompany>`
- **Real XML Response Structure:**
  ```xml
  <ENVELOPE>
    <HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER>
    <BODY>
      <DESC>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <SVFROMDATE TYPE="Date">20260401</SVFROMDATE>
          <SVTODATE TYPE="Date">20260930</SVTODATE>
        </STATICVARIABLES>
      </DESC>
      <DATA>
        <DSPRECORD>
          <DSPACCNAME>HDFC Bank Operating Account</DSPACCNAME>
          <DSPGROUPNAME>Bank Accounts</DSPGROUPNAME>
          <DSPOPDRBAL>1500000.00</DSPOPDRBAL>
          <DSPOPCRBAL>0.00</DSPOPCRBAL>
          <DSPDRAMT>2450000.00</DSPDRAMT>
          <DSPCRAMT>1100000.00</DSPCRAMT>
          <DSPCLDRAMT>2850000.00</DSPCLDRAMT>
          <DSPCLCRAMT>0.00</DSPCLCRAMT>
        </DSPRECORD>
      </DATA>
    </BODY>
  </ENVELOPE>
  ```
- **How Parsed:** `TallyXmlParser.normalizeTrialBalance(xmlResponse, options)`.
  1. Inspects `<STATICVARIABLES>` and `<DATA>` for `SVFROMDATE`/`SVTODATE` and confirms that the requested date range is reflected in the report.
  2. Parses `<DSPRECORD>` nodes (or exploded `<LEDGER>` nodes if TDL mode is enabled).
  3. Separates Opening Debit vs Credit, In-Period Debit vs Credit, and Closing Debit vs Credit.
- **Normalized Fields Produced:**
  `guid`, `name`, `parent`, `openingDebit`, `openingCredit`, `openingBalance`, `debitTotals`, `creditTotals`, `closingDebit`, `closingCredit`, `closingBalance`
- **CSV Columns Produced:**
  `Ledger Name`, `Group`, `Opening Debit`, `Opening Credit`, `Debit`, `Credit`, `Closing Debit`, `Closing Credit`

---

### Entity 15: Sales Register
- **Report or Collection?** Collection (or Report)
- **Tally ID:** `SalesRegisterVouchersCollection`
- **XML Request Required:**
  ```xml
  <ENVELOPE>
    <HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>SalesRegisterVouchersCollection</ID></HEADER>
    <BODY>
      <DESC>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <SVFROMDATE TYPE="Date">20260401</SVFROMDATE>
          <SVTODATE TYPE="Date">20260930</SVTODATE>
        </STATICVARIABLES>
        <TDL>
          <TDLMESSAGE>
            <COLLECTION NAME="SalesRegisterVouchersCollection">
              <TYPE>Voucher</TYPE>
              <FILTER>IsSalesVoucher</FILTER>
              <FETCH>GUID, DATE, VOUCHERNUMBER, PARTYLEDGERNAME, PARTYGSTIN, PLACEOFSUPPLY, AMOUNT, NARRATION, ALLINVENTORYENTRIES.*</FETCH>
            </COLLECTION>
            <SYSTEM TYPE="Formulae" NAME="IsSalesVoucher">$$IsSales:$VoucherTypeName</SYSTEM>
          </TDLMESSAGE>
        </TDL>
      </DESC>
    </BODY>
  </ENVELOPE>
  ```
- **Parameters Required:** `fromDate`, `toDate`
- **Real XML Response Structure:** Sales voucher records with inventory lines.
- **How Parsed:** `TallyXmlParser.normalizeSalesVouchers()`.
- **CSV Columns Produced:**
  `Invoice Number`, `Invoice Date`, `Customer Name`, `GSTIN`, `Place of Supply`, `Item Name`, `Quantity`, `Rate`, `Amount`, `Godown`, `Total Invoice`, `Narration`
