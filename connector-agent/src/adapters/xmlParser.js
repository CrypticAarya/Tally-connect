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
      parseTagValue: false
    });
  }

  parseRawXml(xmlString) {
    if (!xmlString || typeof xmlString !== 'string') {
      throw new Error('TallyXmlParser received empty or non-string XML input');
    }
    return this.parser.parse(xmlString);
  }

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

  normalizeCustomers(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
    const ledgerNodes = ensureArray(collection?.LEDGER);

    return ledgerNodes.map((node, idx) => {
      const name = node.NAME || node['@_NAME'] || '';
      const guid = node.GUID || `cust-guid-${101 + idx}`;
      const code = node.GUID ? node.GUID.slice(0, 10) : `CUST-${101 + idx}`;

      const addressLines = [];
      if (node['ADDRESS.LIST']) {
        const addrNode = ensureArray(node['ADDRESS.LIST'])[0];
        if (addrNode && addrNode.ADDRESS) {
          ensureArray(addrNode.ADDRESS).forEach(line => {
            if (line && typeof line === 'string') addressLines.push(line.trim());
          });
        }
      }

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
        banking: {
          bankName: bank.bankName || '',
          ifscCode: bank.ifscCode || '',
          accountNumber: bank.accountNumber || ''
        },
        openingBalance: parseTallyAmount(node.OPENINGBALANCE),
        closingBalance: parseTallyAmount(node.CLOSINGBALANCE),
        active: true
      };
    });
  }

  normalizeVendors(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
    const ledgerNodes = ensureArray(collection?.LEDGER);

    return ledgerNodes.map((node, idx) => {
      const name = node.NAME || node['@_NAME'] || '';
      const guid = node.GUID || `vend-guid-${201 + idx}`;
      const code = node.GUID ? node.GUID.slice(0, 10) : `VEND-${201 + idx}`;

      const addressLines = [];
      if (node['ADDRESS.LIST']) {
        const addrNode = ensureArray(node['ADDRESS.LIST'])[0];
        if (addrNode && addrNode.ADDRESS) {
          ensureArray(addrNode.ADDRESS).forEach(line => {
            if (line && typeof line === 'string') addressLines.push(line.trim());
          });
        }
      }

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

      return {
        guid,
        name,
        code,
        parent: node.PARENT || 'Sundry Creditors',
        vendorType: 'Supplier',
        status: 'Active',
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
          gstin,
          pan,
          stateName
        },
        creditPolicy: {
          creditDays: parseInt(node.BILLCREDITPERIOD || '30', 10) || 30,
          creditLimit: parseFloat(node.CREDITLIMIT || '0') || 0
        },
        banking: {
          bankName: bank.bankName || '',
          ifscCode: bank.ifscCode || '',
          accountNumber: bank.accountNumber || ''
        },
        openingBalance: parseTallyAmount(node.OPENINGBALANCE),
        closingBalance: parseTallyAmount(node.CLOSINGBALANCE),
        active: true
      };
    });
  }

  normalizeGroups(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
    const groupNodes = ensureArray(collection?.GROUP);

    return groupNodes.map((node, idx) => ({
      guid: node.GUID || `grp-${idx + 1}`,
      name: node.NAME || node['@_NAME'] || '',
      parent: node.PARENT || 'Primary',
      isAddable: node.ISADDABLE === 'Yes',
      isSubLedger: node.ISSUBLEDGER === 'Yes',
      isCalculate: node.BASICGROUPISCALCULATE === 'Yes'
    }));
  }

  normalizeLedgers(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
    const ledgerNodes = ensureArray(collection?.LEDGER);

    return ledgerNodes.map((node, idx) => {
      const name = node.NAME || node['@_NAME'] || '';
      const parent = node.PARENT || 'Primary';
      const gstin = node.PARTYGSTIN || '';

      return {
        guid: node.GUID || `ledg-${idx + 1}`,
        name,
        parent,
        description: node.DESCRIPTION || '',
        openingBalance: parseTallyAmount(node.OPENINGBALANCE),
        closingBalance: parseTallyAmount(node.CLOSINGBALANCE),
        gstApplicable: node.GSTAPPLICABLE || 'Applicable',
        isCostCentresOn: node.ISCOSTCENTRESON === 'Yes',
        mailingName: node.MAILINGNAME || name,
        city: node.STATENAME || '',
        state: node.STATENAME || '',
        pincode: node.PINCODE || '',
        country: node.COUNTRYNAME || 'India',
        gstin,
        pan: node.PANNUMBER || extractPanFromGstin(gstin),
        phone: node.LEDGERPHONE || '',
        email: node.EMAIL || '',
        narration: node.NARRATION || ''
      };
    });
  }

  normalizeChartOfAccounts(xmlString) {
    return this.normalizeLedgers(xmlString);
  }

  normalizeCostCentres(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
    const ccNodes = ensureArray(collection?.COSTCENTRE);

    return ccNodes.map((node, idx) => ({
      guid: node.GUID || `cc-${idx + 1}`,
      name: node.NAME || node['@_NAME'] || '',
      parent: node.PARENT || 'Primary',
      category: node.CATEGORY || 'Primary Cost Category'
    }));
  }

  normalizeStockItems(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
    const itemNodes = ensureArray(collection?.STOCKITEM);

    return itemNodes.map((node, idx) => ({
      guid: node.GUID || `item-${idx + 1}`,
      name: node.NAME || node['@_NAME'] || '',
      parent: node.PARENT || 'Stock Items',
      uom: node.BASEUNITS || 'NOS',
      openingQuantity: parseTallyQty(node.OPENINGBALANCE),
      openingRate: parseTallyRate(node.OPENINGRATE),
      openingValue: parseTallyAmount(node.OPENINGVALUE),
      closingQuantity: parseTallyQty(node.CLOSINGBALANCE),
      closingRate: parseTallyRate(node.CLOSINGRATE),
      closingValue: parseTallyAmount(node.CLOSINGVALUE),
      gstApplicable: node.GSTAPPLICABLE || 'Applicable',
      gstRate: 18.0,
      hsnCode: node.HSNCODE || '',
      description: node.DESCRIPTION || ''
    }));
  }

  normalizeStockGroups(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
    const grpNodes = ensureArray(collection?.STOCKGROUP);

    return grpNodes.map((node, idx) => ({
      guid: node.GUID || `stkgrp-${idx + 1}`,
      name: node.NAME || node['@_NAME'] || '',
      parent: node.PARENT || 'Primary',
      isAddable: node.ISADDABLE === 'Yes'
    }));
  }

  normalizeUnits(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
    const unitNodes = ensureArray(collection?.UNIT);

    return unitNodes.map((node, idx) => ({
      guid: node.GUID || `unit-${idx + 1}`,
      name: node.NAME || node['@_NAME'] || '',
      originalName: node.ORIGINALNAME || node.NAME || '',
      decimalPlaces: parseInt(node.DECIMALPLACES || '0', 10),
      isGstExcluded: node.ISGSTEXCLUDED === 'Yes'
    }));
  }

  normalizeGodowns(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
    const gNodes = ensureArray(collection?.GODOWN);

    return gNodes.map((node, idx) => ({
      guid: node.GUID || `godown-${idx + 1}`,
      name: node.NAME || node['@_NAME'] || '',
      parent: node.PARENT || 'Primary',
      address: node.ADDRESS || '',
      pincode: node.PINCODE || ''
    }));
  }

  _parseVouchers(xmlString, defaultType = 'Voucher') {
    const parsed = this.parseRawXml(xmlString);
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
    const voucherNodes = ensureArray(collection?.VOUCHER);

    return voucherNodes.map((vch, vIdx) => {
      const voucherNumber = vch.VOUCHERNUMBER || `VCH-${vIdx + 1}`;
      const voucherDate = formatTallyDateToIso(vch.DATE) || '2026-04-01';
      const dueDate = formatTallyDateToIso(vch.BASICDUEDATE) || voucherDate;
      const partyName = vch.PARTYLEDGERNAME || '';
      const partyGstin = vch.PARTYGSTIN || '';
      const placeOfSupply = vch.PLACEOFSUPPLY || 'Maharashtra';
      const narration = vch.NARRATION || '';

      const invNodes = ensureArray(vch['ALLINVENTORYENTRIES.LIST']);
      const items = invNodes.map((item, iIdx) => {
        const itemName = item.STOCKITEMNAME || `Item ${iIdx + 1}`;
        const qty = parseTallyQty(item.BILLEDQTY);
        const rate = parseTallyRate(item.RATE);
        const amount = parseTallyAmount(item.AMOUNT);
        const godown = item.GODOWNNAME || '';
        return {
          itemName,
          quantity: qty,
          rate,
          amount,
          godown,
          unit: item.BASEUNITS || 'NOS',
          hsnCode: item.HSNCODE || ''
        };
      });

      const ledgerNodes = ensureArray(vch['LEDGERENTRIES.LIST']);
      let calculatedTotal = 0;
      const ledgerEntries = ledgerNodes.map(lNode => {
        const ledgerName = lNode.LEDGERNAME || '';
        const amount = parseTallyAmount(lNode.AMOUNT);
        const isDeemedPositive = (lNode.ISDEEMEDPOSITIVE === 'Yes');
        if (ledgerName === partyName) {
          calculatedTotal = amount;
        }
        return {
          ledgerName,
          amount: isDeemedPositive ? -amount : amount
        };
      });

      if (!calculatedTotal) {
        calculatedTotal = items.reduce((s, it) => s + it.amount, 0);
      }

      return {
        id: vch.GUID || `vch-guid-${vIdx + 1}`,
        guid: vch.GUID || `vch-guid-${vIdx + 1}`,
        orderNumber: voucherNumber,
        voucherNumber,
        date: voucherDate,
        dueDate,
        voucherType: vch.VOUCHERTYPENAME || defaultType,
        partyName,
        partyLedgerName: partyName,
        partyGstin,
        placeOfSupply,
        narration,
        amount: calculatedTotal,
        totalInvoice: calculatedTotal,
        items,
        allInventoryEntries: items,
        ledgerEntries
      };
    });
  }

  normalizeSalesOrders(xmlString) {
    return this._parseVouchers(xmlString, 'Sales Order');
  }

  normalizePurchaseOrders(xmlString) {
    return this._parseVouchers(xmlString, 'Purchase Order');
  }

  normalizeDeliveryNotes(xmlString) {
    return this._parseVouchers(xmlString, 'Delivery Note');
  }

  normalizeReceiptNotes(xmlString) {
    return this._parseVouchers(xmlString, 'Receipt Note');
  }

  normalizeSalesVouchers(xmlString) {
    return this._parseVouchers(xmlString, 'Sales');
  }

  normalizeTrialBalance(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const collection = parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION;
    const ledgerNodes = ensureArray(collection?.LEDGER);

    return ledgerNodes.map((node, idx) => {
      const name = node.NAME || node['@_NAME'] || '';
      const parent = node.PARENT || 'Primary';
      const opening = parseTallyAmount(node.OPENINGBALANCE);
      const debit = parseTallyAmount(node.DEBITTOTALS);
      const credit = parseTallyAmount(node.CREDITTOTALS);
      const closing = parseTallyAmount(node.CLOSINGBALANCE);

      return {
        guid: node.GUID || `tb-guid-${idx + 1}`,
        name,
        parent,
        openingBalance: opening,
        debitTotals: debit,
        creditTotals: credit,
        closingBalance: closing
      };
    });
  }
}
