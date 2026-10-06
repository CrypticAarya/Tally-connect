import { getSchema, normalizeDatasetKey, getDefaultExportProfile } from './schemas.js';
import {
  toCanonical,
  CanonicalCustomer,
  CanonicalVendor,
  CanonicalLedger,
  CanonicalTrialBalance,
  CanonicalSalesTransaction,
  CanonicalPurchaseTransaction,
  CanonicalItem,
  CanonicalCostCenter,
  CanonicalGodown,
  CanonicalGroup,
  CanonicalUnit,
  CanonicalOrder,
  CanonicalNote,
  sanitizeString,
  sanitizeAmount
} from './canonicalModels.js';

/**
 * Data Transformation Engine for Tally Connect
 * 
 * Transforms raw/normalized Tally records into Canonical Models,
 * and flattens them into standardized rows conforming strictly to schemas.
 */
export class Transformer {
  /**
   * Main entrypoint: transforms raw Tally data based on dataset type and profile
   * @param {string} datasetType - canonical entity id or alias
   * @param {Array<Object>} rawData - Raw or normalized records from TallyXmlHttpAdapter
   * @param {Object} [options={}] - Options such as { profile: 'canonical'|'authoritative' }
   * @returns {Array<Object>} Flat array of row objects matching schema columns
   */
  static transform(datasetType, rawData, options = {}) {
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

    const profile = options.profile || getDefaultExportProfile();

    switch (key) {
      case 'ledgers':
      case 'chart_of_accounts':
        return this.transformLedgers(rawData, profile);
      case 'groups':
        return this.transformGroups(rawData, profile);
      case 'cost_centers':
        return this.transformCostCenters(rawData, profile);
      case 'customers':
        return this.transformCustomers(rawData, profile);
      case 'vendors':
        return this.transformVendors(rawData, profile);
      case 'stock_items':
      case 'items':
        return this.transformStockItems(rawData, profile);
      case 'inventory':
        return this.transformInventoryPolicies(rawData, profile);
      case 'stock_groups':
        return this.transformStockGroups(rawData, profile);
      case 'units':
        return this.transformUnits(rawData, profile);
      case 'godowns':
        return this.transformGodowns(rawData, profile);
      case 'sales_orders':
        return this.transformVouchers(rawData, 'sales_orders', profile);
      case 'purchase_orders':
        return this.transformVouchers(rawData, 'purchase_orders', profile);
      case 'delivery_notes':
        return this.transformVouchers(rawData, 'delivery_notes', profile);
      case 'receipt_notes':
        return this.transformVouchers(rawData, 'receipt_notes', profile);
      case 'trial_balance':
        return this.transformTrialBalance(rawData, profile);
      case 'sales_register':
        return this.transformSalesRegister(rawData, profile);
      case 'purchase_register':
        return this.transformPurchaseRegister(rawData, profile);
      case 'inventory_master':
      case 'inventorymaster':
      case 'stock_movement':
        return this.transformInventoryMaster(rawData, profile);
      case 'branch':
      case 'branches':
        return this.transformBranch(rawData, profile);
      case 'sales_representative':
      case 'sales_representatives':
        return this.transformSalesRepresentative(rawData, profile);
      default:
        throw new Error(`No transformer implementation found for "${datasetType}"`);
    }
  }

  // ==========================================================================
  // 1. TRIAL BALANCE
  // ==========================================================================
  static transformTrialBalance(balances, profile = 'canonical') {
    return balances.map(raw => {
      const tb = raw instanceof CanonicalTrialBalance ? raw : new CanonicalTrialBalance(raw);

      return {
        // Canonical fields
        'Ledger Name': tb.name || '',
        'Group': tb.parent || '',
        'Opening Debit': tb.openingDebit.toFixed(2),
        'Opening Credit': tb.openingCredit.toFixed(2),
        'Debit': tb.debit.toFixed(2),
        'Credit': tb.credit.toFixed(2),
        'Closing Debit': tb.closingDebit.toFixed(2),
        'Closing Credit': tb.closingCredit.toFixed(2),

        // Authoritative sample fields (SampleTrialBalances.csv)
        'Month/Year': tb.monthYear || '',
        'Branch': tb.branch || '',
        'Particulars': tb.particulars || tb.parent || '',
        'Name': tb.name || '',
        'Opening': tb.openingBalance.toFixed(2),
        'Closing': tb.closingBalance.toFixed(2),
        'Dr/Cr': tb.drCr || ''
      };
    });
  }

  // ==========================================================================
  // 2. LEDGERS & CHART OF ACCOUNTS
  // ==========================================================================
  static transformLedgers(ledgers, profile = 'canonical') {
    return ledgers.map(raw => {
      const l = raw instanceof CanonicalLedger ? raw : new CanonicalLedger(raw);

      return {
        // Canonical fields
        'Ledger Name': l.name || '',
        'Parent Group': l.parent || '',
        'Opening Balance': l.openingBalance.toFixed(2),
        'Closing Balance': l.closingBalance.toFixed(2),
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
        'Description': l.description || '',

        // Authoritative sample fields (SampleChartAccounts.csv)
        'Account Code': l.code || '',
        'GL Name': l.name || '',
        'Ledger Description': l.description || '',
        'Parent': l.parent || '',
        'Grouping': l.grouping || l.parent || '',
        'Grouping for Financial Summary': '',
        'Branch': '',
        'Cost Center': l.isCostCentresOn ? 'Yes' : 'No',
        'Cost Classification': '',
        'Cost Behaviour Description': '',
        'SV Variable %': '',
        'Inter-branch': '',
        'Related Party': '',
        'TDS Applicable': '',
        'Active': l.active ? 'Yes' : 'No',
        'Remarks': l.remarks || ''
      };
    });
  }

  // ==========================================================================
  // 3. CUSTOMER MASTER
  // ==========================================================================
  static transformCustomers(customers, profile = 'canonical') {
    return customers.map(raw => {
      const c = raw instanceof CanonicalCustomer ? raw : new CanonicalCustomer(raw);

      return {
        // Canonical fields
        'Customer Name': c.name || '',
        'Parent Group': c.parent || '',
        'GSTIN': c.gstin || '',
        'PAN': c.pan || '',
        'Contact Person': c.contactName || '',
        'Email': c.contactEmail || '',
        'Phone': c.contactPhone || '',
        'Address': c.address || '',
        'State': c.state || '',
        'Pincode': c.pincode || '',
        'Country': c.country || '',
        'Credit Days': c.creditDays != null && c.creditDays !== '' ? String(c.creditDays) : '',
        'Credit Limit': c.creditLimit != null && c.creditLimit !== '' ? Number(c.creditLimit).toFixed(2) : '',
        'Bank Name': c.bankName || '',
        'Account Number': c.accountNumber || '',
        'IFSC Code': c.ifscCode || '',
        'Opening Balance': c.openingBalance.toFixed(2),
        'Closing Balance': c.closingBalance.toFixed(2),

        // Authoritative sample fields (SampleCustomer.csv)
        'Customer Code': c.code || '',
        'Customer Type': c.customerType || '',
        'Account Status': c.accountStatus || 'Active',
        'Primary Contact Name': c.contactName || '',
        'Primary Contact Email': c.contactEmail || '',
        'Primary Contact Phone': c.contactPhone || '',
        'Street Address': c.address || '',
        'City': c.city || '',
        'State/Province': c.state || '',
        'Postal/ZIP Code': c.pincode || '',
        'GST Reg Type': c.gstRegType || '',
        'Pan': c.pan || '',
        'Payment Terms': c.paymentTerms || '',
        'Currency': c.currency || 'INR',
        'Branch ID/Name': c.branch || '',
        'Sales Representative': c.salesRepresentative || '',
        'GST Number': c.gstin || '',
        'GST State Code': c.gstStateCode || '',
        'GST State Name': c.gstStateName || '',
        'MainDistributor': '',
        'MainDealer': '',
        'MainAgent': '',
        'SubDistributor': '',
        'SubDealer': '',
        'SubAgent': '',
        'AccPartyBankName': c.bankName || '',
        'AccPartyBankIFSCCode': c.ifscCode || '',
        'AccPartyBankActNo': c.accountNumber || '',
        'AccStartDate': '',
        'AccEndDate': '',
        'Active': c.active ? 'Yes' : 'No',
        'Remarks': c.remarks || ''
      };
    });
  }

  // ==========================================================================
  // 4. VENDOR MASTER
  // ==========================================================================
  static transformVendors(vendors, profile = 'canonical') {
    return vendors.map(raw => {
      const v = raw instanceof CanonicalVendor ? raw : new CanonicalVendor(raw);

      return {
        // Canonical fields
        'Vendor Name': v.name || '',
        'Parent Group': v.parent || '',
        'GSTIN': v.gstin || '',
        'PAN': v.pan || '',
        'Contact Person': v.contactName || '',
        'Email': v.contactEmail || '',
        'Phone': v.contactPhone || '',
        'Address': v.address || '',
        'State': v.state || '',
        'Pincode': v.pincode || '',
        'Country': v.country || '',
        'Credit Days': v.paymentTerms || '',
        'Credit Limit': v.creditLimit != null && v.creditLimit !== '' ? Number(v.creditLimit).toFixed(2) : '',
        'Bank Name': v.bankName || '',
        'Account Number': v.accountNumber || '',
        'IFSC Code': v.ifscCode || '',
        'Opening Balance': v.openingBalance.toFixed(2),
        'Closing Balance': v.closingBalance.toFixed(2),

        // Authoritative sample fields (SampleVendor.csv)
        'Vendor Code': v.code || '',
        'Vendor Type': v.vendorType || '',
        'Vendor Status': v.status || 'Active',
        'Primary Contact Name': v.contactName || '',
        'Primary Contact Email': v.contactEmail || '',
        'Primary Contact Phone': v.contactPhone || '',
        'Street Address': v.address || '',
        'City': v.city || '',
        'State/Province': v.state || '',
        'Postal/ZIP Code': v.pincode || '',
        'Payment Terms': v.paymentTerms || '',
        'Currency': v.currency || 'INR',
        'GST Number': v.gstin || '',
        'GST State Code': v.gstStateCode || '',
        'GST State Name': v.gstStateName || '',
        'MainDistributor': '',
        'MainDealer': '',
        'MainAgent': '',
        'SubDistributor': '',
        'SubDealer': '',
        'SubAgent': '',
        'AccPartyBankName': v.bankName || '',
        'AccPartyBankIFSCCode': v.ifscCode || '',
        'AccPartyBankActNo': v.accountNumber || '',
        'AccStartDate': '',
        'AccEndDate': '',
        'Nature of vendor': v.natureOfVendor || v.parent || '',
        'TDS Category': v.tdsCategory || '',
        'TDS Section': v.tdsSection || '',
        'PAN Number': v.pan || ''
      };
    });
  }

  // ==========================================================================
  // 5. SALES REGISTER (32 cols / 12 cols line-item expansion)
  // ==========================================================================
  static transformSalesRegister(vouchers, profile = 'canonical') {
    const flatRows = [];

    for (const raw of vouchers) {
      const v = raw instanceof CanonicalSalesTransaction ? raw : new CanonicalSalesTransaction(raw);
      const totalInvoiceStr = v.totalInvoice.toFixed(2);
      const otherChargesStr = v.otherCharges.toFixed(2);

      if (v.items && v.items.length > 0) {
        for (const item of v.items) {
          flatRows.push({
            // Canonical fields
            'Invoice Number': v.voucherNumber,
            'Invoice Date': v.date,
            'Customer Name': v.customerName,
            'GSTIN': v.gstin,
            'Place of Supply': v.placeOfSupply,
            'Item Name': item.itemName,
            'Quantity': String(item.quantity),
            'Rate': item.rate.toFixed(2),
            'Amount': item.amount.toFixed(2),
            'Godown': item.godown || '',
            'Total Invoice': totalInvoiceStr,
            'Narration': v.narration,

            // Authoritative sample fields (SampleSalesRegister.csv)
            'Code': v.voucherId || '',
            'Sales Date': v.date || '',
            'Invoice No': v.voucherNumber || '',
            'Customer Name/Code': v.customerName || '',
            'Customer Type': v.customerType || '',
            'Sales Type': v.salesType || 'Sales',
            'Branch Name/Code': v.branch || '',
            'Cost Center Name/Code': v.costCenter || '',
            'Godown Name/Code': item.godown || '',
            'Item Description': item.itemDescription || item.itemName || '',
            'HSN': item.hsn || '',
            'Qty': String(item.quantity),
            'Discount': item.discount.toFixed(2),
            'Tax Value': item.taxValue.toFixed(2),
            'CGST': item.cgstRate || '',
            'CGST Amount': item.cgstAmount.toFixed(2),
            'SGST': item.sgstRate || '',
            'SGST Amount': item.sgstAmount.toFixed(2),
            'IGST': item.igstRate || '',
            'IGST Amount': item.igstAmount.toFixed(2),
            'Other Charges (₹)': otherChargesStr,
            'Place of Supply (State)': v.placeOfSupply || '',
            'Payment Terms': v.paymentTerms || '',
            'Due Date': v.dueDate || '',
            'Payment Status': '',
            'Payment Date': '',
            'Mode Of Payment': v.modeOfPayment || '',
            'Remarks': v.narration || ''
          });
        }
      } else {
        // Service invoice without inventory lines
        flatRows.push({
          'Invoice Number': v.voucherNumber,
          'Invoice Date': v.date,
          'Customer Name': v.customerName,
          'GSTIN': v.gstin,
          'Place of Supply': v.placeOfSupply,
          'Item Name': 'Service Sales',
          'Quantity': '1',
          'Rate': totalInvoiceStr,
          'Amount': totalInvoiceStr,
          'Godown': '',
          'Total Invoice': totalInvoiceStr,
          'Narration': v.narration,

          'Code': v.voucherId || '',
          'Sales Date': v.date || '',
          'Invoice No': v.voucherNumber || '',
          'Customer Name/Code': v.customerName || '',
          'Customer Type': v.customerType || '',
          'Sales Type': v.salesType || 'Sales',
          'Branch Name/Code': v.branch || '',
          'Cost Center Name/Code': v.costCenter || '',
          'Godown Name/Code': '',
          'Item Description': v.narration || 'Service Sales',
          'HSN': '',
          'Qty': '1',
          'Discount': '0.00',
          'Tax Value': totalInvoiceStr,
          'CGST': '',
          'CGST Amount': '0.00',
          'SGST': '',
          'SGST Amount': '0.00',
          'IGST': '',
          'IGST Amount': '0.00',
          'Other Charges (₹)': otherChargesStr,
          'Place of Supply (State)': v.placeOfSupply || '',
          'Payment Terms': v.paymentTerms || '',
          'Due Date': v.dueDate || '',
          'Payment Status': '',
          'Payment Date': '',
          'Mode Of Payment': v.modeOfPayment || '',
          'Remarks': v.narration || ''
        });
      }
    }

    return flatRows;
  }

  // ==========================================================================
  // 6. PURCHASE REGISTER (32 cols / 12 cols line-item expansion)
  // ==========================================================================
  static transformPurchaseRegister(vouchers, profile = 'canonical') {
    const flatRows = [];

    for (const raw of vouchers) {
      const v = raw instanceof CanonicalPurchaseTransaction ? raw : new CanonicalPurchaseTransaction(raw);
      const totalInvoiceStr = v.totalInvoice.toFixed(2);

      if (v.items && v.items.length > 0) {
        for (const item of v.items) {
          flatRows.push({
            // Canonical fields
            'Invoice Number': v.voucherNumber,
            'Invoice Date': v.date,
            'Vendor Name': v.vendorName,
            'GSTIN': v.gstin,
            'Place of Supply': v.placeOfSupply,
            'Item Name': item.itemName,
            'Quantity': String(item.quantity),
            'Rate': item.rate.toFixed(2),
            'Amount': item.amount.toFixed(2),
            'Godown': item.godown || '',
            'Total Invoice': totalInvoiceStr,
            'Narration': v.narration,

            // Authoritative sample fields (SamplePurchaseRegister.csv)
            'Code': v.voucherId || '',
            'Purchase Date': v.date || '',
            'Invoice No': v.voucherNumber || '',
            'Vendor Name/Code': v.vendorName || '',
            'Vendor Type': v.vendorType || '',
            'Purchase Type': v.purchaseType || 'Purchase',
            'Branch Name/Code': v.branch || '',
            'Cost Center Name/Code': v.costCenter || '',
            'Item Description': item.itemDescription || item.itemName || '',
            'HSN': item.hsn || '',
            'Qty': String(item.quantity),
            'Discount': item.discount.toFixed(2),
            'Tax Value': item.taxValue.toFixed(2),
            'CGST': item.cgstRate || '',
            'CGST Amount': item.cgstAmount.toFixed(2),
            'SGST': item.sgstRate || '',
            'SGST Amount': item.sgstAmount.toFixed(2),
            'IGST': item.igstRate || '',
            'IGST Amount': item.igstAmount.toFixed(2),
            'GRN No': v.grnNo || '',
            'PO Reference No': v.poReferenceNo || '',
            'Payment Terms': v.paymentTerms || '',
            'Due Date': v.dueDate || '',
            'Payment Status': '',
            'Payment Date': '',
            'Mode Of Payment': v.modeOfPayment || '',
            'Payment Voucher Ref': '',
            'Remarks': v.narration || ''
          });
        }
      } else {
        flatRows.push({
          'Invoice Number': v.voucherNumber,
          'Invoice Date': v.date,
          'Vendor Name': v.vendorName,
          'GSTIN': v.gstin,
          'Place of Supply': v.placeOfSupply,
          'Item Name': 'Service Purchase',
          'Quantity': '1',
          'Rate': totalInvoiceStr,
          'Amount': totalInvoiceStr,
          'Godown': '',
          'Total Invoice': totalInvoiceStr,
          'Narration': v.narration,

          'Code': v.voucherId || '',
          'Purchase Date': v.date || '',
          'Invoice No': v.voucherNumber || '',
          'Vendor Name/Code': v.vendorName || '',
          'Vendor Type': v.vendorType || '',
          'Purchase Type': v.purchaseType || 'Purchase',
          'Branch Name/Code': v.branch || '',
          'Cost Center Name/Code': v.costCenter || '',
          'Item Description': v.narration || 'Service Purchase',
          'HSN': '',
          'Qty': '1',
          'Discount': '0.00',
          'Tax Value': totalInvoiceStr,
          'CGST': '',
          'CGST Amount': '0.00',
          'SGST': '',
          'SGST Amount': '0.00',
          'IGST': '',
          'IGST Amount': '0.00',
          'GRN No': v.grnNo || '',
          'PO Reference No': v.poReferenceNo || '',
          'Payment Terms': v.paymentTerms || '',
          'Due Date': v.dueDate || '',
          'Payment Status': '',
          'Payment Date': '',
          'Mode Of Payment': v.modeOfPayment || '',
          'Payment Voucher Ref': '',
          'Remarks': v.narration || ''
        });
      }
    }

    return flatRows;
  }

  // ==========================================================================
  // 7. STOCK ITEMS & ITEM MASTER
  // ==========================================================================
  static transformStockItems(items, profile = 'canonical') {
    return items.map(raw => {
      const it = raw instanceof CanonicalItem ? raw : new CanonicalItem(raw);

      return {
        // Canonical fields
        'Item Name': it.name || '',
        'Stock Group': it.parent || '',
        'Unit of Measure': it.uom || '',
        'HSN Code': it.hsn || '',
        'Opening Quantity': String(it.openingQuantity),
        'Opening Rate': it.openingRate.toFixed(2),
        'Opening Value': it.openingValue.toFixed(2),
        'Closing Quantity': String(it.closingQuantity),
        'Closing Rate': it.closingRate.toFixed(2),
        'Closing Value': it.closingValue.toFixed(2),
        'GST Applicable': it.gstApplicable || '',
        'GST Rate': it.gstRate > 0 ? String(it.gstRate) : '',
        'Description': it.description || '',

        // Authoritative sample fields (SampleItemMaster.csv)
        'Item/SKU ID': it.code || it.guid || it.name || '',
        'Item Name/Description': it.name || '',
        'Month/Year': '',
        'Item Category/Type': it.parent || '',
        'Item Sub-category': it.category || '',
        'HSN': it.hsn || '',
        'Brand': '',
        'Manufacturer/Vendor Name': '',
        'GST Rate %': it.gstRate > 0 ? String(it.gstRate) : '',
        'Costing Method': it.costingMethod || '',
        'Standard Cost per Unit': it.standardCost > 0 ? it.standardCost.toFixed(2) : '',
        'MRP': it.mrp > 0 ? it.mrp.toFixed(2) : '',
        'Standard Selling Price': it.standardPrice > 0 ? it.standardPrice.toFixed(2) : '',
        'Reorder Level (Qty)': it.reorderLevel > 0 ? String(it.reorderLevel) : '',
        'Min Stock Qty': it.minStockQty > 0 ? String(it.minStockQty) : '',
        'Max Stock Qty': it.maxStockQty > 0 ? String(it.maxStockQty) : '',
        'Opening Stock Qty': String(it.openingQuantity),
        'Opening Stock Rate': it.openingRate.toFixed(2),
        'Opening Stock Value': it.openingValue.toFixed(2),
        'Economic Order Quantity (EOQ)': '',
        'Safety Stock Level': '',
        'Lead Time': '',
        'Markup Percentage': '',
        'Profit Margin': '',
        'Status': it.status || 'Active'
      };
    });
  }

  // ==========================================================================
  // 8. INVENTORY POLICIES (SampleInventory.csv)
  // ==========================================================================
  static transformInventoryPolicies(items, profile = 'canonical') {
    return items.map(raw => {
      const it = raw instanceof CanonicalItem ? raw : new CanonicalItem(raw);

      return {
        'Item/SKU ID': it.code || it.guid || it.name || '',
        'Item Name/Description': it.name || '',
        'Item Category/Type': it.parent || '',
        'Item Sub-category': it.category || '',
        'HSN': it.hsn || '',
        'Brand': '',
        'Manufacturer/Vendor Name': '',
        'Unit of Measure': it.uom || '',
        'Reorder Point': it.reorderLevel > 0 ? String(it.reorderLevel) : '',
        'Economic Order Quantity': '',
        'Minimum Order Quantity': it.minStockQty > 0 ? String(it.minStockQty) : '',
        'Maximum Stock Level': it.maxStockQty > 0 ? String(it.maxStockQty) : '',
        'Safety Stock Level': '',
        'Lead Time': '',
        'Markup Percentage': '',
        'Profit Margin': '',
        'Status': it.status || 'Active'
      };
    });
  }

  // ==========================================================================
  // 9. COST CENTERS
  // ==========================================================================
  static transformCostCenters(costCenters, profile = 'canonical') {
    return costCenters.map(raw => {
      const cc = raw instanceof CanonicalCostCenter ? raw : new CanonicalCostCenter(raw);

      return {
        // Canonical fields
        'Cost Center Name': cc.name || '',
        'Parent': cc.parent || '',
        'Category': cc.category || '',

        // Authoritative sample fields (SampleCostCenter.csv)
        'Code': cc.code || cc.guid || cc.name || '',
        'Name': cc.name || '',
        'Branch Code/Name': cc.branch || ''
      };
    });
  }

  // ==========================================================================
  // 10. GODOWNS
  // ==========================================================================
  static transformGodowns(godowns, profile = 'canonical') {
    return godowns.map(raw => {
      const g = raw instanceof CanonicalGodown ? raw : new CanonicalGodown(raw);

      return {
        // Canonical fields
        'Godown Name': g.name || '',
        'Parent': g.parent || '',
        'Address': g.address || '',
        'Pincode': g.pincode || '',

        // Authoritative sample fields (Samplegodown.csv)
        'Code': g.code || g.guid || g.name || '',
        'Name': g.name || '',
        'Branch Code/Name': g.parent || '',
        'Active': g.active ? 'Yes' : 'No'
      };
    });
  }

  // ==========================================================================
  // 11. GROUPS & UNITS & STOCK GROUPS
  // ==========================================================================
  static transformGroups(groups) {
    return groups.map(raw => {
      const g = raw instanceof CanonicalGroup ? raw : new CanonicalGroup(raw);
      return {
        'Group Name': g.name || '',
        'Parent Group': g.parent || '',
        'Is Addable': g.isAddable ? 'Yes' : 'No',
        'Is Sub Ledger': g.isSubLedger ? 'Yes' : 'No',
        'Is Calculate': g.isCalculate ? 'Yes' : 'No'
      };
    });
  }

  static transformStockGroups(groups) {
    return groups.map(raw => {
      const sg = raw instanceof CanonicalGroup ? raw : new CanonicalGroup(raw);
      return {
        'Stock Group Name': sg.name || '',
        'Parent': sg.parent || '',
        'Is Addable': sg.isAddable ? 'Yes' : 'No'
      };
    });
  }

  static transformUnits(units) {
    return units.map(raw => {
      const u = raw instanceof CanonicalUnit ? raw : new CanonicalUnit(raw);
      return {
        'Unit Name': u.name || '',
        'Original Name': u.originalName || '',
        'Decimal Places': String(u.decimalPlaces),
        'GST Excluded': u.isGstExcluded ? 'Yes' : 'No'
      };
    });
  }

  // ==========================================================================
  // 12. VOUCHERS (ORDERS & NOTES)
  // ==========================================================================
  static transformVouchers(vouchers, voucherKind) {
    const flatRows = [];
    const isVendor = voucherKind === 'purchase_orders' || voucherKind === 'receipt_notes';
    const partyColName = isVendor ? 'Vendor Name' : 'Customer Name';
    const totalColName = voucherKind.includes('order') ? 'Order Total' : 'Note Total';
    const numColName = voucherKind.includes('order') ? 'Order Number' : 'Note Number';
    const dateColName = voucherKind.includes('order') ? 'Order Date' : 'Date';

    for (const raw of vouchers) {
      const v = voucherKind.includes('order')
        ? (raw instanceof CanonicalOrder ? raw : new CanonicalOrder(raw, voucherKind))
        : (raw instanceof CanonicalNote ? raw : new CanonicalNote(raw, voucherKind));

      const totalStr = v.total.toFixed(2);
      const items = v.items || [];

      if (items.length > 0) {
        for (const item of items) {
          const row = {
            [numColName]: v.orderNumber || v.noteNumber || '',
            [dateColName]: v.date || ''
          };
          if (voucherKind.includes('order')) {
            row['Due Date'] = v.dueDate || v.date || '';
          }
          row[partyColName] = v.partyName || '';
          row['GSTIN'] = v.gstin || '';
          row['Place of Supply'] = v.placeOfSupply || '';
          row['Item Name'] = item.itemName || '';
          row['Quantity'] = String(item.quantity);
          row['Rate'] = item.rate.toFixed(2);
          row['Amount'] = item.amount.toFixed(2);
          row['Godown'] = item.godown || '';
          row[totalColName] = totalStr;
          row['Narration'] = v.narration || '';
          flatRows.push(row);
        }
      } else {
        const row = {
          [numColName]: v.orderNumber || v.noteNumber || '',
          [dateColName]: v.date || ''
        };
        if (voucherKind.includes('order')) {
          row['Due Date'] = v.dueDate || v.date || '';
        }
        row[partyColName] = v.partyName || '';
        row['GSTIN'] = v.gstin || '';
        row['Place of Supply'] = v.placeOfSupply || '';
        row['Item Name'] = '';
        row['Quantity'] = '0';
        row['Rate'] = '0.00';
        row['Amount'] = totalStr;
        row['Godown'] = '';
        row[totalColName] = totalStr;
        row['Narration'] = v.narration || '';
        flatRows.push(row);
      }
    }
    return flatRows;
  }

  // ==========================================================================
  // 14. INVENTORY MASTER / STOCK MOVEMENT (20 columns)
  // ==========================================================================
  static transformInventoryMaster(vouchers, profile = 'canonical') {
    const flatRows = [];

    for (const raw of vouchers) {
      const vchCode = sanitizeString(raw.code || raw.guid || raw.voucherNumber || '');
      const date = sanitizeString(raw.date || raw.transactionDate || '');
      const vchType = sanitizeString(raw.voucherType || raw.voucherTypeName || 'Stock Movement');
      const docNo = sanitizeString(raw.voucherNumber || raw.documentNo || '');
      const ref = sanitizeString(raw.reference || raw.voucherRef || '');
      const party = sanitizeString(raw.partyName || raw.partyLedgerName || '');
      const narration = sanitizeString(raw.narration || raw.remarks || '');

      const items = raw.items || raw.allInventoryEntries || [];
      const isOutward = /sales|delivery|outward|issue|rejection out/i.test(vchType);

      if (items.length > 0) {
        for (const it of items) {
          const itemName = sanitizeString(it.itemName || it.stockItemName || '');
          const godown = sanitizeString(it.godown || it.godownName || '');
          const qty = Number(it.quantity || it.actualQty || it.billedQty || 0);
          const rate = Number(it.rate || 0);
          const amount = Number(it.amount || (qty * rate) || 0);
          const costCenter = sanitizeString(it.costCenter || raw.costCenter || '');
          const batchNo = sanitizeString(it.batchNo || it.batchName || '');
          const mfgDate = sanitizeString(it.mfgDate || '');
          const expiryDate = sanitizeString(it.expiryDate || '');

          flatRows.push({
            'Code': vchCode,
            'Transaction Date': date,
            'Transaction Type': vchType,
            'Document No': docNo,
            'Voucher Ref (ERP)': ref,
            'Godown Name/Code': godown,
            'Item Code/Name': itemName,
            'Inward Qty': isOutward ? '' : (qty ? String(qty) : ''),
            'Outward Qty': isOutward ? (qty ? String(qty) : '') : '',
            'Rate per Unit': rate ? rate.toFixed(2) : '',
            'Inward Value': isOutward ? '' : (amount ? amount.toFixed(2) : ''),
            'Outward Value': isOutward ? (amount ? amount.toFixed(2) : '') : '',
            'Closing Qty': '',
            'Closing Value': '',
            'Batch No': batchNo,
            'Mfg Date': mfgDate,
            'Expiry Date': expiryDate,
            'Party Name': party,
            'Cost Centre Name/Code': costCenter,
            'Remarks': narration
          });
        }
      } else {
        flatRows.push({
          'Code': vchCode,
          'Transaction Date': date,
          'Transaction Type': vchType,
          'Document No': docNo,
          'Voucher Ref (ERP)': ref,
          'Godown Name/Code': '',
          'Item Code/Name': '',
          'Inward Qty': '',
          'Outward Qty': '',
          'Rate per Unit': '',
          'Inward Value': '',
          'Outward Value': '',
          'Closing Qty': '',
          'Closing Value': '',
          'Batch No': '',
          'Mfg Date': '',
          'Expiry Date': '',
          'Party Name': party,
          'Cost Centre Name/Code': '',
          'Remarks': narration
        });
      }
    }

    return flatRows;
  }

  // ==========================================================================
  // 15. BRANCH (3 columns)
  // ==========================================================================
  static transformBranch(branches, profile = 'canonical') {
    return branches.map(raw => {
      const code = sanitizeString(raw.code || raw.guid || raw.name || '');
      const name = sanitizeString(raw.name || '');
      const gstin = sanitizeString(raw.gstNo || raw.gstin || raw.partyGstin || '');
      return {
        'Code': code,
        'Name': name,
        'GSTNo': gstin
      };
    });
  }

  // ==========================================================================
  // 16. SALES REPRESENTATIVE (3 columns)
  // ==========================================================================
  static transformSalesRepresentative(reps, profile = 'canonical') {
    return reps.map(raw => {
      const code = sanitizeString(raw.code || raw.guid || raw.name || '');
      const name = sanitizeString(raw.name || '');
      const mobile = sanitizeString(raw.mobileNo || raw.mobile || raw.phone || raw.ledgerPhone || '');
      return {
        'Code': code,
        'Name': name,
        'Mobile No': mobile
      };
    });
  }
}
