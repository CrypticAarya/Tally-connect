import { XMLParser } from 'fast-xml-parser';

/**
 * Normalization helper ensuring single or multiple XML nodes become an Array
 */
function ensureArray(val) {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

/**
 * Parses numeric amounts from Tally strings (e.g. "-76000.00" -> 76000)
 */
function parseTallyAmount(amountStr) {
  if (amountStr == null) return 0;
  const num = parseFloat(String(amountStr).replace(/,/g, '').trim());
  return isNaN(num) ? 0 : Math.abs(num);
}

/**
 * Parses quantity values from Tally quantity strings (e.g. "100 NOS", "250.50 PCS" -> 100)
 */
function parseTallyQty(qtyStr) {
  if (qtyStr == null) return 0;
  const match = String(qtyStr).match(/[-+]?[0-9]*\.?[0-9]+/);
  return match ? parseFloat(match[0]) : 0;
}

/**
 * Parses rate values from Tally rate strings (e.g. "800.00/NOS" -> 800)
 */
function parseTallyRate(rateStr) {
  if (rateStr == null) return 0;
  const match = String(rateStr).match(/[-+]?[0-9]*\.?[0-9]+/);
  return match ? parseFloat(match[0]) : 0;
}

/**
 * Formats Tally YYYYMMDD string to ISO YYYY-MM-DD
 */
function formatTallyDateToIso(tallyDate) {
  if (!tallyDate) return '';
  const str = String(tallyDate).trim();
  if (str.length === 8 && /^\d{8}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  }
  return str;
}

/**
 * Extracts 10-character PAN from Indian GSTIN (e.g. 27AAACA1234D1Z5 -> AAACA1234D)
 */
function extractPanFromGstin(gstin) {
  if (!gstin) return '';
  const clean = String(gstin).trim();
  if (clean.length === 15) {
    return clean.slice(2, 12);
  }
  return '';
}

export class TallyXmlParser {
  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      trimValues: true,
      parseTagValue: false // Preserve raw string tokens
    });
  }

  /**
   * Parses raw XML string into JavaScript object tree
   */
  parseRawXml(xmlString) {
    if (!xmlString || typeof xmlString !== 'string') {
      throw new Error('TallyXmlParser received empty or non-string XML input');
    }
    return this.parser.parse(xmlString);
  }

  /**
   * Normalizes Company discovery XML into standard company info
   */
  normalizeCompany(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
    const companyNode = collection?.COMPANY ? ensureArray(collection.COMPANY)[0] : null;

    if (!companyNode) {
      return {
        name: 'No Company Loaded',
        guid: '',
        financialYearFrom: '2026-04-01',
        financialYearTo: '2027-03-31',
        tallyVersion: 'TallyPrime (Live XML Engine)',
        port: 9000
      };
    }

    return {
      name: companyNode.NAME || companyNode['@_NAME'] || 'Active Tally Company',
      guid: companyNode.GUID || '',
      financialYearFrom: formatTallyDateToIso(companyNode.STARTINGFROM) || '2026-04-01',
      financialYearTo: formatTallyDateToIso(companyNode.ENDINGAT) || '2027-03-31',
      tallyVersion: 'TallyPrime (Live XML Engine)',
      port: 9000
    };
  }

  /**
   * Normalizes Customer Master XML into standard ledger objects
   */
  normalizeCustomers(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
    const ledgerNodes = ensureArray(collection?.LEDGER);

    return ledgerNodes.map((node, idx) => {
      const name = node.NAME || node['@_NAME'] || '';
      const guid = node.GUID || `cust-guid-${101 + idx}`;
      const code = node.GUID ? node.GUID.slice(0, 10) : `CUST-${101 + idx}`;

      // Address lines aggregation from <ADDRESS.LIST>
      const addressLines = [];
      if (node['ADDRESS.LIST']) {
        const addrNode = ensureArray(node['ADDRESS.LIST'])[0];
        if (addrNode && addrNode.ADDRESS) {
          ensureArray(addrNode.ADDRESS).forEach(line => {
            if (line && typeof line === 'string') addressLines.push(line.trim());
          });
        }
      }

      // Bank details from <BANKDETAILS.LIST>
      let bank = {};
      if (node['BANKDETAILS.LIST']) {
        const bankNode = ensureArray(node['BANKDETAILS.LIST'])[0];
        if (bankNode) {
          bank = {
            bankName: bankNode.BANKNAME || '',
            ifscCode: bankNode.IFSCCODE || '',
            accountNumber: bankNode.ACCOUNTNUMBER || ''
          };
        }
      }

      const gstin = node.PARTYGSTIN || '';
      const pan = node.PANNUMBER || extractPanFromGstin(gstin);
      const stateName = node.STATENAME || '';
      const gstStateCode = gstin.length >= 2 ? gstin.slice(0, 2) : '';

      return {
        guid,
        name,
        code,
        parent: node.PARENT || 'Sundry Debtors',
        customerType: 'B2B Corporate',
        accountStatus: 'Active',
        contact: {
          name: node.LEDGERCONTACT || '',
          email: node.EMAIL || '',
          phone: node.LEDGERPHONE || ''
        },
        mailingDetails: {
          addressLines: addressLines.length ? addressLines : [node.MAILINGNAME || name],
          city: stateName,
          state: stateName,
          postalCode: node.PINCODE || '',
          country: node.COUNTRYNAME || 'India'
        },
        statutory: {
          gstRegType: 'Regular',
          gstin,
          gstStateCode,
          gstStateName: stateName,
          pan
        },
        creditPolicy: {
          creditDays: parseInt(node.BILLCREDITPERIOD || '30', 10) || 30,
          creditLimit: parseFloat(node.CREDITLIMIT || '0') || 0,
          paymentTerms: node.BILLCREDITPERIOD || 'Net 30 Days',
          currency: 'INR'
        },
        organization: {
          branch: 'Main Branch',
          salesRepresentative: '',
          mainDistributor: '',
          mainDealer: '',
          mainAgent: '',
          subDistributor: '',
          subDealer: '',
          subAgent: ''
        },
        banking: {
          bankName: bank.bankName || '',
          ifscCode: bank.ifscCode || '',
          accountNumber: bank.accountNumber || '',
          startDate: '',
          endDate: ''
        },
        active: true,
        remarks: 'Live Tally Ledger'
      };
    });
  }

  /**
   * Normalizes Chart of Accounts XML into standard hierarchy records
   */
  normalizeChartOfAccounts(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
    const ledgerNodes = ensureArray(collection?.LEDGER);

    return ledgerNodes.map((node, idx) => {
      const name = node.NAME || node['@_NAME'] || '';
      const parent = node.PARENT || 'Primary';
      
      let grouping = 'Assets/Liabilities';
      if (parent.toLowerCase().includes('sales') || parent.toLowerCase().includes('income')) {
        grouping = 'Direct Incomes';
      } else if (parent.toLowerCase().includes('duties') || parent.toLowerCase().includes('taxes')) {
        grouping = 'Current Liabilities';
      } else if (parent.toLowerCase().includes('debtor') || parent.toLowerCase().includes('bank')) {
        grouping = 'Current Assets';
      }

      return {
        guid: node.GUID || `gl-guid-${idx + 1}`,
        code: `GL-${2000 + idx}`,
        name,
        description: node.DESCRIPTION || `Ledger under ${parent}`,
        parent,
        grouping,
        financialSummaryGrouping: parent,
        branch: 'Main Branch',
        costCenter: node.ISCOSTCENTRESON === 'Yes' ? 'Cost Center Applicable' : '',
        costClassification: 'Direct',
        costBehaviour: 'Variable',
        svVariablePercent: 100.0,
        isInterBranch: false,
        isRelatedParty: false,
        gstApplicable: node.GSTAPPLICABLE || 'Applicable',
        tdsApplicable: node.TDSAPPLICABLE || 'Not Applicable',
        active: true,
        remarks: node.NARRATION || 'Imported from Tally'
      };
    });
  }

  /**
   * Normalizes Sales Vouchers XML into hierarchical voucher structures
   * preserving ALLINVENTORYENTRIES and LEDGERENTRIES
   */
  normalizeSalesVouchers(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
    const voucherNodes = ensureArray(collection?.VOUCHER);

    return voucherNodes.map((vch, vIdx) => {
      const voucherNumber = vch.VOUCHERNUMBER || `VCH-${vIdx + 1}`;
      const voucherDate = formatTallyDateToIso(vch.DATE) || '2026-04-01';
      const partyName = vch.PARTYLEDGERNAME || '';
      const partyGstin = vch.PARTYGSTIN || '';
      const placeOfSupply = vch.PLACEOFSUPPLY || 'Maharashtra';
      const narration = vch.NARRATION || '';

      // 1. Process Inventory Line Items from <ALLINVENTORYENTRIES.LIST>
      const invNodes = ensureArray(vch['ALLINVENTORYENTRIES.LIST']);
      const allInventoryEntries = invNodes.map((item, iIdx) => {
        const itemDescription = item.STOCKITEMNAME || `Item ${iIdx + 1}`;
        const hsn = item.HSNCODE || '';
        const godown = item.GODOWNNAME || '';
        const qty = parseTallyQty(item.BILLEDQTY);
        const rate = parseTallyRate(item.RATE);
        const amount = parseTallyAmount(item.AMOUNT);

        // Tax calculation: Detect GST rates from ledger entries or default standard 18% (9% CGST + 9% SGST, or 18% IGST)
        const isInterState = placeOfSupply && !placeOfSupply.toLowerCase().includes('maharashtra');
        const gstRate = 18.0;

        let cgstRate = 0, cgstAmount = 0, sgstRate = 0, sgstAmount = 0, igstRate = 0, igstAmount = 0;
        if (isInterState) {
          igstRate = gstRate;
          igstAmount = Number(((amount * igstRate) / 100).toFixed(2));
        } else {
          cgstRate = gstRate / 2;
          cgstAmount = Number(((amount * cgstRate) / 100).toFixed(2));
          sgstRate = gstRate / 2;
          sgstAmount = Number(((amount * sgstRate) / 100).toFixed(2));
        }

        const batchAllocations = [];
        if (item['BATCHALLOCATIONS.LIST']) {
          ensureArray(item['BATCHALLOCATIONS.LIST']).forEach(b => {
            batchAllocations.push({
              batchNo: b.BATCHNAME || `BATCH-${iIdx + 1}`,
              godown: b.GODOWNNAME || godown,
              qty: parseTallyQty(b.BILLEDQTY) || qty
            });
          });
        }

        return {
          itemDescription,
          hsn,
          godown,
          qty,
          rate,
          discount: 0,
          taxValue: amount,
          cgstRate,
          cgstAmount,
          sgstRate,
          sgstAmount,
          igstRate,
          igstAmount,
          batchAllocations
        };
      });

      // 2. Process Accounting Ledger Postings from <LEDGERENTRIES.LIST>
      const ledgerNodes = ensureArray(vch['LEDGERENTRIES.LIST']);
      let otherCharges = 0;
      let totalInvoice = 0;

      const ledgerEntries = ledgerNodes.map(lNode => {
        const ledgerName = lNode.LEDGERNAME || '';
        const amount = parseTallyAmount(lNode.AMOUNT);
        const isDeemedPositive = (lNode.ISDEEMEDPOSITIVE === 'Yes');

        let taxType = 'OTHER_CHARGES';
        if (ledgerName === partyName) {
          taxType = 'PARTY';
          totalInvoice = amount;
        } else if (ledgerName.toLowerCase().includes('sales')) {
          taxType = 'SALES';
        } else if (ledgerName.toLowerCase().includes('cgst')) {
          taxType = 'CGST';
        } else if (ledgerName.toLowerCase().includes('sgst')) {
          taxType = 'SGST';
        } else if (ledgerName.toLowerCase().includes('igst')) {
          taxType = 'IGST';
        } else {
          taxType = 'OTHER_CHARGES';
          otherCharges += amount;
        }

        return {
          ledgerName,
          isDeemedPositive,
          amount: isDeemedPositive ? -amount : amount,
          taxType
        };
      });

      // Fallback total invoice calculation if party ledger total was 0
      if (!totalInvoice) {
        const itemTotal = allInventoryEntries.reduce((sum, item) => sum + (item.taxValue + item.cgstAmount + item.sgstAmount + item.igstAmount), 0);
        totalInvoice = Number((itemTotal + otherCharges).toFixed(2));
      }

      return {
        voucherKey: vch.GUID || `vch-guid-${vIdx + 1}`,
        date: voucherDate,
        voucherNumber,
        invoiceDate: voucherDate,
        voucherType: vch.VOUCHERTYPENAME || 'Sales',
        partyLedgerName: partyName,
        partyCode: partyGstin ? partyGstin.slice(2, 10) : `CUST-${vIdx + 1}`,
        partyGstin,
        customerType: 'B2B',
        salesType: partyGstin.startsWith('27') ? 'Intra-State Taxable' : 'Inter-State Taxable',
        branchName: 'Main Branch',
        branchCode: 'B001',
        costCenter: 'General Distribution',
        placeOfSupply,
        paymentTerms: 'Net 30 Days',
        dueDate: voucherDate,
        paymentStatus: 'Unpaid',
        paymentDate: '',
        modeOfPayment: 'Bank Transfer',
        narration,
        otherCharges,
        totalInvoice,
        allInventoryEntries,
        ledgerEntries
      };
    });
  }

  /**
   * Normalizes Trial Balance XML into standard ledger balance records
   */
  normalizeTrialBalance(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
    const ledgerNodes = ensureArray(collection?.LEDGER);

    return ledgerNodes.map(node => {
      const name = node.NAME || node['@_NAME'] || '';
      const closingRaw = parseFloat(node.CLOSINGBALANCE || '0');
      const closing = Math.abs(closingRaw);
      const drCr = closingRaw < 0 ? 'Dr' : 'Cr';

      return {
        monthYear: '2026-04',
        branch: 'Main Branch',
        particulars: node.PARENT || 'General Ledger',
        name,
        opening: parseTallyAmount(node.OPENINGBALANCE),
        debit: parseTallyAmount(node.DEBITTOTALS),
        credit: parseTallyAmount(node.CREDITTOTALS),
        closing,
        drCr
      };
    });
  }
}
