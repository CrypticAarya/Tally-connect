/**
 * Sample XML Fixtures
 * 
 * Replicates genuine raw XML payloads emitted by TallyPrime's HTTP server (port 9000).
 * Used for validation and unit testing of TallyXmlHttpAdapter.
 */

export const SAMPLE_COMPANY_XML = `
<ENVELOPE>
  <HEADER>
    <STATUS>1</STATUS>
  </HEADER>
  <BODY>
    <DATA>
      <COLLECTION>
        <COMPANY>
          <NAME>National Trading Corporation</NAME>
          <GUID>e2a87593-4710-482d-83f5-091a0b38cf40</GUID>
          <STARTINGFROM>20260401</STARTINGFROM>
          <ENDINGAT>20270331</ENDINGAT>
        </COMPANY>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>
`.trim();

export const SAMPLE_CUSTOMER_XML = `
<ENVELOPE>
  <HEADER>
    <STATUS>1</STATUS>
  </HEADER>
  <BODY>
    <DATA>
      <COLLECTION>
        <LEDGER NAME="Apex Retail Enterprises Pvt Ltd">
          <GUID>cust-guid-00101</GUID>
          <NAME>Apex Retail Enterprises Pvt Ltd</NAME>
          <PARENT>Sundry Debtors</PARENT>
          <MAILINGNAME>Apex Retail Enterprises Pvt Ltd</MAILINGNAME>
          <ADDRESS.LIST>
            <ADDRESS>Unit 402, Trade Tower</ADDRESS>
            <ADDRESS>Senapati Bapat Marg</ADDRESS>
            <ADDRESS>Lower Parel</ADDRESS>
          </ADDRESS.LIST>
          <PINCODE>400013</PINCODE>
          <STATENAME>Maharashtra</STATENAME>
          <COUNTRYNAME>India</COUNTRYNAME>
          <PARTYGSTIN>27AAACA1234D1Z5</PARTYGSTIN>
          <PANNUMBER>AAACA1234D</PANNUMBER>
          <BILLCREDITPERIOD>30 Days</BILLCREDITPERIOD>
          <CREDITLIMIT>750000.00</CREDITLIMIT>
          <LEDGERPHONE>+91 98200 12345</LEDGERPHONE>
          <EMAIL>accounts@apexretail.in</EMAIL>
          <LEDGERCONTACT>Vikram Malhotra</LEDGERCONTACT>
          <BANKDETAILS.LIST>
            <BANKNAME>HDFC Bank Ltd</BANKNAME>
            <IFSCCODE>HDFC0000123</IFSCCODE>
            <ACCOUNTNUMBER>50200012345678</ACCOUNTNUMBER>
          </BANKDETAILS.LIST>
        </LEDGER>
        <LEDGER NAME="Bengaluru Infotech Supplies">
          <GUID>cust-guid-00102</GUID>
          <NAME>Bengaluru Infotech Supplies</NAME>
          <PARENT>Sundry Debtors</PARENT>
          <MAILINGNAME>Bengaluru Infotech Supplies</MAILINGNAME>
          <ADDRESS.LIST>
            <ADDRESS>Plot 18, Electronic City Phase 1</ADDRESS>
            <ADDRESS>Hosur Road</ADDRESS>
          </ADDRESS.LIST>
          <PINCODE>560100</PINCODE>
          <STATENAME>Karnataka</STATENAME>
          <COUNTRYNAME>India</COUNTRYNAME>
          <PARTYGSTIN>29AABCB5678E1Z2</PARTYGSTIN>
          <PANNUMBER>AABCB5678E</PANNUMBER>
          <BILLCREDITPERIOD>45 Days</BILLCREDITPERIOD>
          <CREDITLIMIT>1200000.00</CREDITLIMIT>
          <LEDGERPHONE>+91 98450 98765</LEDGERPHONE>
          <EMAIL>procurement@blrif.com</EMAIL>
          <LEDGERCONTACT>Anita Nair</LEDGERCONTACT>
          <BANKDETAILS.LIST>
            <BANKNAME>ICICI Bank Ltd</BANKNAME>
            <IFSCCODE>ICIC0000045</IFSCCODE>
            <ACCOUNTNUMBER>004505001234</ACCOUNTNUMBER>
          </BANKDETAILS.LIST>
        </LEDGER>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>
`.trim();

export const SAMPLE_CHART_OF_ACCOUNTS_XML = `
<ENVELOPE>
  <HEADER>
    <STATUS>1</STATUS>
  </HEADER>
  <BODY>
    <DATA>
      <COLLECTION>
        <LEDGER NAME="Sales - Domestic 18%">
          <GUID>gl-guid-002</GUID>
          <NAME>Sales - Domestic 18%</NAME>
          <PARENT>Sales Accounts</PARENT>
          <DESCRIPTION>Primary revenue account for taxable 18% domestic goods</DESCRIPTION>
          <GSTAPPLICABLE>Applicable</GSTAPPLICABLE>
          <TDSAPPLICABLE>Not Applicable</TDSAPPLICABLE>
        </LEDGER>
        <LEDGER NAME="Output CGST @ 9%">
          <GUID>gl-guid-004</GUID>
          <NAME>Output CGST @ 9%</NAME>
          <PARENT>Duties &amp; Taxes</PARENT>
          <DESCRIPTION>Central GST liability on intra-state outward supplies</DESCRIPTION>
          <GSTAPPLICABLE>Applicable</GSTAPPLICABLE>
          <TDSAPPLICABLE>Not Applicable</TDSAPPLICABLE>
        </LEDGER>
        <LEDGER NAME="Output SGST @ 9%">
          <GUID>gl-guid-005</GUID>
          <NAME>Output SGST @ 9%</NAME>
          <PARENT>Duties &amp; Taxes</PARENT>
          <DESCRIPTION>State GST liability on intra-state outward supplies</DESCRIPTION>
          <GSTAPPLICABLE>Applicable</GSTAPPLICABLE>
          <TDSAPPLICABLE>Not Applicable</TDSAPPLICABLE>
        </LEDGER>
        <LEDGER NAME="HDFC Current Account">
          <GUID>gl-guid-008</GUID>
          <NAME>HDFC Current Account</NAME>
          <PARENT>Bank Accounts</PARENT>
          <DESCRIPTION>Main operating bank account in Lower Parel branch</DESCRIPTION>
          <GSTAPPLICABLE>Not Applicable</GSTAPPLICABLE>
          <TDSAPPLICABLE>Not Applicable</TDSAPPLICABLE>
        </LEDGER>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>
`.trim();

export const SAMPLE_SALES_REGISTER_XML = `
<ENVELOPE>
  <HEADER>
    <STATUS>1</STATUS>
  </HEADER>
  <BODY>
    <DATA>
      <COLLECTION>
        <VOUCHER VCHTYPE="Sales">
          <GUID>9f8e7d6c-5b4a-3210-9876-543210abcdef-00000042</GUID>
          <DATE>20260412</DATE>
          <VOUCHERNUMBER>INV/2026-27/00108</VOUCHERNUMBER>
          <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
          <PARTYLEDGERNAME>Apex Retail Enterprises Pvt Ltd</PARTYLEDGERNAME>
          <PARTYGSTIN>27AAACA1234D1Z5</PARTYGSTIN>
          <PLACEOFSUPPLY>Maharashtra</PLACEOFSUPPLY>
          <NARRATION>Being sales of industrial valves &amp; gaskets against PO # PO-2026-441</NARRATION>
          <ALLINVENTORYENTRIES.LIST>
            <STOCKITEMNAME>Industrial Valve 50mm Brass</STOCKITEMNAME>
            <HSNCODE>84818030</HSNCODE>
            <GODOWNNAME>Bhiwandi Central Godown</GODOWNNAME>
            <BILLEDQTY>100 NOS</BILLEDQTY>
            <RATE>800.00/NOS</RATE>
            <DISCOUNT>5.0 %</DISCOUNT>
            <AMOUNT>-76000.00</AMOUNT>
            <BATCHALLOCATIONS.LIST>
              <BATCHNAME>BATCH-2026-01</BATCHNAME>
              <GODOWNNAME>Bhiwandi Central Godown</GODOWNNAME>
              <BILLEDQTY>100 NOS</BILLEDQTY>
            </BATCHALLOCATIONS.LIST>
          </ALLINVENTORYENTRIES.LIST>
          <ALLINVENTORYENTRIES.LIST>
            <STOCKITEMNAME>High Pressure Rubber Gasket 2-inch</STOCKITEMNAME>
            <HSNCODE>40169320</HSNCODE>
            <GODOWNNAME>Bhiwandi Central Godown</GODOWNNAME>
            <BILLEDQTY>250 PCS</BILLEDQTY>
            <RATE>180.00/PCS</RATE>
            <AMOUNT>-45000.00</AMOUNT>
            <BATCHALLOCATIONS.LIST>
              <BATCHNAME>BATCH-2026-02</BATCHNAME>
              <GODOWNNAME>Bhiwandi Central Godown</GODOWNNAME>
              <BILLEDQTY>250 PCS</BILLEDQTY>
            </BATCHALLOCATIONS.LIST>
          </ALLINVENTORYENTRIES.LIST>
          <LEDGERENTRIES.LIST>
            <LEDGERNAME>Apex Retail Enterprises Pvt Ltd</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-144700.00</AMOUNT>
          </LEDGERENTRIES.LIST>
          <LEDGERENTRIES.LIST>
            <LEDGERNAME>Sales - Domestic 18%</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>121000.00</AMOUNT>
          </LEDGERENTRIES.LIST>
          <LEDGERENTRIES.LIST>
            <LEDGERNAME>Output CGST @ 9%</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>10890.00</AMOUNT>
          </LEDGERENTRIES.LIST>
          <LEDGERENTRIES.LIST>
            <LEDGERNAME>Output SGST @ 9%</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>10890.00</AMOUNT>
          </LEDGERENTRIES.LIST>
          <LEDGERENTRIES.LIST>
            <LEDGERNAME>Freight &amp; Delivery Charges</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>1900.00</AMOUNT>
          </LEDGERENTRIES.LIST>
          <LEDGERENTRIES.LIST>
            <LEDGERNAME>Round Off</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>20.00</AMOUNT>
          </LEDGERENTRIES.LIST>
        </VOUCHER>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>
`.trim();

export const SAMPLE_TRIAL_BALANCE_XML = `
<ENVELOPE>
  <HEADER>
    <STATUS>1</STATUS>
  </HEADER>
  <BODY>
    <DATA>
      <COLLECTION>
        <LEDGER NAME="Apex Retail Enterprises Pvt Ltd">
          <NAME>Apex Retail Enterprises Pvt Ltd</NAME>
          <PARENT>Sundry Debtors</PARENT>
          <OPENINGBALANCE>-150000.00</OPENINGBALANCE>
          <DEBITTOTALS>144700.00</DEBITTOTALS>
          <CREDITTOTALS>120000.00</CREDITTOTALS>
          <CLOSINGBALANCE>-174700.00</CLOSINGBALANCE>
        </LEDGER>
        <LEDGER NAME="Sales - Domestic 18%">
          <NAME>Sales - Domestic 18%</NAME>
          <PARENT>Sales Accounts</PARENT>
          <OPENINGBALANCE>0.00</OPENINGBALANCE>
          <DEBITTOTALS>0.00</DEBITTOTALS>
          <CREDITTOTALS>121000.00</CREDITTOTALS>
          <CLOSINGBALANCE>121000.00</CLOSINGBALANCE>
        </LEDGER>
        <LEDGER NAME="Output CGST @ 9%">
          <NAME>Output CGST @ 9%</NAME>
          <PARENT>Duties &amp; Taxes</PARENT>
          <OPENINGBALANCE>0.00</OPENINGBALANCE>
          <DEBITTOTALS>0.00</DEBITTOTALS>
          <CREDITTOTALS>10890.00</CREDITTOTALS>
          <CLOSINGBALANCE>10890.00</CLOSINGBALANCE>
        </LEDGER>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>
`.trim();
