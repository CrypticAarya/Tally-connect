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
  if (typeof amountStr === 'object') {
    amountStr = amountStr['#text'] ?? amountStr.value ?? 0;
  }
  const num = parseFloat(String(amountStr).replace(/,/g, '').trim());
  return isNaN(num) ? 0 : Math.abs(num);
}

/**
 * Parses quantity values from Tally quantity strings (e.g. "100 NOS", "250.50 PCS" -> 100)
 */
function parseTallyQty(qtyStr) {
  if (qtyStr == null) return 0;
  if (typeof qtyStr === 'object') {
    qtyStr = qtyStr['#text'] ?? qtyStr.value ?? 0;
  }
  const match = String(qtyStr).match(/[-+]?[0-9]*\.?[0-9]+/);
  return match ? parseFloat(match[0]) : 0;
}

/**
 * Parses rate values from Tally rate strings (e.g. "800.00/NOS" -> 800)
 */
function parseTallyRate(rateStr) {
  if (rateStr == null) return 0;
  if (typeof rateStr === 'object') {
    rateStr = rateStr['#text'] ?? rateStr.value ?? 0;
  }
  const match = String(rateStr).match(/[-+]?[0-9]*\.?[0-9]+/);
  return match ? parseFloat(match[0]) : 0;
}

/**
 * Formats Tally YYYYMMDD string to ISO YYYY-MM-DD
 */
function formatTallyDateToIso(tallyDate) {
  if (!tallyDate) return '';
  let raw = tallyDate;
  if (typeof tallyDate === 'object') {
    raw = tallyDate['#text'] ?? tallyDate.value ?? '';
  }
  const str = String(raw).trim();
  if (str.length === 8 && /^\d{8}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
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

/**
 * Resiliently extracts entity nodes whether wrapped in COLLECTION, TALLYMESSAGE, or DATA root
 */
function extractEntityNodes(data, tagName) {
  if (!data) return [];
  if (data?.COLLECTION?.[tagName]) {
    return ensureArray(data.COLLECTION[tagName]);
  }
  if (data?.TALLYMESSAGE) {
    const messages = ensureArray(data.TALLYMESSAGE);
    const nodes = [];
    for (const msg of messages) {
      if (msg[tagName]) {
        nodes.push(...ensureArray(msg[tagName]));
      }
    }
    if (nodes.length > 0) return nodes;
  }
  if (data?.[tagName]) {
    return ensureArray(data[tagName]);
  }
  return [];
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
    const data = parsed?.ENVELOPE?.BODY?.DATA;
    const companyNodes = extractEntityNodes(data, 'COMPANY');
    const companyNode = companyNodes.length > 0 ? companyNodes[0] : null;

    if (!companyNode) {
      const err = new Error("We couldn't identify the active Tally company. Please open a company in TallyPrime and try again.");
      err.code = 'NO_ACTIVE_COMPANY';
      throw err;
    }

    const companyName = companyNode.NAME || companyNode['@_NAME'];
    if (!companyName || companyName === 'No Company Loaded') {
      const err = new Error("We couldn't identify the active Tally company. Please open a company in TallyPrime and try again.");
      err.code = 'NO_ACTIVE_COMPANY';
      throw err;
    }

    return {
      name: companyName,
      guid: companyNode.GUID || '',
      financialYearFrom: formatTallyDateToIso(companyNode.STARTINGFROM) || '',
      financialYearTo: formatTallyDateToIso(companyNode.ENDINGAT) || '',
      tallyVersion: 'TallyPrime',
      port: 9000
    };
  }

  normalizeCustomers(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const data = parsed?.ENVELOPE?.BODY?.DATA;
    const ledgerNodes = extractEntityNodes(data, 'LEDGER');

    return ledgerNodes.map((node) => {
      const name = node.NAME || node['@_NAME'] || '';
      const guid = node.GUID || '';
      const code = node.GUID ? node.GUID.slice(0, 10) : '';

      const addressLines = [];
      if (node['ADDRESS.LIST']) {
        const addrNode = ensureArray(node['ADDRESS.LIST'])[0];
        if (addrNode && addrNode.ADDRESS) {
          ensureArray(addrNode.ADDRESS).forEach(line => {
            if (line && typeof line === 'string') addressLines.push(line.trim());
          });
        }
      } else if (node.ADDRESS) {
        ensureArray(node.ADDRESS).forEach(line => {
          if (line && typeof line === 'string') addressLines.push(line.trim());
        });
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
        parent: node.PARENT || '',
        customerType: node.CUSTOMERTYPE || '',
        accountStatus: 'Active',
        contact: {
          name: node.LEDGERCONTACT || '',
          email: node.EMAIL || '',
          phone: node.LEDGERPHONE || ''
        },
        mailingDetails: {
          addressLines: addressLines.length ? addressLines : (node.MAILINGNAME ? [node.MAILINGNAME] : []),
          city: stateName,
          state: stateName,
          postalCode: node.PINCODE || '',
          country: node.COUNTRYNAME || ''
        },
        statutory: {
          gstRegType: node.GSTREGISTRATIONTYPE || '',
          gstin,
          gstStateCode,
          gstStateName: stateName,
          pan
        },
        creditPolicy: {
          creditDays: node.BILLCREDITPERIOD ? (parseInt(node.BILLCREDITPERIOD, 10) || 0) : 0,
          creditLimit: parseFloat(node.CREDITLIMIT || '0') || 0,
          paymentTerms: node.BILLCREDITPERIOD || '',
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
    const data = parsed?.ENVELOPE?.BODY?.DATA;
    const ledgerNodes = extractEntityNodes(data, 'LEDGER');

    return ledgerNodes.map((node) => {
      const name = node.NAME || node['@_NAME'] || '';
      const guid = node.GUID || '';
      const code = node.GUID ? node.GUID.slice(0, 10) : '';

      const addressLines = [];
      if (node['ADDRESS.LIST']) {
        const addrNode = ensureArray(node['ADDRESS.LIST'])[0];
        if (addrNode && addrNode.ADDRESS) {
          ensureArray(addrNode.ADDRESS).forEach(line => {
            if (line && typeof line === 'string') addressLines.push(line.trim());
          });
        }
      } else if (node.ADDRESS) {
        ensureArray(node.ADDRESS).forEach(line => {
          if (line && typeof line === 'string') addressLines.push(line.trim());
        });
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
        parent: node.PARENT || '',
        vendorType: node.VENDORTYPE || '',
        status: 'Active',
        contact: {
          name: node.LEDGERCONTACT || '',
          email: node.EMAIL || '',
          phone: node.LEDGERPHONE || ''
        },
        mailingDetails: {
          addressLines: addressLines.length ? addressLines : (node.MAILINGNAME ? [node.MAILINGNAME] : []),
          city: stateName,
          state: stateName,
          postalCode: node.PINCODE || '',
          country: node.COUNTRYNAME || ''
        },
        statutory: {
          gstin,
          pan,
          stateName
        },
        creditPolicy: {
          creditDays: node.BILLCREDITPERIOD ? (parseInt(node.BILLCREDITPERIOD, 10) || 0) : 0,
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
    const data = parsed?.ENVELOPE?.BODY?.DATA;
    const groupNodes = extractEntityNodes(data, 'GROUP');

    return groupNodes.map((node) => ({
      guid: node.GUID || '',
      name: node.NAME || node['@_NAME'] || '',
      parent: node.PARENT || '',
      isAddable: node.ISADDABLE === 'Yes',
      isSubLedger: node.ISSUBLEDGER === 'Yes',
      isCalculate: node.BASICGROUPISCALCULATE === 'Yes'
    }));
  }

  normalizeLedgers(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const data = parsed?.ENVELOPE?.BODY?.DATA;
    const ledgerNodes = extractEntityNodes(data, 'LEDGER');

    return ledgerNodes.map((node) => {
      const name = node.NAME || node['@_NAME'] || '';
      const parent = node.PARENT || '';
      const gstin = node.PARTYGSTIN || '';

      return {
        guid: node.GUID || '',
        name,
        parent,
        description: node.DESCRIPTION || '',
        openingBalance: parseTallyAmount(node.OPENINGBALANCE),
        closingBalance: parseTallyAmount(node.CLOSINGBALANCE),
        gstApplicable: node.GSTAPPLICABLE || '',
        isCostCentresOn: node.ISCOSTCENTRESON === 'Yes',
        mailingName: node.MAILINGNAME || name,
        city: node.STATENAME || '',
        state: node.STATENAME || '',
        pincode: node.PINCODE || '',
        country: node.COUNTRYNAME || '',
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
    const data = parsed?.ENVELOPE?.BODY?.DATA;
    const ccNodes = extractEntityNodes(data, 'COSTCENTRE');

    return ccNodes.map((node) => ({
      guid: node.GUID || '',
      name: node.NAME || node['@_NAME'] || '',
      parent: node.PARENT || '',
      category: node.CATEGORY || ''
    }));
  }

  normalizeStockItems(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const data = parsed?.ENVELOPE?.BODY?.DATA;
    const itemNodes = extractEntityNodes(data, 'STOCKITEM');

    return itemNodes.map((node) => ({
      guid: node.GUID || '',
      name: node.NAME || node['@_NAME'] || '',
      parent: node.PARENT || '',
      uom: node.BASEUNITS || '',
      openingQuantity: parseTallyQty(node.OPENINGBALANCE),
      openingRate: parseTallyRate(node.OPENINGRATE),
      openingValue: parseTallyAmount(node.OPENINGVALUE),
      closingQuantity: parseTallyQty(node.CLOSINGBALANCE),
      closingRate: parseTallyRate(node.CLOSINGRATE),
      closingValue: parseTallyAmount(node.CLOSINGVALUE),
      gstApplicable: node.GSTAPPLICABLE || '',
      gstRate: node.GSTRATE ? parseFloat(node.GSTRATE) : 0,
      hsnCode: node.HSNCODE || '',
      description: node.DESCRIPTION || ''
    }));
  }

  normalizeStockGroups(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const data = parsed?.ENVELOPE?.BODY?.DATA;
    const grpNodes = extractEntityNodes(data, 'STOCKGROUP');

    return grpNodes.map((node) => ({
      guid: node.GUID || '',
      name: node.NAME || node['@_NAME'] || '',
      parent: node.PARENT || '',
      isAddable: node.ISADDABLE === 'Yes'
    }));
  }

  normalizeUnits(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const data = parsed?.ENVELOPE?.BODY?.DATA;
    const unitNodes = extractEntityNodes(data, 'UNIT');

    return unitNodes.map((node) => ({
      guid: node.GUID || '',
      name: node.NAME || node['@_NAME'] || '',
      originalName: node.ORIGINALNAME || node.NAME || '',
      decimalPlaces: parseInt(node.DECIMALPLACES || '0', 10) || 0,
      isGstExcluded: node.ISGSTEXCLUDED === 'Yes'
    }));
  }

  normalizeGodowns(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const data = parsed?.ENVELOPE?.BODY?.DATA;
    const gNodes = extractEntityNodes(data, 'GODOWN');

    return gNodes.map((node) => ({
      guid: node.GUID || '',
      name: node.NAME || node['@_NAME'] || '',
      parent: node.PARENT || '',
      address: node.ADDRESS || '',
      pincode: node.PINCODE || ''
    }));
  }

  _parseVouchers(xmlString, defaultType = 'Voucher') {
    const parsed = this.parseRawXml(xmlString);
    const data = parsed?.ENVELOPE?.BODY?.DATA;
    const voucherNodes = extractEntityNodes(data, 'VOUCHER');

    return voucherNodes.map((vch) => {
      const voucherNumber = vch.VOUCHERNUMBER || '';
      const voucherDate = formatTallyDateToIso(vch.DATE) || '';
      const dueDate = formatTallyDateToIso(vch.BASICDUEDATE) || voucherDate;
      const partyName = vch.PARTYLEDGERNAME || '';
      const partyGstin = vch.PARTYGSTIN || '';
      const placeOfSupply = vch.PLACEOFSUPPLY || '';
      const narration = vch.NARRATION || '';

      const invNodes = ensureArray(vch['ALLINVENTORYENTRIES.LIST']);
      const items = invNodes.map((item) => {
        const itemName = item.STOCKITEMNAME || '';
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
          unit: item.BASEUNITS || '',
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
        id: vch.GUID || '',
        guid: vch.GUID || '',
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

  normalizeTrialBalance(xmlString, requestedOptions = {}) {
    const parsed = this.parseRawXml(xmlString);
    const data = parsed?.ENVELOPE?.BODY?.DATA;

    // Date range extraction and verification
    let returnedFromDate = null;
    let returnedToDate = null;

    const staticVars = parsed?.ENVELOPE?.BODY?.DESC?.STATICVARIABLES;
    if (staticVars?.SVFROMDATE) {
      returnedFromDate = formatTallyDateToIso(staticVars.SVFROMDATE);
    }
    if (staticVars?.SVTODATE) {
      returnedToDate = formatTallyDateToIso(staticVars.SVTODATE);
    }

    if (!returnedFromDate && data?.DSPFROMDATE) {
      returnedFromDate = formatTallyDateToIso(data.DSPFROMDATE);
    }
    if (!returnedToDate && data?.DSPTODATE) {
      returnedToDate = formatTallyDateToIso(data.DSPTODATE);
    }

    const requestedFrom = requestedOptions.fromDate ? formatTallyDateToIso(requestedOptions.fromDate) : null;
    const requestedTo = requestedOptions.toDate ? formatTallyDateToIso(requestedOptions.toDate) : null;

    const dateRangeVerification = {
      requestedFromDate: requestedFrom,
      requestedToDate: requestedTo,
      returnedFromDate,
      returnedToDate,
      verified: Boolean(returnedFromDate && returnedToDate &&
        (!requestedFrom || returnedFromDate === requestedFrom) &&
        (!requestedTo || returnedToDate === requestedTo))
    };

    const attachMetadata = (results) => {
      results.dateRangeVerification = dateRangeVerification;
      results.reportPeriod = {
        fromDate: returnedFromDate || requestedFrom || '',
        toDate: returnedToDate || requestedTo || '',
        verified: dateRangeVerification.verified
      };
      return results;
    };

    // 1. Check for standard LEDGER nodes (under COLLECTION, TALLYMESSAGE, or DATA)
    const ledgerNodes = extractEntityNodes(data, 'LEDGER');

    if (ledgerNodes.length > 0) {
      const results = ledgerNodes.map((node) => {
        const name = node.NAME || node['@_NAME'] || '';
        const parent = node.PARENT || '';
        const opening = parseTallyAmount(node.OPENINGBALANCE);
        const debit = parseTallyAmount(node.DEBITTOTALS);
        const credit = parseTallyAmount(node.CREDITTOTALS);
        const closing = parseTallyAmount(node.CLOSINGBALANCE);

        return {
          guid: node.GUID || '',
          name,
          parent,
          openingBalance: opening,
          debitTotals: debit,
          creditTotals: credit,
          closingBalance: closing
        };
      });
      return attachMetadata(results);
    }

    // 2. Parse official Tally Report Display XML (TYPE=Data, ID=TrialBalance)
    // Tally returns display lines with DSPACCNAME, DSPDRAMT, DSPCRAMT, etc.
    const displayRecords = [];
    const collectDspRecords = (node) => {
      if (!node || typeof node !== 'object') return;
      if (node.DSPACCNAME || node.DSPDISPNAME) {
        displayRecords.push(node);
        return;
      }
      for (const val of Object.values(node)) {
        if (Array.isArray(val)) {
          val.forEach(item => collectDspRecords(item));
        } else if (typeof val === 'object') {
          collectDspRecords(val);
        }
      }
    };

    collectDspRecords(data);

    if (displayRecords.length > 0) {
      const results = displayRecords.map(node => {
        let name = '';
        if (typeof node.DSPACCNAME === 'string') {
          name = node.DSPACCNAME;
        } else if (node.DSPACCNAME?.DSPDISPNAME) {
          name = String(node.DSPACCNAME.DSPDISPNAME);
        } else if (node.DSPDISPNAME) {
          name = String(node.DSPDISPNAME);
        }

        const parent = node.DSPGROUPNAME || node.DSPPARENTNAME || '';
        const opDr = parseTallyAmount(node.DSPOPDRBAL || node.DSPDIFFBAL);
        const opCr = parseTallyAmount(node.DSPOPCRBAL);
        const dr = parseTallyAmount(node.DSPDRAMT || node.DSPDRBAL);
        const cr = parseTallyAmount(node.DSPCRAMT || node.DSPCRBAL);
        const clDr = parseTallyAmount(node.DSPCLDRAMT || node.DSPCLDRBAL);
        const clCr = parseTallyAmount(node.DSPCLCRAMT || node.DSPCLCRBAL);

        return {
          guid: '',
          name: name.trim(),
          parent: String(parent).trim(),
          openingDebit: opDr,
          openingCredit: opCr,
          openingBalance: (opDr || 0) - (opCr || 0),
          debitTotals: dr,
          creditTotals: cr,
          closingDebit: clDr,
          closingCredit: clCr,
          closingBalance: (clDr || 0) - (clCr || 0)
        };
      }).filter(row => row.name.length > 0 && row.name !== 'Total');

      return attachMetadata(results);
    }

    return attachMetadata([]);
  }
}
