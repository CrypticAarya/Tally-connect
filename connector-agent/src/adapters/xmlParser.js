import { XMLParser } from 'fast-xml-parser';

/**
 * Normalization helper ensuring single or multiple XML nodes become an Array
 */
function ensureArray(val) {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

/**
 * Extracts clean string text from strings, numbers, or XML objects with text/attribute properties
 */
export function extractTextValue(val) {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (val['#text'] !== undefined && val['#text'] !== null) {
      return String(val['#text']).trim();
    }
    if (val.value !== undefined && val.value !== null) {
      return String(val.value).trim();
    }
    if (val['@_NAME'] !== undefined && val['@_NAME'] !== null) {
      return String(val['@_NAME']).trim();
    }
    if (val.NAME !== undefined && val.NAME !== null) {
      return extractTextValue(val.NAME);
    }
    if (Array.isArray(val) && val.length > 0) {
      return extractTextValue(val[0]);
    }
    return '';
  }
  return String(val).trim();
}

/**
 * Calculates correct financial year bounds from Tally STARTINGFROM and ENDINGAT
 */
export function computeFinancialYear(startingFromRaw, endingAtRaw) {
  const from = formatTallyDateToIso(startingFromRaw);
  const to = formatTallyDateToIso(endingAtRaw);

  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    // If endingAt is valid and strictly after startingFrom, use it
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to) && to > from) {
      return { from, to };
    }
    // Calculate 1 full financial year (12 months minus 1 day)
    const [y, m, d] = from.split('-').map(Number);
    const endDate = new Date(Date.UTC(y + 1, m - 1, d - 1));
    const toY = endDate.getUTCFullYear();
    const toM = String(endDate.getUTCMonth() + 1).padStart(2, '0');
    const toD = String(endDate.getUTCDate()).padStart(2, '0');
    return { from, to: `${toY}-${toM}-${toD}` };
  }

  // Fallback to current financial year based on today's date
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  if (currentMonth >= 4) {
    return {
      from: `${currentYear}-04-01`,
      to: `${currentYear + 1}-03-31`
    };
  } else {
    return {
      from: `${currentYear - 1}-04-01`,
      to: `${currentYear}-03-31`
    };
  }
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
    const parsed = this.parser.parse(xmlString);

    // Inspect parsed XML for Tally error responses
    const header = parsed?.ENVELOPE?.HEADER;
    const status = header?.STATUS;
    if (status !== undefined && status !== null && String(status).trim() === '0') {
      const errorMsg = header?.ERROR || parsed?.ENVELOPE?.BODY?.DATA?.LINEERROR || parsed?.RESPONSE || 'Tally returned failure status (STATUS=0)';
      const err = new Error(typeof errorMsg === 'object' ? extractTextValue(errorMsg) : String(errorMsg));
      err.code = 'TALLY_ERROR';
      throw err;
    }

    const lineError = parsed?.ENVELOPE?.BODY?.DATA?.LINEERROR || parsed?.ENVELOPE?.LINEERROR || parsed?.LINEERROR;
    if (lineError) {
      const errText = typeof lineError === 'object' ? extractTextValue(lineError) : String(lineError);
      const err = new Error(`Tally reported an error: ${errText}`);
      err.code = 'TALLY_LINE_ERROR';
      throw err;
    }

    if (parsed.RESPONSE && !parsed.ENVELOPE) {
      const respText = typeof parsed.RESPONSE === 'object' ? extractTextValue(parsed.RESPONSE) : String(parsed.RESPONSE);
      if (/error|failed|invalid/i.test(respText)) {
        const err = new Error(`Tally response error: ${respText}`);
        err.code = 'TALLY_RESPONSE_ERROR';
        throw err;
      }
    }

    return parsed;
  }

  normalizeCompanies(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const data = parsed?.ENVELOPE?.BODY?.DATA;
    const companyNodes = extractEntityNodes(data, 'COMPANY');

    if (!companyNodes || companyNodes.length === 0) {
      return [];
    }

    const companies = [];
    for (const node of companyNodes) {
      let companyName = '';
      if (node['@_NAME']) {
        companyName = extractTextValue(node['@_NAME']);
      }
      if (!companyName && node.NAME) {
        companyName = extractTextValue(node.NAME);
      }
      if (!companyName) {
        companyName = extractTextValue(node);
      }

      if (!companyName || companyName === 'No Company Loaded') {
        continue;
      }

      const { from: financialYearFrom, to: financialYearTo } = computeFinancialYear(
        node.STARTINGFROM,
        node.ENDINGAT
      );

      companies.push({
        name: companyName,
        guid: extractTextValue(node.GUID) || '',
        financialYear: `${financialYearFrom} to ${financialYearTo}`,
        financialYearFrom,
        financialYearTo,
        tallyVersion: 'TallyPrime',
        port: 9000
      });
    }

    return companies;
  }

  normalizeCompany(xmlString) {
    const companies = this.normalizeCompanies(xmlString);

    if (companies.length === 0) {
      const err = new Error("We couldn't identify the active Tally company. Please open a company in TallyPrime and try again.");
      err.code = 'NO_ACTIVE_COMPANY';
      throw err;
    }

    return companies[0];
  }

  normalizeCustomers(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const data = parsed?.ENVELOPE?.BODY?.DATA;
    const ledgerNodes = extractEntityNodes(data, 'LEDGER');

    return ledgerNodes.map((node) => {
      const name = extractTextValue(node.NAME || node['@_NAME']);
      const guid = extractTextValue(node.GUID);
      const code = guid ? guid.slice(0, 10) : '';

      const addressLines = [];
      if (node['ADDRESS.LIST']) {
        const addrNode = ensureArray(node['ADDRESS.LIST'])[0];
        if (addrNode && addrNode.ADDRESS) {
          ensureArray(addrNode.ADDRESS).forEach(line => {
            const cleanLine = extractTextValue(line);
            if (cleanLine) addressLines.push(cleanLine);
          });
        }
      } else if (node.ADDRESS) {
        ensureArray(node.ADDRESS).forEach(line => {
          const cleanLine = extractTextValue(line);
          if (cleanLine) addressLines.push(cleanLine);
        });
      }

      let bank = {};
      if (node['BANKDETAILS.LIST']) {
        const bankNode = ensureArray(node['BANKDETAILS.LIST'])[0];
        if (bankNode) {
          bank = {
            bankName: extractTextValue(bankNode.BANKNAME),
            ifscCode: extractTextValue(bankNode.IFSCCODE),
            accountNumber: extractTextValue(bankNode.ACCOUNTNUMBER)
          };
        }
      }

      const gstin = extractTextValue(node.PARTYGSTIN);
      const pan = extractTextValue(node.PANNUMBER) || extractPanFromGstin(gstin);
      const stateName = extractTextValue(node.STATENAME);
      const gstStateCode = gstin.length >= 2 ? gstin.slice(0, 2) : '';

      return {
        guid,
        name,
        code,
        parent: extractTextValue(node.PARENT),
        customerType: extractTextValue(node.CUSTOMERTYPE),
        accountStatus: 'Active',
        contact: {
          name: extractTextValue(node.LEDGERCONTACT),
          email: extractTextValue(node.EMAIL),
          phone: extractTextValue(node.LEDGERPHONE)
        },
        mailingDetails: {
          addressLines: addressLines.length ? addressLines : (node.MAILINGNAME ? [extractTextValue(node.MAILINGNAME)] : []),
          city: stateName,
          state: stateName,
          postalCode: extractTextValue(node.PINCODE),
          country: extractTextValue(node.COUNTRYNAME)
        },
        statutory: {
          gstRegType: extractTextValue(node.GSTREGISTRATIONTYPE),
          gstin,
          gstStateCode,
          gstStateName: stateName,
          pan
        },
        creditPolicy: {
          creditDays: node.BILLCREDITPERIOD ? (parseInt(extractTextValue(node.BILLCREDITPERIOD), 10) || 0) : 0,
          creditLimit: parseFloat(extractTextValue(node.CREDITLIMIT) || '0') || 0,
          paymentTerms: extractTextValue(node.BILLCREDITPERIOD),
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
      const name = extractTextValue(node.NAME || node['@_NAME']);
      const guid = extractTextValue(node.GUID);
      const code = guid ? guid.slice(0, 10) : '';

      const addressLines = [];
      if (node['ADDRESS.LIST']) {
        const addrNode = ensureArray(node['ADDRESS.LIST'])[0];
        if (addrNode && addrNode.ADDRESS) {
          ensureArray(addrNode.ADDRESS).forEach(line => {
            const cleanLine = extractTextValue(line);
            if (cleanLine) addressLines.push(cleanLine);
          });
        }
      } else if (node.ADDRESS) {
        ensureArray(node.ADDRESS).forEach(line => {
          const cleanLine = extractTextValue(line);
          if (cleanLine) addressLines.push(cleanLine);
        });
      }

      let bank = {};
      if (node['BANKDETAILS.LIST']) {
        const bankNode = ensureArray(node['BANKDETAILS.LIST'])[0];
        if (bankNode) {
          bank = {
            bankName: extractTextValue(bankNode.BANKNAME),
            ifscCode: extractTextValue(bankNode.IFSCCODE),
            accountNumber: extractTextValue(bankNode.ACCOUNTNUMBER)
          };
        }
      }

      const gstin = extractTextValue(node.PARTYGSTIN);
      const pan = extractTextValue(node.PANNUMBER) || extractPanFromGstin(gstin);
      const stateName = extractTextValue(node.STATENAME);

      return {
        guid,
        name,
        code,
        parent: extractTextValue(node.PARENT),
        vendorType: extractTextValue(node.VENDORTYPE),
        status: 'Active',
        contact: {
          name: extractTextValue(node.LEDGERCONTACT),
          email: extractTextValue(node.EMAIL),
          phone: extractTextValue(node.LEDGERPHONE)
        },
        mailingDetails: {
          addressLines: addressLines.length ? addressLines : (node.MAILINGNAME ? [extractTextValue(node.MAILINGNAME)] : []),
          city: stateName,
          state: stateName,
          postalCode: extractTextValue(node.PINCODE),
          country: extractTextValue(node.COUNTRYNAME)
        },
        statutory: {
          gstin,
          pan,
          stateName
        },
        creditPolicy: {
          creditDays: node.BILLCREDITPERIOD ? (parseInt(extractTextValue(node.BILLCREDITPERIOD), 10) || 0) : 0,
          creditLimit: parseFloat(extractTextValue(node.CREDITLIMIT) || '0') || 0
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
      guid: extractTextValue(node.GUID),
      name: extractTextValue(node.NAME || node['@_NAME']),
      parent: extractTextValue(node.PARENT),
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
      const name = extractTextValue(node.NAME || node['@_NAME']);
      const parent = extractTextValue(node.PARENT);
      const gstin = extractTextValue(node.PARTYGSTIN);

      return {
        guid: extractTextValue(node.GUID),
        name,
        parent,
        description: extractTextValue(node.DESCRIPTION),
        openingBalance: parseTallyAmount(node.OPENINGBALANCE),
        closingBalance: parseTallyAmount(node.CLOSINGBALANCE),
        gstApplicable: extractTextValue(node.GSTAPPLICABLE),
        isCostCentresOn: node.ISCOSTCENTRESON === 'Yes',
        mailingName: extractTextValue(node.MAILINGNAME) || name,
        city: extractTextValue(node.STATENAME),
        state: extractTextValue(node.STATENAME),
        pincode: extractTextValue(node.PINCODE),
        country: extractTextValue(node.COUNTRYNAME),
        gstin,
        pan: extractTextValue(node.PANNUMBER) || extractPanFromGstin(gstin),
        phone: extractTextValue(node.LEDGERPHONE),
        email: extractTextValue(node.EMAIL),
        narration: extractTextValue(node.NARRATION)
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
      guid: extractTextValue(node.GUID),
      name: extractTextValue(node.NAME || node['@_NAME']),
      parent: extractTextValue(node.PARENT),
      category: extractTextValue(node.CATEGORY)
    }));
  }

  normalizeStockItems(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const data = parsed?.ENVELOPE?.BODY?.DATA;
    const itemNodes = extractEntityNodes(data, 'STOCKITEM');

    return itemNodes.map((node) => ({
      guid: extractTextValue(node.GUID),
      name: extractTextValue(node.NAME || node['@_NAME']),
      parent: extractTextValue(node.PARENT),
      uom: extractTextValue(node.BASEUNITS),
      openingQuantity: parseTallyQty(node.OPENINGBALANCE),
      openingRate: parseTallyRate(node.OPENINGRATE),
      openingValue: parseTallyAmount(node.OPENINGVALUE),
      closingQuantity: parseTallyQty(node.CLOSINGBALANCE),
      closingRate: parseTallyRate(node.CLOSINGRATE),
      closingValue: parseTallyAmount(node.CLOSINGVALUE),
      gstApplicable: extractTextValue(node.GSTAPPLICABLE),
      gstRate: node.GSTRATE ? parseFloat(extractTextValue(node.GSTRATE)) : 0,
      hsnCode: extractTextValue(node.HSNCODE),
      description: extractTextValue(node.DESCRIPTION),
      costingMethod: extractTextValue(node.COSTINGMETHOD),
      reorderLevel: parseTallyQty(node.REORDERBASE),
      minStockQty: parseTallyQty(node.MINORDERQTY),
      maxStockQty: parseTallyQty(node.MAXSTOCKLEVEL)
    }));
  }

  normalizeStockGroups(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const data = parsed?.ENVELOPE?.BODY?.DATA;
    const grpNodes = extractEntityNodes(data, 'STOCKGROUP');

    return grpNodes.map((node) => ({
      guid: extractTextValue(node.GUID),
      name: extractTextValue(node.NAME || node['@_NAME']),
      parent: extractTextValue(node.PARENT),
      isAddable: node.ISADDABLE === 'Yes'
    }));
  }

  normalizeUnits(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const data = parsed?.ENVELOPE?.BODY?.DATA;
    const unitNodes = extractEntityNodes(data, 'UNIT');

    return unitNodes.map((node) => ({
      guid: extractTextValue(node.GUID),
      name: extractTextValue(node.NAME || node['@_NAME']),
      originalName: extractTextValue(node.ORIGINALNAME || node.NAME),
      decimalPlaces: parseInt(extractTextValue(node.DECIMALPLACES) || '0', 10) || 0,
      isGstExcluded: node.ISGSTEXCLUDED === 'Yes'
    }));
  }

  normalizeGodowns(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const data = parsed?.ENVELOPE?.BODY?.DATA;
    const gNodes = extractEntityNodes(data, 'GODOWN');

    return gNodes.map((node) => ({
      guid: extractTextValue(node.GUID),
      name: extractTextValue(node.NAME || node['@_NAME']),
      parent: extractTextValue(node.PARENT),
      address: extractTextValue(node.ADDRESS),
      pincode: extractTextValue(node.PINCODE)
    }));
  }

  _parseVouchers(xmlString, defaultType = 'Voucher') {
    const parsed = this.parseRawXml(xmlString);
    const data = parsed?.ENVELOPE?.BODY?.DATA;
    const voucherNodes = extractEntityNodes(data, 'VOUCHER');

    return voucherNodes.map((vch) => {
      const voucherNumber = extractTextValue(vch.VOUCHERNUMBER);
      const voucherDate = formatTallyDateToIso(vch.DATE) || '';
      const dueDate = formatTallyDateToIso(vch.BASICDUEDATE) || voucherDate;
      const partyName = extractTextValue(vch.PARTYLEDGERNAME || vch.PARTYNAME);
      const partyGstin = extractTextValue(vch.PARTYGSTIN);
      const placeOfSupply = extractTextValue(vch.PLACEOFSUPPLY);
      const narration = extractTextValue(vch.NARRATION);

      const invNodes = ensureArray(vch['ALLINVENTORYENTRIES.LIST']);
      const items = invNodes.map((item) => {
        const itemName = extractTextValue(item.STOCKITEMNAME);
        const qty = parseTallyQty(item.BILLEDQTY);
        const rate = parseTallyRate(item.RATE);
        const amount = parseTallyAmount(item.AMOUNT);
        const godown = extractTextValue(item.GODOWNNAME);
        return {
          itemName,
          quantity: qty,
          rate,
          amount,
          godown,
          unit: extractTextValue(item.BASEUNITS),
          hsnCode: extractTextValue(item.HSNCODE)
        };
      });

      const ledgerNodes = ensureArray(vch['LEDGERENTRIES.LIST']);
      let calculatedTotal = 0;
      const ledgerEntries = ledgerNodes.map(lNode => {
        const ledgerName = extractTextValue(lNode.LEDGERNAME);
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
        id: extractTextValue(vch.GUID),
        guid: extractTextValue(vch.GUID),
        orderNumber: voucherNumber,
        voucherNumber,
        date: voucherDate,
        dueDate,
        voucherType: extractTextValue(vch.VOUCHERTYPENAME) || defaultType,
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

  normalizePurchaseVouchers(xmlString) {
    return this._parseVouchers(xmlString, 'Purchase');
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
        const name = extractTextValue(node.NAME || node['@_NAME']);
        const parent = extractTextValue(node.PARENT);
        const opening = parseTallyAmount(node.OPENINGBALANCE);
        const debit = parseTallyAmount(node.DEBITTOTALS);
        const credit = parseTallyAmount(node.CREDITTOTALS);
        const closing = parseTallyAmount(node.CLOSINGBALANCE);

        return {
          guid: extractTextValue(node.GUID),
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
        if (node.DSPACCNAME) {
          name = extractTextValue(node.DSPACCNAME?.DSPDISPNAME || node.DSPACCNAME);
        } else if (node.DSPDISPNAME) {
          name = extractTextValue(node.DSPDISPNAME);
        }

        const parent = extractTextValue(node.DSPGROUPNAME || node.DSPPARENTNAME);
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

  /**
   * Normalizes inventory movement vouchers for Inventory Master export
   */
  normalizeInventoryMaster(xmlString) {
    return this._parseVouchers(xmlString, 'Stock Movement');
  }

  /**
   * Normalizes branch company entities
   */
  normalizeBranch(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const data = parsed?.ENVELOPE?.BODY?.DATA;
    const companyNodes = extractEntityNodes(data, 'COMPANY');

    const results = companyNodes.map((comp) => {
      const name = extractTextValue(comp.NAME);
      const guid = extractTextValue(comp.GUID) || name;
      const gstin = extractTextValue(comp.PARTYGSTIN || comp.GSTIN);
      return {
        id: guid,
        guid,
        code: guid,
        name,
        gstNo: gstin,
        gstin
      };
    });

    return attachMetadata(results);
  }

  /**
   * Normalizes sales representative cost centre entities
   */
  normalizeSalesRepresentative(xmlString) {
    const parsed = this.parseRawXml(xmlString);
    const data = parsed?.ENVELOPE?.BODY?.DATA;
    const costCentres = extractEntityNodes(data, 'COSTCENTRE');

    const results = costCentres.map((cc) => {
      const name = extractTextValue(cc.NAME);
      const guid = extractTextValue(cc.GUID) || name;
      const mobile = extractTextValue(cc.LEDGERPHONE || cc.PHONENUMBER);
      return {
        id: guid,
        guid,
        code: guid,
        name,
        mobileNo: mobile,
        mobile
      };
    });

    return attachMetadata(results);
  }
}
