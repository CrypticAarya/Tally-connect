/**
 * JSON Data Transformation Engine
 * 
 * Transforms hierarchical TallyPrime entities into standardized, camelCase JSON models
 * specifically tailored for consumption by modern SaaS Developer APIs.
 * Supports all master data and transaction entities.
 */

export class JsonTransformer {
  /**
   * Main entrypoint: transforms raw Tally data based on dataset entity type
   * @param {string} datasetType - CUSTOMERS, VENDORS, GROUPS, LEDGERS, COST_CENTRES, INVENTORY, STOCK_GROUPS, UNITS, GODOWNS, ORDERS, SALES_ORDERS, PURCHASE_ORDERS, DELIVERY_NOTES, RECEIPT_NOTES, SALES, TRIAL_BALANCE
   * @param {Array<Object>} rawData - Raw hierarchical records from TallyAdapter
   * @returns {Array<Object>} Normalized array of camelCase JSON entity objects
   */
  static transform(datasetType, rawData) {
    if (!Array.isArray(rawData)) {
      if (rawData && typeof rawData === 'object') {
        rawData = [rawData];
      } else {
        return [];
      }
    }

    const normalizedKey = String(datasetType).toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    switch (normalizedKey) {
      case 'CUSTOMER':
      case 'CUSTOMERS':
        return this.transformCustomers(rawData);

      case 'VENDOR':
      case 'VENDORS':
        return this.transformVendors(rawData);

      case 'GROUP':
      case 'GROUPS':
        return this.transformGroups(rawData);

      case 'LEDGER':
      case 'LEDGERS':
      case 'CHART_OF_ACCOUNTS':
        return this.transformLedgers(rawData);

      case 'COST_CENTRE':
      case 'COST_CENTRES':
      case 'COSTCENTRE':
      case 'COSTCENTRES':
        return this.transformCostCentres(rawData);

      case 'INVENTORY':
      case 'STOCK_ITEM':
      case 'STOCK_ITEMS':
        return this.transformInventory(rawData);

      case 'STOCK_GROUP':
      case 'STOCK_GROUPS':
        return this.transformStockGroups(rawData);

      case 'UNIT':
      case 'UNITS':
        return this.transformUnits(rawData);

      case 'GODOWN':
      case 'GODOWNS':
        return this.transformGodowns(rawData);

      case 'ORDER':
      case 'ORDERS':
      case 'SALES_ORDER':
      case 'SALES_ORDERS':
        return this.transformSalesOrders(rawData);

      case 'PURCHASE_ORDER':
      case 'PURCHASE_ORDERS':
        return this.transformPurchaseOrders(rawData);

      case 'DELIVERY_NOTE':
      case 'DELIVERY_NOTES':
        return this.transformDeliveryNotes(rawData);

      case 'RECEIPT_NOTE':
      case 'RECEIPT_NOTES':
        return this.transformReceiptNotes(rawData);

      case 'SALES':
      case 'SALES_REGISTER':
        return this.transformSales(rawData);

      case 'TRIAL_BALANCE':
        return this.transformTrialBalance(rawData);

      default:
        return rawData.map(item => this.normalizeObject(item));
    }
  }

  /**
   * Transforms Customer Master ledgers into REST JSON
   */
  static transformCustomers(customers) {
    return customers.map(cust => {
      let streetAddress = '';
      if (Array.isArray(cust.mailingDetails?.addressLines)) {
        streetAddress = cust.mailingDetails.addressLines.filter(Boolean).join(', ');
      } else if (cust.mailingDetails?.addressLines) {
        streetAddress = String(cust.mailingDetails.addressLines);
      }

      return {
        id: cust.guid || cust.id || cust.code || '',
        code: cust.code || cust.customerCode || '',
        name: cust.name || cust.customerName || '',
        type: cust.customerType || 'Customer',
        parentGroup: cust.parent || cust.parentGroup || 'Sundry Debtors',
        status: cust.accountStatus || (cust.active !== false ? 'Active' : 'Inactive'),
        isActive: cust.active !== false,
        gstin: cust.statutory?.gstin || cust.gstin || '',
        pan: cust.statutory?.pan || cust.pan || '',
        contact: {
          name: cust.contact?.name || '',
          email: cust.contact?.email || cust.email || '',
          phone: cust.contact?.phone || cust.phone || ''
        },
        address: {
          street: streetAddress || cust.address?.street || (typeof cust.address === 'string' ? cust.address : ''),
          city: cust.mailingDetails?.city || cust.address?.city || cust.city || '',
          state: cust.mailingDetails?.state || cust.address?.state || cust.state || '',
          pincode: cust.mailingDetails?.postalCode || cust.address?.pincode || cust.pincode || '',
          country: cust.mailingDetails?.country || cust.address?.country || 'India'
        },
        credit: {
          creditDays: cust.creditPolicy?.creditDays != null ? Number(cust.creditPolicy.creditDays) : null,
          creditLimit: cust.creditPolicy?.creditLimit != null ? Number(cust.creditPolicy.creditLimit) : null,
          paymentTerms: cust.creditPolicy?.paymentTerms || '',
          currency: cust.creditPolicy?.currency || 'INR'
        },
        banking: {
          bankName: cust.banking?.bankName || '',
          ifscCode: cust.banking?.ifscCode || '',
          accountNumber: cust.banking?.accountNumber || ''
        },
        openingBalance: cust.openingBalance != null ? Number(cust.openingBalance) : null,
        closingBalance: cust.closingBalance != null ? Number(cust.closingBalance) : null
      };
    });
  }

  /**
   * Transforms Vendor Master ledgers into REST JSON
   */
  static transformVendors(vendors) {
    return vendors.map(vend => {
      let streetAddress = '';
      if (Array.isArray(vend.mailingDetails?.addressLines)) {
        streetAddress = vend.mailingDetails.addressLines.filter(Boolean).join(', ');
      } else if (vend.mailingDetails?.addressLines) {
        streetAddress = String(vend.mailingDetails.addressLines);
      }

      return {
        id: vend.guid || vend.id || vend.code || '',
        code: vend.code || `VEND-${vend.name ? vend.name.slice(0, 4).toUpperCase() : '0001'}`,
        name: vend.name || '',
        type: 'Vendor',
        parentGroup: vend.parent || 'Sundry Creditors',
        status: vend.status || 'Active',
        isActive: vend.active !== false,
        gstin: vend.statutory?.gstin || vend.gstin || '',
        pan: vend.statutory?.pan || vend.pan || '',
        contact: {
          name: vend.contact?.name || '',
          email: vend.contact?.email || vend.email || '',
          phone: vend.contact?.phone || vend.phone || ''
        },
        address: {
          street: streetAddress || vend.address?.street || (typeof vend.address === 'string' ? vend.address : ''),
          city: vend.mailingDetails?.city || vend.city || '',
          state: vend.mailingDetails?.state || vend.state || '',
          pincode: vend.mailingDetails?.postalCode || vend.pincode || '',
          country: vend.mailingDetails?.country || 'India'
        },
        credit: {
          creditDays: vend.creditPolicy?.creditDays != null ? Number(vend.creditPolicy.creditDays) : null,
          creditLimit: vend.creditPolicy?.creditLimit != null ? Number(vend.creditPolicy.creditLimit) : null
        },
        banking: {
          bankName: vend.banking?.bankName || '',
          ifscCode: vend.banking?.ifscCode || '',
          accountNumber: vend.banking?.accountNumber || ''
        },
        openingBalance: vend.openingBalance != null ? Number(vend.openingBalance) : null,
        closingBalance: vend.closingBalance != null ? Number(vend.closingBalance) : null
      };
    });
  }

  /**
   * Transforms Groups into REST JSON
   */
  static transformGroups(groups) {
    return groups.map(g => ({
      id: g.guid || g.id || '',
      name: g.name || '',
      parent: g.parent || 'Primary',
      isAddable: Boolean(g.isAddable),
      isSubLedger: Boolean(g.isSubLedger),
      isCalculate: Boolean(g.isCalculate)
    }));
  }

  /**
   * Transforms Ledgers into REST JSON
   */
  static transformLedgers(ledgers) {
    return ledgers.map(l => ({
      id: l.guid || l.id || '',
      name: l.name || '',
      parent: l.parent || 'Primary',
      description: l.description || '',
      openingBalance: l.openingBalance != null ? Number(l.openingBalance) : 0,
      closingBalance: l.closingBalance != null ? Number(l.closingBalance) : 0,
      gstApplicable: l.gstApplicable || 'Applicable',
      isCostCentresOn: Boolean(l.isCostCentresOn),
      mailingName: l.mailingName || l.name || '',
      address: l.address || '',
      city: l.city || '',
      state: l.state || '',
      pincode: l.pincode || '',
      country: l.country || 'India',
      gstin: l.gstin || '',
      pan: l.pan || '',
      phone: l.phone || '',
      email: l.email || '',
      narration: l.narration || ''
    }));
  }

  /**
   * Transforms Cost Centres into REST JSON
   */
  static transformCostCentres(centres) {
    return centres.map(c => ({
      id: c.guid || c.id || '',
      name: c.name || '',
      parent: c.parent || 'Primary',
      category: c.category || 'Primary Cost Category'
    }));
  }

  /**
   * Transforms Stock Items (Inventory) into REST JSON
   */
  static transformInventory(items) {
    return items.map(item => ({
      id: item.guid || item.id || '',
      name: item.name || item.itemName || '',
      parent: item.parent || item.category || 'Stock Items',
      uom: item.uom || item.baseUnits || item.unit || 'NOS',
      openingQuantity: item.openingQuantity != null ? Number(item.openingQuantity) : 0,
      openingRate: item.openingRate != null ? Number(item.openingRate) : 0,
      openingValue: item.openingValue != null ? Number(item.openingValue) : 0,
      closingQuantity: item.closingQuantity != null ? Number(item.closingQuantity) : (item.quantity != null ? Number(item.quantity) : 0),
      closingRate: item.closingRate != null ? Number(item.closingRate) : (item.rate != null ? Number(item.rate) : 0),
      closingValue: item.closingValue != null ? Number(item.closingValue) : (item.amount != null ? Number(item.amount) : 0),
      hsnCode: item.hsnCode || item.hsn || '',
      gstRate: item.gstRate != null ? Number(item.gstRate) : 18.0,
      description: item.description || ''
    }));
  }

  /**
   * Transforms Stock Groups into REST JSON
   */
  static transformStockGroups(groups) {
    return groups.map(g => ({
      id: g.guid || g.id || '',
      name: g.name || '',
      parent: g.parent || 'Primary',
      isAddable: Boolean(g.isAddable)
    }));
  }

  /**
   * Transforms Units into REST JSON
   */
  static transformUnits(units) {
    return units.map(u => ({
      id: u.guid || u.id || '',
      name: u.name || '',
      originalName: u.originalName || u.name || '',
      decimalPlaces: u.decimalPlaces != null ? Number(u.decimalPlaces) : 0,
      isGstExcluded: Boolean(u.isGstExcluded)
    }));
  }

  /**
   * Transforms Godowns into REST JSON
   */
  static transformGodowns(godowns) {
    return godowns.map(g => ({
      id: g.guid || g.id || '',
      name: g.name || '',
      parent: g.parent || 'Primary',
      address: g.address || '',
      pincode: g.pincode || ''
    }));
  }

  /**
   * Transforms Sales Orders into REST JSON
   */
  static transformSalesOrders(orders) {
    return orders.map(ord => ({
      id: ord.id || ord.guid || '',
      orderNumber: ord.orderNumber || ord.voucherNumber || '',
      date: ord.date || '',
      dueDate: ord.dueDate || ord.date || '',
      voucherType: ord.voucherType || 'Sales Order',
      partyName: ord.partyName || ord.partyLedgerName || '',
      partyGstin: ord.partyGstin || '',
      placeOfSupply: ord.placeOfSupply || '',
      narration: ord.narration || '',
      amount: ord.amount != null ? Number(ord.amount) : (ord.totalInvoice != null ? Number(ord.totalInvoice) : 0),
      items: (ord.items || ord.allInventoryEntries || []).map(i => ({
        itemName: i.itemName || i.itemDescription || '',
        quantity: i.quantity != null ? Number(i.quantity) : (i.qty != null ? Number(i.qty) : 0),
        rate: i.rate != null ? Number(i.rate) : 0,
        amount: i.amount != null ? Number(i.amount) : 0,
        unit: i.unit || 'NOS',
        godown: i.godown || ''
      })),
      ledgerEntries: ord.ledgerEntries || []
    }));
  }

  /**
   * Transforms Purchase Orders into REST JSON
   */
  static transformPurchaseOrders(orders) {
    return orders.map(ord => ({
      id: ord.id || ord.guid || '',
      orderNumber: ord.orderNumber || ord.voucherNumber || '',
      date: ord.date || '',
      dueDate: ord.dueDate || ord.date || '',
      voucherType: ord.voucherType || 'Purchase Order',
      partyName: ord.partyName || ord.partyLedgerName || '',
      partyGstin: ord.partyGstin || '',
      placeOfSupply: ord.placeOfSupply || '',
      narration: ord.narration || '',
      amount: ord.amount != null ? Number(ord.amount) : 0,
      items: (ord.items || ord.allInventoryEntries || []).map(i => ({
        itemName: i.itemName || '',
        quantity: i.quantity != null ? Number(i.quantity) : 0,
        rate: i.rate != null ? Number(i.rate) : 0,
        amount: i.amount != null ? Number(i.amount) : 0,
        unit: i.unit || 'NOS'
      })),
      ledgerEntries: ord.ledgerEntries || []
    }));
  }

  /**
   * Transforms Delivery Notes into REST JSON
   */
  static transformDeliveryNotes(notes) {
    return notes.map(dn => ({
      id: dn.id || dn.guid || '',
      deliveryNoteNumber: dn.orderNumber || dn.voucherNumber || '',
      date: dn.date || '',
      voucherType: dn.voucherType || 'Delivery Note',
      partyName: dn.partyName || dn.partyLedgerName || '',
      partyGstin: dn.partyGstin || '',
      placeOfSupply: dn.placeOfSupply || '',
      narration: dn.narration || '',
      amount: dn.amount != null ? Number(dn.amount) : 0,
      items: (dn.items || dn.allInventoryEntries || []).map(i => ({
        itemName: i.itemName || '',
        quantity: i.quantity != null ? Number(i.quantity) : 0,
        rate: i.rate != null ? Number(i.rate) : 0,
        amount: i.amount != null ? Number(i.amount) : 0,
        godown: i.godown || ''
      })),
      ledgerEntries: dn.ledgerEntries || []
    }));
  }

  /**
   * Transforms Receipt Notes into REST JSON
   */
  static transformReceiptNotes(notes) {
    return notes.map(rn => ({
      id: rn.id || rn.guid || '',
      receiptNoteNumber: rn.orderNumber || rn.voucherNumber || '',
      date: rn.date || '',
      voucherType: rn.voucherType || 'Receipt Note',
      partyName: rn.partyName || rn.partyLedgerName || '',
      partyGstin: rn.partyGstin || '',
      placeOfSupply: rn.placeOfSupply || '',
      narration: rn.narration || '',
      amount: rn.amount != null ? Number(rn.amount) : 0,
      items: (rn.items || rn.allInventoryEntries || []).map(i => ({
        itemName: i.itemName || '',
        quantity: i.quantity != null ? Number(i.quantity) : 0,
        rate: i.rate != null ? Number(i.rate) : 0,
        amount: i.amount != null ? Number(i.amount) : 0,
        godown: i.godown || ''
      })),
      ledgerEntries: rn.ledgerEntries || []
    }));
  }

  /**
   * Transforms Sales Vouchers into REST JSON
   */
  static transformSales(sales) {
    return sales.map(s => {
      const items = (s.allInventoryEntries || s.items || []).map(item => ({
        itemName: item.itemDescription || item.itemName || '',
        hsn: item.hsn || item.hsnCode || '',
        godown: item.godown || '',
        quantity: item.qty != null ? Number(item.qty) : (item.quantity != null ? Number(item.quantity) : 0),
        rate: item.rate != null ? Number(item.rate) : 0,
        amount: item.taxValue != null ? Number(item.taxValue) : (item.amount != null ? Number(item.amount) : 0)
      }));

      return {
        id: s.voucherKey || s.id || s.guid || '',
        invoice: s.voucherNumber || s.invoice || '',
        voucherNumber: s.voucherNumber || s.invoice || '',
        date: s.invoiceDate || s.date || '',
        customer: s.partyLedgerName || s.customer || '',
        gstin: s.partyGstin || s.gstin || '',
        amount: String(s.totalInvoice != null ? s.totalInvoice : (s.amount || 0)),
        items
      };
    });
  }

  /**
   * Transforms Trial Balance records into REST JSON
   */
  static transformTrialBalance(tbRows) {
    return tbRows.map(row => ({
      id: row.guid || row.id || '',
      name: row.name || row.ledgerName || '',
      parent: row.parent || row.parentGroup || 'Primary',
      openingBalance: row.openingBalance != null ? Number(row.openingBalance) : 0,
      debitTotals: row.debitTotals != null ? Number(row.debitTotals) : 0,
      creditTotals: row.creditTotals != null ? Number(row.creditTotals) : 0,
      closingBalance: row.closingBalance != null ? Number(row.closingBalance) : 0
    }));
  }

  static normalizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    const res = {};
    for (const [k, v] of Object.entries(obj)) {
      const camelKey = k.charAt(0).toLowerCase() + k.slice(1);
      res[camelKey] = typeof v === 'object' ? this.normalizeObject(v) : v;
    }
    return res;
  }
}
