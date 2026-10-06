/**
 * Data Mapping Engine for Tally Connect
 * 
 * Formalizes field-level mapping classification across all 13 Authoritative Target Schemas:
 * - DIRECT     : Exact value directly mapped from a Tally XML field.
 * - DERIVED    : Computed or formatted deterministically from one or more Tally fields.
 * - CLASSIFIED : Mapped based on business classification, Tally group hierarchy, or status.
 * - UNAVAILABLE: Field is not stored in or provided by standard Tally; strictly output as
 *                empty string ("") without fabrication or fake default values.
 */

export const FIELD_CLASSIFICATION = {
  DIRECT: 'DIRECT',
  DERIVED: 'DERIVED',
  CLASSIFIED: 'CLASSIFIED',
  UNAVAILABLE: 'UNAVAILABLE'
};

/**
 * Authoritative Field-Level Mapping Catalog for all 13 Target Schemas
 */
export const MAPPING_CATALOG = {
  // 1. CHART OF ACCOUNTS (17 columns)
  chart_of_accounts: [
    { target: 'Account Code', type: FIELD_CLASSIFICATION.DERIVED, source: 'guid/code', description: 'Deterministic GUID prefix or custom ledger code' },
    { target: 'GL Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'NAME', description: 'Tally Ledger Name' },
    { target: 'Ledger Description', type: FIELD_CLASSIFICATION.DIRECT, source: 'DESCRIPTION', description: 'Tally Ledger Description or Narration' },
    { target: 'Parent', type: FIELD_CLASSIFICATION.DIRECT, source: 'PARENT', description: 'Tally Parent Group Name' },
    { target: 'Grouping', type: FIELD_CLASSIFICATION.DIRECT, source: 'PARENT', description: 'Account Grouping hierarchy' },
    { target: 'Grouping for Financial Summary', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally XML -> blank' },
    { target: 'Branch', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not allocated in standard chart -> blank' },
    { target: 'Cost Center', type: FIELD_CLASSIFICATION.CLASSIFIED, source: 'ISCOSTCENTRESON', description: 'Yes/No based on cost centres flag' },
    { target: 'Cost Classification', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'Cost Behaviour Description', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'SV Variable %', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'Inter-branch', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'Related Party', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'GST Applicable', type: FIELD_CLASSIFICATION.DIRECT, source: 'GSTAPPLICABLE', description: 'Tally GST applicability' },
    { target: 'TDS Applicable', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not specified on ledger node -> blank' },
    { target: 'Active', type: FIELD_CLASSIFICATION.CLASSIFIED, source: 'active', description: 'Yes/No ledger active state' },
    { target: 'Remarks', type: FIELD_CLASSIFICATION.DIRECT, source: 'NARRATION', description: 'Ledger narration or notes' }
  ],

  // 2. CUSTOMER (36 columns)
  customers: [
    { target: 'Customer Code', type: FIELD_CLASSIFICATION.DERIVED, source: 'guid/code', description: 'GUID prefix or account code' },
    { target: 'Customer Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'NAME', description: 'Tally Customer Ledger Name' },
    { target: 'Customer Type', type: FIELD_CLASSIFICATION.CLASSIFIED, source: 'PARENT', description: 'Customer classification from parent group' },
    { target: 'Account Status', type: FIELD_CLASSIFICATION.CLASSIFIED, source: 'active', description: 'Active or Inactive' },
    { target: 'Primary Contact Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'LEDGERCONTACT', description: 'Mailing or contact person name' },
    { target: 'Primary Contact Email', type: FIELD_CLASSIFICATION.DIRECT, source: 'EMAIL', description: 'Customer email address' },
    { target: 'Primary Contact Phone', type: FIELD_CLASSIFICATION.DIRECT, source: 'LEDGERPHONE', description: 'Customer contact phone number' },
    { target: 'Street Address', type: FIELD_CLASSIFICATION.DERIVED, source: 'ADDRESS.LIST', description: 'Joined multi-line street address' },
    { target: 'City', type: FIELD_CLASSIFICATION.DIRECT, source: 'city', description: 'Mailing city' },
    { target: 'State/Province', type: FIELD_CLASSIFICATION.DIRECT, source: 'STATENAME', description: 'GST state or province' },
    { target: 'Postal/ZIP Code', type: FIELD_CLASSIFICATION.DIRECT, source: 'PINCODE', description: '6-digit pincode / zip' },
    { target: 'Country', type: FIELD_CLASSIFICATION.DIRECT, source: 'COUNTRYNAME', description: 'Country (India)' },
    { target: 'GST Reg Type', type: FIELD_CLASSIFICATION.DIRECT, source: 'GSTREGTYPE', description: 'Regular, Composition, Consumer, Unregistered' },
    { target: 'Pan', type: FIELD_CLASSIFICATION.DERIVED, source: 'PANNUMBER/PARTYGSTIN', description: '10-digit PAN extracted from GSTIN or PAN node' },
    { target: 'Credit Days', type: FIELD_CLASSIFICATION.DIRECT, source: 'BILLCREDITPERIOD', description: 'Credit period in days' },
    { target: 'Credit Limit', type: FIELD_CLASSIFICATION.DERIVED, source: 'CREDITLIMIT', description: 'Formatted credit limit amount' },
    { target: 'Payment Terms', type: FIELD_CLASSIFICATION.DERIVED, source: 'BILLCREDITPERIOD', description: 'Derived payment terms string' },
    { target: 'Currency', type: FIELD_CLASSIFICATION.DIRECT, source: 'currency', description: 'Currency symbol or INR' },
    { target: 'Branch ID/Name', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not allocated in standard customer master -> blank' },
    { target: 'Sales Representative', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'GST Number', type: FIELD_CLASSIFICATION.DIRECT, source: 'PARTYGSTIN', description: '15-character GSTIN' },
    { target: 'GST State Code', type: FIELD_CLASSIFICATION.DERIVED, source: 'PARTYGSTIN', description: 'First 2 characters of GSTIN' },
    { target: 'GST State Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'STATENAME', description: 'State name from statutory details' },
    { target: 'MainDistributor', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'MainDealer', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'MainAgent', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'SubDistributor', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'SubDealer', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'SubAgent', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'AccPartyBankName', type: FIELD_CLASSIFICATION.DIRECT, source: 'BANKDETAILS.BANKNAME', description: 'Bank name from banking details' },
    { target: 'AccPartyBankIFSCCode', type: FIELD_CLASSIFICATION.DIRECT, source: 'BANKDETAILS.IFSCODE', description: 'IFSC Code' },
    { target: 'AccPartyBankActNo', type: FIELD_CLASSIFICATION.DIRECT, source: 'BANKDETAILS.ACCOUNTNUMBER', description: 'Bank Account Number' },
    { target: 'AccStartDate', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'AccEndDate', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'Active', type: FIELD_CLASSIFICATION.CLASSIFIED, source: 'active', description: 'Yes/No active status' },
    { target: 'Remarks', type: FIELD_CLASSIFICATION.DIRECT, source: 'NARRATION', description: 'Customer notes or remarks' }
  ],

  // 3. VENDOR (33 columns)
  vendors: [
    { target: 'Vendor Code', type: FIELD_CLASSIFICATION.DERIVED, source: 'guid/code', description: 'GUID prefix or vendor code' },
    { target: 'Vendor Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'NAME', description: 'Tally Vendor Ledger Name' },
    { target: 'Vendor Type', type: FIELD_CLASSIFICATION.CLASSIFIED, source: 'PARENT', description: 'Vendor category from parent group' },
    { target: 'Vendor Status', type: FIELD_CLASSIFICATION.CLASSIFIED, source: 'active', description: 'Active or Inactive' },
    { target: 'Primary Contact Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'LEDGERCONTACT', description: 'Vendor contact person' },
    { target: 'Primary Contact Email', type: FIELD_CLASSIFICATION.DIRECT, source: 'EMAIL', description: 'Vendor email' },
    { target: 'Primary Contact Phone', type: FIELD_CLASSIFICATION.DIRECT, source: 'LEDGERPHONE', description: 'Vendor phone number' },
    { target: 'Street Address', type: FIELD_CLASSIFICATION.DERIVED, source: 'ADDRESS.LIST', description: 'Joined street address' },
    { target: 'City', type: FIELD_CLASSIFICATION.DIRECT, source: 'city', description: 'City' },
    { target: 'State/Province', type: FIELD_CLASSIFICATION.DIRECT, source: 'STATENAME', description: 'State name' },
    { target: 'Postal/ZIP Code', type: FIELD_CLASSIFICATION.DIRECT, source: 'PINCODE', description: 'Pincode' },
    { target: 'Country', type: FIELD_CLASSIFICATION.DIRECT, source: 'COUNTRYNAME', description: 'Country' },
    { target: 'Credit Limit', type: FIELD_CLASSIFICATION.DERIVED, source: 'CREDITLIMIT', description: 'Credit limit amount' },
    { target: 'Payment Terms', type: FIELD_CLASSIFICATION.DERIVED, source: 'BILLCREDITPERIOD', description: 'Payment terms' },
    { target: 'Currency', type: FIELD_CLASSIFICATION.DIRECT, source: 'currency', description: 'Currency or INR' },
    { target: 'GST Number', type: FIELD_CLASSIFICATION.DIRECT, source: 'PARTYGSTIN', description: 'GSTIN' },
    { target: 'GST State Code', type: FIELD_CLASSIFICATION.DERIVED, source: 'PARTYGSTIN', description: 'First 2 chars of GSTIN' },
    { target: 'GST State Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'STATENAME', description: 'State Name' },
    { target: 'MainDistributor', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'MainDealer', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'MainAgent', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'SubDistributor', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'SubDealer', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'SubAgent', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'AccPartyBankName', type: FIELD_CLASSIFICATION.DIRECT, source: 'BANKDETAILS.BANKNAME', description: 'Bank Name' },
    { target: 'AccPartyBankIFSCCode', type: FIELD_CLASSIFICATION.DIRECT, source: 'BANKDETAILS.IFSCODE', description: 'IFSC Code' },
    { target: 'AccPartyBankActNo', type: FIELD_CLASSIFICATION.DIRECT, source: 'BANKDETAILS.ACCOUNTNUMBER', description: 'Account Number' },
    { target: 'AccStartDate', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'AccEndDate', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'Nature of vendor', type: FIELD_CLASSIFICATION.CLASSIFIED, source: 'PARENT', description: 'Classification from group' },
    { target: 'TDS Category', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'TDS Section', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'PAN Number', type: FIELD_CLASSIFICATION.DERIVED, source: 'PANNUMBER/PARTYGSTIN', description: '10-digit PAN' }
  ],

  // 4. ITEM MASTER (27 columns)
  stock_items: [
    { target: 'Item/SKU ID', type: FIELD_CLASSIFICATION.DERIVED, source: 'guid/code', description: 'Item code or GUID' },
    { target: 'Item Name/Description', type: FIELD_CLASSIFICATION.DIRECT, source: 'NAME', description: 'Stock item name' },
    { target: 'Month/Year', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Master dataset -> blank' },
    { target: 'Item Category/Type', type: FIELD_CLASSIFICATION.DIRECT, source: 'CATEGORY', description: 'Stock category' },
    { target: 'Item Sub-category', type: FIELD_CLASSIFICATION.DIRECT, source: 'PARENT', description: 'Stock group' },
    { target: 'HSN', type: FIELD_CLASSIFICATION.DIRECT, source: 'HSNCODE', description: 'HSN code' },
    { target: 'Brand', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'Manufacturer/Vendor Name', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'Unit of Measure', type: FIELD_CLASSIFICATION.DIRECT, source: 'BASEUNITS', description: 'UOM (e.g. NOS, PCS, KGS)' },
    { target: 'GST Rate %', type: FIELD_CLASSIFICATION.DERIVED, source: 'GSTRATE', description: 'Formatted GST rate percent' },
    { target: 'GST Applicable', type: FIELD_CLASSIFICATION.DIRECT, source: 'GSTAPPLICABLE', description: 'Applicability' },
    { target: 'Costing Method', type: FIELD_CLASSIFICATION.DIRECT, source: 'COSTINGMETHOD', description: 'Avg Cost, FIFO, etc.' },
    { target: 'Standard Cost per Unit', type: FIELD_CLASSIFICATION.DERIVED, source: 'standardCost', description: 'Standard cost' },
    { target: 'MRP', type: FIELD_CLASSIFICATION.DERIVED, source: 'mrp', description: 'MRP' },
    { target: 'Standard Selling Price', type: FIELD_CLASSIFICATION.DERIVED, source: 'standardPrice', description: 'Standard rate' },
    { target: 'Reorder Level (Qty)', type: FIELD_CLASSIFICATION.DERIVED, source: 'REORDERBASE', description: 'Reorder quantity' },
    { target: 'Min Stock Qty', type: FIELD_CLASSIFICATION.DERIVED, source: 'MINORDERQTY', description: 'Minimum order quantity' },
    { target: 'Max Stock Qty', type: FIELD_CLASSIFICATION.DERIVED, source: 'MAXSTOCKLEVEL', description: 'Maximum stock level' },
    { target: 'Opening Stock Qty', type: FIELD_CLASSIFICATION.DERIVED, source: 'OPENINGBALANCE', description: 'Opening quantity' },
    { target: 'Opening Stock Rate', type: FIELD_CLASSIFICATION.DERIVED, source: 'OPENINGRATE', description: 'Opening unit rate' },
    { target: 'Opening Stock Value', type: FIELD_CLASSIFICATION.DERIVED, source: 'OPENINGVALUE', description: 'Opening value' },
    { target: 'Economic Order Quantity (EOQ)', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'Safety Stock Level', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'Lead Time', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'Markup Percentage', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'Profit Margin', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'Status', type: FIELD_CLASSIFICATION.CLASSIFIED, source: 'active', description: 'Active or Inactive' }
  ],

  // 5. INVENTORY (17 columns)
  inventory: [
    { target: 'Item/SKU ID', type: FIELD_CLASSIFICATION.DERIVED, source: 'guid/code', description: 'Item code' },
    { target: 'Item Name/Description', type: FIELD_CLASSIFICATION.DIRECT, source: 'NAME', description: 'Item description' },
    { target: 'Item Category/Type', type: FIELD_CLASSIFICATION.DIRECT, source: 'CATEGORY', description: 'Category' },
    { target: 'Item Sub-category', type: FIELD_CLASSIFICATION.DIRECT, source: 'PARENT', description: 'Sub-category' },
    { target: 'HSN', type: FIELD_CLASSIFICATION.DIRECT, source: 'HSNCODE', description: 'HSN' },
    { target: 'Brand', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'Manufacturer/Vendor Name', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'Unit of Measure', type: FIELD_CLASSIFICATION.DIRECT, source: 'BASEUNITS', description: 'UOM' },
    { target: 'Reorder Point', type: FIELD_CLASSIFICATION.DERIVED, source: 'REORDERBASE', description: 'Reorder level' },
    { target: 'Economic Order Quantity', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'Minimum Order Quantity', type: FIELD_CLASSIFICATION.DERIVED, source: 'MINORDERQTY', description: 'Min order qty' },
    { target: 'Maximum Stock Level', type: FIELD_CLASSIFICATION.DERIVED, source: 'MAXSTOCKLEVEL', description: 'Max stock level' },
    { target: 'Safety Stock Level', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'Lead Time', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'Markup Percentage', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'Profit Margin', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not provided in Tally -> blank' },
    { target: 'Status', type: FIELD_CLASSIFICATION.CLASSIFIED, source: 'active', description: 'Active status' }
  ],

  // 6. INVENTORY MASTER (20 columns)
  inventory_master: [
    { target: 'Code', type: FIELD_CLASSIFICATION.DERIVED, source: 'guid/code', description: 'Transaction code' },
    { target: 'Transaction Date', type: FIELD_CLASSIFICATION.DERIVED, source: 'DATE', description: 'Voucher date YYYY-MM-DD' },
    { target: 'Transaction Type', type: FIELD_CLASSIFICATION.DIRECT, source: 'VOUCHERTYPENAME', description: 'Voucher type (Stock Journal, Receipt, Delivery, etc.)' },
    { target: 'Document No', type: FIELD_CLASSIFICATION.DIRECT, source: 'VOUCHERNUMBER', description: 'Voucher number' },
    { target: 'Voucher Ref (ERP)', type: FIELD_CLASSIFICATION.DIRECT, source: 'REFERENCE', description: 'Reference number' },
    { target: 'Godown Name/Code', type: FIELD_CLASSIFICATION.DIRECT, source: 'GODOWNNAME', description: 'Warehouse name' },
    { target: 'Item Code/Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'STOCKITEMNAME', description: 'Stock item name' },
    { target: 'Inward Qty', type: FIELD_CLASSIFICATION.DERIVED, source: 'INWARDQTY', description: 'Inward quantity' },
    { target: 'Outward Qty', type: FIELD_CLASSIFICATION.DERIVED, source: 'OUTWARDQTY', description: 'Outward quantity' },
    { target: 'Rate per Unit', type: FIELD_CLASSIFICATION.DERIVED, source: 'RATE', description: 'Unit rate' },
    { target: 'Inward Value', type: FIELD_CLASSIFICATION.DERIVED, source: 'INWARDVALUE', description: 'Inward value' },
    { target: 'Outward Value', type: FIELD_CLASSIFICATION.DERIVED, source: 'OUTWARDVALUE', description: 'Outward value' },
    { target: 'Closing Qty', type: FIELD_CLASSIFICATION.DERIVED, source: 'CLOSINGQTY', description: 'Closing quantity' },
    { target: 'Closing Value', type: FIELD_CLASSIFICATION.DERIVED, source: 'CLOSINGVALUE', description: 'Closing value' },
    { target: 'Batch No', type: FIELD_CLASSIFICATION.DIRECT, source: 'BATCHNAME', description: 'Batch number' },
    { target: 'Mfg Date', type: FIELD_CLASSIFICATION.DERIVED, source: 'MFGDATE', description: 'Mfg date YYYY-MM-DD' },
    { target: 'Expiry Date', type: FIELD_CLASSIFICATION.DERIVED, source: 'EXPIRYDATE', description: 'Expiry date YYYY-MM-DD' },
    { target: 'Party Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'PARTYLEDGERNAME', description: 'Associated party' },
    { target: 'Cost Centre Name/Code', type: FIELD_CLASSIFICATION.DIRECT, source: 'COSTCENTRENAME', description: 'Allocated cost centre' },
    { target: 'Remarks', type: FIELD_CLASSIFICATION.DIRECT, source: 'NARRATION', description: 'Transaction narration' }
  ],

  // 7. SALES REGISTER (32 columns)
  sales_register: [
    { target: 'Code', type: FIELD_CLASSIFICATION.DERIVED, source: 'guid/code', description: 'Voucher GUID or line item code' },
    { target: 'Sales Date', type: FIELD_CLASSIFICATION.DERIVED, source: 'DATE', description: 'Sales Date YYYY-MM-DD' },
    { target: 'Invoice No', type: FIELD_CLASSIFICATION.DIRECT, source: 'VOUCHERNUMBER', description: 'Invoice number' },
    { target: 'Invoice Date', type: FIELD_CLASSIFICATION.DERIVED, source: 'DATE', description: 'Invoice date' },
    { target: 'Customer Name/Code', type: FIELD_CLASSIFICATION.DIRECT, source: 'PARTYLEDGERNAME', description: 'Customer Name' },
    { target: 'GSTIN', type: FIELD_CLASSIFICATION.DIRECT, source: 'PARTYGSTIN', description: 'Customer GSTIN' },
    { target: 'Customer Type', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not present on sales voucher -> blank' },
    { target: 'Sales Type', type: FIELD_CLASSIFICATION.DIRECT, source: 'VOUCHERTYPENAME', description: 'Sales voucher type' },
    { target: 'Branch Name/Code', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not specified -> blank' },
    { target: 'Cost Center Name/Code', type: FIELD_CLASSIFICATION.DIRECT, source: 'COSTCENTRENAME', description: 'Cost center' },
    { target: 'Godown Name/Code', type: FIELD_CLASSIFICATION.DIRECT, source: 'GODOWNNAME', description: 'Warehouse' },
    { target: 'Item Description', type: FIELD_CLASSIFICATION.DIRECT, source: 'STOCKITEMNAME', description: 'Stock item name' },
    { target: 'HSN', type: FIELD_CLASSIFICATION.DIRECT, source: 'HSNCODE', description: 'HSN' },
    { target: 'Qty', type: FIELD_CLASSIFICATION.DERIVED, source: 'BILLEDQTY', description: 'Billed quantity' },
    { target: 'Rate', type: FIELD_CLASSIFICATION.DERIVED, source: 'RATE', description: 'Unit rate' },
    { target: 'Discount', type: FIELD_CLASSIFICATION.DERIVED, source: 'DISCOUNT', description: 'Discount amount' },
    { target: 'Tax Value', type: FIELD_CLASSIFICATION.DERIVED, source: 'TAXABLEVALUE/AMOUNT', description: 'Taxable value' },
    { target: 'CGST', type: FIELD_CLASSIFICATION.DERIVED, source: 'CGSTRATE', description: 'CGST % rate' },
    { target: 'CGST Amount', type: FIELD_CLASSIFICATION.DERIVED, source: 'CGSTAMOUNT', description: 'CGST amount' },
    { target: 'SGST', type: FIELD_CLASSIFICATION.DERIVED, source: 'SGSTRATE', description: 'SGST % rate' },
    { target: 'SGST Amount', type: FIELD_CLASSIFICATION.DERIVED, source: 'SGSTAMOUNT', description: 'SGST amount' },
    { target: 'IGST', type: FIELD_CLASSIFICATION.DERIVED, source: 'IGSTRATE', description: 'IGST % rate' },
    { target: 'IGST Amount', type: FIELD_CLASSIFICATION.DERIVED, source: 'IGSTAMOUNT', description: 'IGST amount' },
    { target: 'Other Charges (₹)', type: FIELD_CLASSIFICATION.DERIVED, source: 'OTHERCHARGES', description: 'Other ledger charges' },
    { target: 'Total Invoice', type: FIELD_CLASSIFICATION.DERIVED, source: 'AMOUNT', description: 'Total invoice gross' },
    { target: 'Place of Supply (State)', type: FIELD_CLASSIFICATION.DIRECT, source: 'PLACEOFSUPPLY', description: 'Place of supply' },
    { target: 'Payment Terms', type: FIELD_CLASSIFICATION.DIRECT, source: 'BASICDUEDATE', description: 'Due date / payment terms' },
    { target: 'Due Date', type: FIELD_CLASSIFICATION.DERIVED, source: 'BASICDUEDATE', description: 'Due date YYYY-MM-DD' },
    { target: 'Payment Status', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Voucher level -> blank' },
    { target: 'Payment Date', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Voucher level -> blank' },
    { target: 'Mode Of Payment', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Voucher level -> blank' },
    { target: 'Remarks', type: FIELD_CLASSIFICATION.DIRECT, source: 'NARRATION', description: 'Invoice narration' }
  ],

  // 8. PURCHASE REGISTER (32 columns)
  purchase_register: [
    { target: 'Code', type: FIELD_CLASSIFICATION.DERIVED, source: 'guid/code', description: 'Purchase voucher code' },
    { target: 'Purchase Date', type: FIELD_CLASSIFICATION.DERIVED, source: 'DATE', description: 'Purchase Date YYYY-MM-DD' },
    { target: 'Invoice No', type: FIELD_CLASSIFICATION.DIRECT, source: 'VOUCHERNUMBER', description: 'Bill / invoice number' },
    { target: 'Invoice Date', type: FIELD_CLASSIFICATION.DERIVED, source: 'DATE', description: 'Bill date' },
    { target: 'Vendor Name/Code', type: FIELD_CLASSIFICATION.DIRECT, source: 'PARTYLEDGERNAME', description: 'Vendor Name' },
    { target: 'GSTIN', type: FIELD_CLASSIFICATION.DIRECT, source: 'PARTYGSTIN', description: 'Vendor GSTIN' },
    { target: 'Vendor Type', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not present on voucher -> blank' },
    { target: 'Purchase Type', type: FIELD_CLASSIFICATION.DIRECT, source: 'VOUCHERTYPENAME', description: 'Purchase voucher type' },
    { target: 'Branch Name/Code', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Not specified -> blank' },
    { target: 'Cost Center Name/Code', type: FIELD_CLASSIFICATION.DIRECT, source: 'COSTCENTRENAME', description: 'Cost center' },
    { target: 'Item Description', type: FIELD_CLASSIFICATION.DIRECT, source: 'STOCKITEMNAME', description: 'Stock item name' },
    { target: 'HSN', type: FIELD_CLASSIFICATION.DIRECT, source: 'HSNCODE', description: 'HSN' },
    { target: 'Qty', type: FIELD_CLASSIFICATION.DERIVED, source: 'BILLEDQTY', description: 'Billed quantity' },
    { target: 'Rate', type: FIELD_CLASSIFICATION.DERIVED, source: 'RATE', description: 'Unit rate' },
    { target: 'Discount', type: FIELD_CLASSIFICATION.DERIVED, source: 'DISCOUNT', description: 'Discount' },
    { target: 'Tax Value', type: FIELD_CLASSIFICATION.DERIVED, source: 'TAXABLEVALUE/AMOUNT', description: 'Taxable value' },
    { target: 'CGST', type: FIELD_CLASSIFICATION.DERIVED, source: 'CGSTRATE', description: 'CGST % rate' },
    { target: 'CGST Amount', type: FIELD_CLASSIFICATION.DERIVED, source: 'CGSTAMOUNT', description: 'CGST amount' },
    { target: 'SGST', type: FIELD_CLASSIFICATION.DERIVED, source: 'SGSTRATE', description: 'SGST % rate' },
    { target: 'SGST Amount', type: FIELD_CLASSIFICATION.DERIVED, source: 'SGSTAMOUNT', description: 'SGST amount' },
    { target: 'IGST', type: FIELD_CLASSIFICATION.DERIVED, source: 'IGSTRATE', description: 'IGST % rate' },
    { target: 'IGST Amount', type: FIELD_CLASSIFICATION.DERIVED, source: 'IGSTAMOUNT', description: 'IGST amount' },
    { target: 'Total Invoice', type: FIELD_CLASSIFICATION.DERIVED, source: 'AMOUNT', description: 'Total invoice gross' },
    { target: 'GRN No', type: FIELD_CLASSIFICATION.DIRECT, source: 'REFERENCE', description: 'Goods receipt note / ref' },
    { target: 'PO Reference No', type: FIELD_CLASSIFICATION.DIRECT, source: 'ORDERREF', description: 'Purchase order reference' },
    { target: 'Payment Terms', type: FIELD_CLASSIFICATION.DIRECT, source: 'BASICDUEDATE', description: 'Payment terms' },
    { target: 'Due Date', type: FIELD_CLASSIFICATION.DERIVED, source: 'BASICDUEDATE', description: 'Due date YYYY-MM-DD' },
    { target: 'Payment Status', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Voucher level -> blank' },
    { target: 'Payment Date', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Voucher level -> blank' },
    { target: 'Mode Of Payment', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Voucher level -> blank' },
    { target: 'Payment Voucher Ref', type: FIELD_CLASSIFICATION.UNAVAILABLE, source: null, description: 'Voucher level -> blank' },
    { target: 'Remarks', type: FIELD_CLASSIFICATION.DIRECT, source: 'NARRATION', description: 'Bill narration' }
  ],

  // 9. TRIAL BALANCE (9 columns)
  trial_balance: [
    { target: 'Month/Year', type: FIELD_CLASSIFICATION.DERIVED, source: 'period/monthYear', description: 'Accounting period month/year' },
    { target: 'Branch', type: FIELD_CLASSIFICATION.DIRECT, source: 'branch', description: 'Branch name or empty' },
    { target: 'Particulars', type: FIELD_CLASSIFICATION.DIRECT, source: 'DSPGROUPNAME/parent', description: 'Group classification hierarchy' },
    { target: 'Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'DSPACCNAME/name', description: 'Ledger account name' },
    { target: 'Opening', type: FIELD_CLASSIFICATION.DERIVED, source: 'openingBalance', description: 'Signed or absolute opening balance' },
    { target: 'Debit', type: FIELD_CLASSIFICATION.DERIVED, source: 'DSPDRAMT/debit', description: 'In-period debit transactions' },
    { target: 'Credit', type: FIELD_CLASSIFICATION.DERIVED, source: 'DSPCRAMT/credit', description: 'In-period credit transactions' },
    { target: 'Closing', type: FIELD_CLASSIFICATION.DERIVED, source: 'closingBalance', description: 'Signed or absolute closing balance' },
    { target: 'Dr/Cr', type: FIELD_CLASSIFICATION.DERIVED, source: 'drCr', description: 'Dr or Cr indicator' }
  ],

  // 10. GODOWN (4 columns)
  godowns: [
    { target: 'Code', type: FIELD_CLASSIFICATION.DERIVED, source: 'guid/code', description: 'Warehouse code' },
    { target: 'Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'NAME', description: 'Godown location name' },
    { target: 'Branch Code/Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'PARENT', description: 'Parent location or branch' },
    { target: 'Active', type: FIELD_CLASSIFICATION.CLASSIFIED, source: 'active', description: 'Yes/No' }
  ],

  // 11. BRANCH (3 columns)
  branch: [
    { target: 'Code', type: FIELD_CLASSIFICATION.DERIVED, source: 'guid/code', description: 'Branch code' },
    { target: 'Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'NAME', description: 'Branch office name' },
    { target: 'GSTNo', type: FIELD_CLASSIFICATION.DIRECT, source: 'PARTYGSTIN', description: 'Branch GSTIN' }
  ],

  // 12. COST CENTER (3 columns)
  cost_centers: [
    { target: 'Code', type: FIELD_CLASSIFICATION.DERIVED, source: 'guid/code', description: 'Cost centre code' },
    { target: 'Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'NAME', description: 'Cost centre name' },
    { target: 'Branch Code/Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'CATEGORY/PARENT', description: 'Cost category or parent branch' }
  ],

  // 13. SALES REPRESENTATIVE (3 columns)
  sales_representative: [
    { target: 'Code', type: FIELD_CLASSIFICATION.DERIVED, source: 'guid/code', description: 'Representative code' },
    { target: 'Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'NAME', description: 'Representative name' },
    { target: 'Mobile No', type: FIELD_CLASSIFICATION.DIRECT, source: 'LEDGERPHONE', description: 'Mobile / contact number' }
  ],

  // 14. GROUPS (5 columns)
  groups: [
    { target: 'Group Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'NAME', description: 'Group name' },
    { target: 'Parent Group', type: FIELD_CLASSIFICATION.DIRECT, source: 'PARENT', description: 'Parent group' },
    { target: 'Is Addable', type: FIELD_CLASSIFICATION.CLASSIFIED, source: 'ISADDABLE', description: 'Yes/No' },
    { target: 'Is Sub Ledger', type: FIELD_CLASSIFICATION.CLASSIFIED, source: 'ISSUBLEDGER', description: 'Yes/No' },
    { target: 'Is Calculate', type: FIELD_CLASSIFICATION.CLASSIFIED, source: 'ISCALCULATE', description: 'Yes/No' }
  ],

  // 15. STOCK GROUPS (3 columns)
  stock_groups: [
    { target: 'Stock Group Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'NAME', description: 'Stock group name' },
    { target: 'Parent', type: FIELD_CLASSIFICATION.DIRECT, source: 'PARENT', description: 'Parent stock group' },
    { target: 'Is Addable', type: FIELD_CLASSIFICATION.CLASSIFIED, source: 'ISADDABLE', description: 'Yes/No' }
  ],

  // 16. UNITS (4 columns)
  units: [
    { target: 'Unit Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'NAME', description: 'Unit name' },
    { target: 'Original Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'ORIGINALNAME', description: 'Original UOM name' },
    { target: 'Decimal Places', type: FIELD_CLASSIFICATION.DIRECT, source: 'DECIMALPLACES', description: 'Decimal places' },
    { target: 'GST Excluded', type: FIELD_CLASSIFICATION.CLASSIFIED, source: 'ISGSTEXCLUDED', description: 'Yes/No' }
  ],

  // 17. SALES ORDERS (13 columns)
  sales_orders: [
    { target: 'Order Number', type: FIELD_CLASSIFICATION.DIRECT, source: 'VOUCHERNUMBER', description: 'Sales order number' },
    { target: 'Order Date', type: FIELD_CLASSIFICATION.DERIVED, source: 'DATE', description: 'Order date YYYY-MM-DD' },
    { target: 'Due Date', type: FIELD_CLASSIFICATION.DERIVED, source: 'BASICDUEDATE', description: 'Due date' },
    { target: 'Customer Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'PARTYLEDGERNAME', description: 'Customer name' },
    { target: 'GSTIN', type: FIELD_CLASSIFICATION.DIRECT, source: 'PARTYGSTIN', description: 'Customer GSTIN' },
    { target: 'Place of Supply', type: FIELD_CLASSIFICATION.DIRECT, source: 'PLACEOFSUPPLY', description: 'Place of supply' },
    { target: 'Item Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'STOCKITEMNAME', description: 'Stock item name' },
    { target: 'Quantity', type: FIELD_CLASSIFICATION.DERIVED, source: 'BILLEDQTY', description: 'Ordered quantity' },
    { target: 'Rate', type: FIELD_CLASSIFICATION.DERIVED, source: 'RATE', description: 'Item unit rate' },
    { target: 'Amount', type: FIELD_CLASSIFICATION.DERIVED, source: 'AMOUNT', description: 'Line amount' },
    { target: 'Godown', type: FIELD_CLASSIFICATION.DIRECT, source: 'GODOWNNAME', description: 'Warehouse location' },
    { target: 'Order Total', type: FIELD_CLASSIFICATION.DERIVED, source: 'AMOUNT', description: 'Order grand total' },
    { target: 'Narration', type: FIELD_CLASSIFICATION.DIRECT, source: 'NARRATION', description: 'Order narration' }
  ],

  // 18. PURCHASE ORDERS (13 columns)
  purchase_orders: [
    { target: 'Order Number', type: FIELD_CLASSIFICATION.DIRECT, source: 'VOUCHERNUMBER', description: 'Purchase order number' },
    { target: 'Order Date', type: FIELD_CLASSIFICATION.DERIVED, source: 'DATE', description: 'Order date YYYY-MM-DD' },
    { target: 'Due Date', type: FIELD_CLASSIFICATION.DERIVED, source: 'BASICDUEDATE', description: 'Due date' },
    { target: 'Vendor Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'PARTYLEDGERNAME', description: 'Vendor name' },
    { target: 'GSTIN', type: FIELD_CLASSIFICATION.DIRECT, source: 'PARTYGSTIN', description: 'Vendor GSTIN' },
    { target: 'Place of Supply', type: FIELD_CLASSIFICATION.DIRECT, source: 'PLACEOFSUPPLY', description: 'Place of supply' },
    { target: 'Item Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'STOCKITEMNAME', description: 'Stock item name' },
    { target: 'Quantity', type: FIELD_CLASSIFICATION.DERIVED, source: 'BILLEDQTY', description: 'Ordered quantity' },
    { target: 'Rate', type: FIELD_CLASSIFICATION.DERIVED, source: 'RATE', description: 'Item unit rate' },
    { target: 'Amount', type: FIELD_CLASSIFICATION.DERIVED, source: 'AMOUNT', description: 'Line amount' },
    { target: 'Godown', type: FIELD_CLASSIFICATION.DIRECT, source: 'GODOWNNAME', description: 'Warehouse location' },
    { target: 'Order Total', type: FIELD_CLASSIFICATION.DERIVED, source: 'AMOUNT', description: 'Order grand total' },
    { target: 'Narration', type: FIELD_CLASSIFICATION.DIRECT, source: 'NARRATION', description: 'Order narration' }
  ],

  // 19. DELIVERY NOTES (12 columns)
  delivery_notes: [
    { target: 'Note Number', type: FIELD_CLASSIFICATION.DIRECT, source: 'VOUCHERNUMBER', description: 'Delivery challan number' },
    { target: 'Date', type: FIELD_CLASSIFICATION.DERIVED, source: 'DATE', description: 'Dispatch date YYYY-MM-DD' },
    { target: 'Customer Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'PARTYLEDGERNAME', description: 'Customer name' },
    { target: 'GSTIN', type: FIELD_CLASSIFICATION.DIRECT, source: 'PARTYGSTIN', description: 'Customer GSTIN' },
    { target: 'Place of Supply', type: FIELD_CLASSIFICATION.DIRECT, source: 'PLACEOFSUPPLY', description: 'Place of supply' },
    { target: 'Item Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'STOCKITEMNAME', description: 'Stock item name' },
    { target: 'Quantity', type: FIELD_CLASSIFICATION.DERIVED, source: 'BILLEDQTY', description: 'Delivered quantity' },
    { target: 'Rate', type: FIELD_CLASSIFICATION.DERIVED, source: 'RATE', description: 'Item unit rate' },
    { target: 'Amount', type: FIELD_CLASSIFICATION.DERIVED, source: 'AMOUNT', description: 'Line amount' },
    { target: 'Godown', type: FIELD_CLASSIFICATION.DIRECT, source: 'GODOWNNAME', description: 'Warehouse location' },
    { target: 'Note Total', type: FIELD_CLASSIFICATION.DERIVED, source: 'AMOUNT', description: 'Note total' },
    { target: 'Narration', type: FIELD_CLASSIFICATION.DIRECT, source: 'NARRATION', description: 'Challan narration' }
  ],

  // 20. RECEIPT NOTES (12 columns)
  receipt_notes: [
    { target: 'Note Number', type: FIELD_CLASSIFICATION.DIRECT, source: 'VOUCHERNUMBER', description: 'Goods receipt number' },
    { target: 'Date', type: FIELD_CLASSIFICATION.DERIVED, source: 'DATE', description: 'Receipt date YYYY-MM-DD' },
    { target: 'Vendor Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'PARTYLEDGERNAME', description: 'Vendor name' },
    { target: 'GSTIN', type: FIELD_CLASSIFICATION.DIRECT, source: 'PARTYGSTIN', description: 'Vendor GSTIN' },
    { target: 'Place of Supply', type: FIELD_CLASSIFICATION.DIRECT, source: 'PLACEOFSUPPLY', description: 'Place of supply' },
    { target: 'Item Name', type: FIELD_CLASSIFICATION.DIRECT, source: 'STOCKITEMNAME', description: 'Stock item name' },
    { target: 'Quantity', type: FIELD_CLASSIFICATION.DERIVED, source: 'BILLEDQTY', description: 'Received quantity' },
    { target: 'Rate', type: FIELD_CLASSIFICATION.DERIVED, source: 'RATE', description: 'Item unit rate' },
    { target: 'Amount', type: FIELD_CLASSIFICATION.DERIVED, source: 'AMOUNT', description: 'Line amount' },
    { target: 'Godown', type: FIELD_CLASSIFICATION.DIRECT, source: 'GODOWNNAME', description: 'Warehouse location' },
    { target: 'Note Total', type: FIELD_CLASSIFICATION.DERIVED, source: 'AMOUNT', description: 'Note total' },
    { target: 'Narration', type: FIELD_CLASSIFICATION.DIRECT, source: 'NARRATION', description: 'Receipt narration' }
  ]
};

// Aliases mapping for common alternative naming in MAPPING_CATALOG
const MAPPING_ALIASES = {
  ledgers: 'chart_of_accounts',
  ledger: 'chart_of_accounts',
  items: 'stock_items',
  branches: 'branch',
  sales_rep: 'sales_representative',
  sales_representatives: 'sales_representative',
  cost_centres: 'cost_centers',
  stock_movement: 'inventory_master',
  inventorymaster: 'inventory_master'
};

export class MappingEngine {
  /**
   * Retrieves field-level mapping definitions for a given dataset
   */
  static getMappingForDataset(datasetKey) {
    const rawKey = String(datasetKey).toLowerCase().replace(/[-\s]/g, '_');
    const key = MAPPING_ALIASES[rawKey] || rawKey;
    return MAPPING_CATALOG[key] || null;
  }

  /**
   * Generates a validation report detailing field classification counts
   */
  static getMappingSummary(datasetKey) {
    const mappings = this.getMappingForDataset(datasetKey);
    if (!mappings) return null;

    const summary = {
      dataset: datasetKey,
      totalColumns: mappings.length,
      direct: 0,
      derived: 0,
      classified: 0,
      unavailable: 0
    };

    for (const m of mappings) {
      if (m.type === FIELD_CLASSIFICATION.DIRECT) summary.direct++;
      else if (m.type === FIELD_CLASSIFICATION.DERIVED) summary.derived++;
      else if (m.type === FIELD_CLASSIFICATION.CLASSIFIED) summary.classified++;
      else if (m.type === FIELD_CLASSIFICATION.UNAVAILABLE) summary.unavailable++;
    }

    return summary;
  }
}
