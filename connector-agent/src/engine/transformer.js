import { getSchema, normalizeDatasetKey } from './schemas.js';

/**
 * Data Transformation Engine for Tally Connect
 * 
 * Transforms normalized TallyPrime entity objects into flat rows
 * conforming strictly to the CSV schemas.
 */
export class Transformer {
  /**
   * Main entrypoint: transforms raw/normalized Tally data based on dataset type
   * @param {string} datasetType - canonical entity id or alias
   * @param {Array<Object>} rawData - Raw or normalized records from TallyXmlHttpAdapter
   * @returns {Array<Object>} Flat array of row objects matching schema columns
   */
  static transform(datasetType, rawData) {
    const key = normalizeDatasetKey(datasetType);
    if (!key) {
      throw new Error(`Unsupported dataset type: "${datasetType}"`);
    }

    if (!Array.isArray(rawData)) {
      if (rawData && typeof rawData === 'object') {
        rawData = [rawData];
      } else {
        return [];
      }
    }

    switch (key) {
      case 'ledgers':
        return this.transformLedgers(rawData);
      case 'groups':
        return this.transformGroups(rawData);
      case 'cost_centers':
        return this.transformCostCenters(rawData);
      case 'customers':
        return this.transformCustomers(rawData);
      case 'vendors':
        return this.transformVendors(rawData);
      case 'stock_items':
        return this.transformStockItems(rawData);
      case 'stock_groups':
        return this.transformStockGroups(rawData);
      case 'units':
        return this.transformUnits(rawData);
      case 'godowns':
        return this.transformGodowns(rawData);
      case 'sales_orders':
        return this.transformVouchers(rawData, 'sales_orders');
      case 'purchase_orders':
        return this.transformVouchers(rawData, 'purchase_orders');
      case 'delivery_notes':
        return this.transformVouchers(rawData, 'delivery_notes');
      case 'receipt_notes':
        return this.transformVouchers(rawData, 'receipt_notes');
      case 'trial_balance':
        return this.transformTrialBalance(rawData);
      case 'sales_register':
        return this.transformSalesRegister(rawData);
      default:
        throw new Error(`No transformer implementation found for "${datasetType}"`);
    }
  }

  static transformLedgers(ledgers) {
    return ledgers.map(l => ({
      'Ledger Name': l.name || '',
      'Parent Group': l.parent || '',
      'Opening Balance': l.openingBalance != null ? Number(l.openingBalance).toFixed(2) : '0.00',
      'Closing Balance': l.closingBalance != null ? Number(l.closingBalance).toFixed(2) : '0.00',
      'GST Applicable': l.gstApplicable || '',
      'Cost Centres Enabled': l.isCostCentresOn ? 'Yes' : 'No',
      'Mailing Name': l.mailingName || l.name || '',
      'State': l.state || '',
      'Pincode': l.pincode || '',
      'Country': l.country || '',
      'GSTIN': l.gstin || '',
      'PAN': l.pan || '',
      'Phone': l.phone || '',
      'Email': l.email || '',
      'Description': l.description || ''
    }));
  }

  static transformGroups(groups) {
    return groups.map(g => ({
      'Group Name': g.name || '',
      'Parent Group': g.parent || '',
      'Is Addable': g.isAddable ? 'Yes' : 'No',
      'Is Sub Ledger': g.isSubLedger ? 'Yes' : 'No',
      'Is Calculate': g.isCalculate ? 'Yes' : 'No'
    }));
  }

  static transformCostCenters(costCenters) {
    return costCenters.map(cc => ({
      'Cost Center Name': cc.name || '',
      'Parent': cc.parent || '',
      'Category': cc.category || ''
    }));
  }

  static transformCustomers(customers) {
    return customers.map(c => {
      let streetAddress = '';
      if (Array.isArray(c.mailingDetails?.addressLines)) {
        streetAddress = c.mailingDetails.addressLines.filter(Boolean).join(', ');
      } else if (c.address) {
        streetAddress = String(c.address);
      }

      return {
        'Customer Name': c.name || '',
        'Parent Group': c.parent || '',
        'GSTIN': c.statutory?.gstin || c.gstin || '',
        'PAN': c.statutory?.pan || c.pan || '',
        'Contact Person': c.contact?.name || '',
        'Email': c.contact?.email || c.email || '',
        'Phone': c.contact?.phone || c.phone || '',
        'Address': streetAddress,
        'State': c.mailingDetails?.state || c.state || '',
        'Pincode': c.mailingDetails?.postalCode || c.pincode || '',
        'Country': c.mailingDetails?.country || c.country || '',
        'Credit Days': c.creditPolicy?.creditDays != null ? String(c.creditPolicy.creditDays) : '',
        'Credit Limit': c.creditPolicy?.creditLimit != null ? Number(c.creditPolicy.creditLimit).toFixed(2) : '',
        'Bank Name': c.banking?.bankName || '',
        'Account Number': c.banking?.accountNumber || '',
        'IFSC Code': c.banking?.ifscCode || '',
        'Opening Balance': c.openingBalance != null ? Number(c.openingBalance).toFixed(2) : '0.00',
        'Closing Balance': c.closingBalance != null ? Number(c.closingBalance).toFixed(2) : '0.00'
      };
    });
  }

  static transformVendors(vendors) {
    return vendors.map(v => {
      let streetAddress = '';
      if (Array.isArray(v.mailingDetails?.addressLines)) {
        streetAddress = v.mailingDetails.addressLines.filter(Boolean).join(', ');
      } else if (v.address) {
        streetAddress = String(v.address);
      }

      return {
        'Vendor Name': v.name || '',
        'Parent Group': v.parent || '',
        'GSTIN': v.statutory?.gstin || v.gstin || '',
        'PAN': v.statutory?.pan || v.pan || '',
        'Contact Person': v.contact?.name || '',
        'Email': v.contact?.email || v.email || '',
        'Phone': v.contact?.phone || v.phone || '',
        'Address': streetAddress,
        'State': v.mailingDetails?.state || v.state || '',
        'Pincode': v.mailingDetails?.postalCode || v.pincode || '',
        'Country': v.mailingDetails?.country || v.country || '',
        'Credit Days': v.creditPolicy?.creditDays != null ? String(v.creditPolicy.creditDays) : '',
        'Credit Limit': v.creditPolicy?.creditLimit != null ? Number(v.creditPolicy.creditLimit).toFixed(2) : '',
        'Bank Name': v.banking?.bankName || '',
        'Account Number': v.banking?.accountNumber || '',
        'IFSC Code': v.banking?.ifscCode || '',
        'Opening Balance': v.openingBalance != null ? Number(v.openingBalance).toFixed(2) : '0.00',
        'Closing Balance': v.closingBalance != null ? Number(v.closingBalance).toFixed(2) : '0.00'
      };
    });
  }

  static transformStockItems(items) {
    return items.map(s => ({
      'Item Name': s.name || '',
      'Stock Group': s.parent || '',
      'Unit of Measure': s.uom || '',
      'HSN Code': s.hsnCode || '',
      'Opening Quantity': s.openingQuantity != null ? String(s.openingQuantity) : '0',
      'Opening Rate': s.openingRate != null ? Number(s.openingRate).toFixed(2) : '0.00',
      'Opening Value': s.openingValue != null ? Number(s.openingValue).toFixed(2) : '0.00',
      'Closing Quantity': s.closingQuantity != null ? String(s.closingQuantity) : '0',
      'Closing Rate': s.closingRate != null ? Number(s.closingRate).toFixed(2) : '0.00',
      'Closing Value': s.closingValue != null ? Number(s.closingValue).toFixed(2) : '0.00',
      'GST Applicable': s.gstApplicable || '',
      'GST Rate': s.gstRate != null ? String(s.gstRate) : '',
      'Description': s.description || ''
    }));
  }

  static transformStockGroups(groups) {
    return groups.map(sg => ({
      'Stock Group Name': sg.name || '',
      'Parent': sg.parent || '',
      'Is Addable': sg.isAddable ? 'Yes' : 'No'
    }));
  }

  static transformUnits(units) {
    return units.map(u => ({
      'Unit Name': u.name || '',
      'Original Name': u.originalName || '',
      'Decimal Places': u.decimalPlaces != null ? String(u.decimalPlaces) : '0',
      'GST Excluded': u.isGstExcluded ? 'Yes' : 'No'
    }));
  }

  static transformGodowns(godowns) {
    return godowns.map(g => ({
      'Godown Name': g.name || '',
      'Parent': g.parent || '',
      'Address': g.address || '',
      'Pincode': g.pincode || ''
    }));
  }

  static transformVouchers(vouchers, voucherKind) {
    const flatRows = [];
    const isVendor = voucherKind === 'purchase_orders' || voucherKind === 'receipt_notes';
    const partyColName = isVendor ? 'Vendor Name' : 'Customer Name';
    const totalColName = voucherKind.includes('order') ? 'Order Total' : 'Note Total';
    const numColName = voucherKind.includes('order') ? 'Order Number' : 'Note Number';
    const dateColName = voucherKind.includes('order') ? 'Order Date' : 'Date';

    for (const v of vouchers) {
      const items = (v.items || v.allInventoryEntries || []);
      const totalAmount = v.amount != null ? Number(v.amount).toFixed(2) : '0.00';
      const number = v.voucherNumber || v.orderNumber || '';
      const date = v.date || '';
      const dueDate = v.dueDate || date;
      const party = v.partyName || v.partyLedgerName || '';
      const gstin = v.partyGstin || '';
      const pos = v.placeOfSupply || '';
      const narration = v.narration || '';

      if (items.length > 0) {
        for (const item of items) {
          const row = {
            [numColName]: number,
            [dateColName]: date
          };
          if (voucherKind.includes('order')) {
            row['Due Date'] = dueDate;
          }
          row[partyColName] = party;
          row['GSTIN'] = gstin;
          row['Place of Supply'] = pos;
          row['Item Name'] = item.itemName || '';
          row['Quantity'] = item.quantity != null ? String(item.quantity) : '0';
          row['Rate'] = item.rate != null ? Number(item.rate).toFixed(2) : '0.00';
          row['Amount'] = item.amount != null ? Number(item.amount).toFixed(2) : '0.00';
          row['Godown'] = item.godown || '';
          row[totalColName] = totalAmount;
          row['Narration'] = narration;
          flatRows.push(row);
        }
      } else {
        const row = {
          [numColName]: number,
          [dateColName]: date
        };
        if (voucherKind.includes('order')) {
          row['Due Date'] = dueDate;
        }
        row[partyColName] = party;
        row['GSTIN'] = gstin;
        row['Place of Supply'] = pos;
        row['Item Name'] = '';
        row['Quantity'] = '0';
        row['Rate'] = '0.00';
        row['Amount'] = totalAmount;
        row['Godown'] = '';
        row[totalColName] = totalAmount;
        row['Narration'] = narration;
        flatRows.push(row);
      }
    }
    return flatRows;
  }

  static transformTrialBalance(balances) {
    return balances.map(tb => {
      const opening = Number(tb.openingBalance || tb.opening || 0);
      const debit = Number(tb.debitTotals || tb.debit || 0);
      const credit = Number(tb.creditTotals || tb.credit || 0);
      const closing = Number(tb.closingBalance || tb.closing || 0);

      const openingDebit = tb.openingDebit != null
        ? Number(tb.openingDebit)
        : (opening > 0 ? opening : 0);
      const openingCredit = tb.openingCredit != null
        ? Number(tb.openingCredit)
        : (opening < 0 ? Math.abs(opening) : 0);

      const closingDebit = tb.closingDebit != null
        ? Number(tb.closingDebit)
        : (closing > 0 ? closing : 0);
      const closingCredit = tb.closingCredit != null
        ? Number(tb.closingCredit)
        : (closing < 0 ? Math.abs(closing) : 0);

      return {
        'Ledger Name': tb.name || tb.ledgerName || '',
        'Group': tb.parent || tb.group || '',
        'Opening Debit': openingDebit.toFixed(2),
        'Opening Credit': openingCredit.toFixed(2),
        'Debit': debit.toFixed(2),
        'Credit': credit.toFixed(2),
        'Closing Debit': closingDebit.toFixed(2),
        'Closing Credit': closingCredit.toFixed(2)
      };
    });
  }

  static transformSalesRegister(vouchers) {
    const flatRows = [];

    for (const v of vouchers) {
      const items = (v.allInventoryEntries || v.items || []);
      const totalInvoice = v.totalInvoice != null
        ? Number(v.totalInvoice).toFixed(2)
        : (v.amount != null ? Number(v.amount).toFixed(2) : '0.00');

      const invoiceNum = v.voucherNumber || v.invoice || '';
      const invoiceDate = v.date || v.invoiceDate || '';
      const customer = v.partyLedgerName || v.customer || v.partyName || '';
      const gstin = v.partyGstin || v.gstin || '';
      const pos = v.placeOfSupply || '';
      const narration = v.narration || '';

      if (items.length > 0) {
        for (const item of items) {
          flatRows.push({
            'Invoice Number': invoiceNum,
            'Invoice Date': invoiceDate,
            'Customer Name': customer,
            'GSTIN': gstin,
            'Place of Supply': pos,
            'Item Name': item.itemName || item.itemDescription || '',
            'Quantity': item.quantity != null ? String(item.quantity) : (item.qty != null ? String(item.qty) : '0'),
            'Rate': item.rate != null ? Number(item.rate).toFixed(2) : '0.00',
            'Amount': item.amount != null ? Number(item.amount).toFixed(2) : '0.00',
            'Godown': item.godown || '',
            'Total Invoice': totalInvoice,
            'Narration': narration
          });
        }
      } else {
        flatRows.push({
          'Invoice Number': invoiceNum,
          'Invoice Date': invoiceDate,
          'Customer Name': customer,
          'GSTIN': gstin,
          'Place of Supply': pos,
          'Item Name': 'Service Sales',
          'Quantity': '1',
          'Rate': totalInvoice,
          'Amount': totalInvoice,
          'Godown': '',
          'Total Invoice': totalInvoice,
          'Narration': narration
        });
      }
    }

    return flatRows;
  }
}
