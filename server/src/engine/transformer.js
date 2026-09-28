import { getSchema, DATASET_SCHEMAS } from './schemas.js';

/**
 * Data Transformation Engine
 * 
 * Transforms hierarchical TallyPrime entities into standardized flat rows
 * conforming strictly to the 4 target CSV schemas.
 */
export class Transformer {
  /**
   * Main entrypoint: transforms raw Tally data based on dataset type
   * @param {string} datasetType - CUSTOMER, CHART_OF_ACCOUNTS, SALES_REGISTER, TRIAL_BALANCE
   * @param {Array<Object>} rawData - Raw hierarchical records from TallyAdapter
   * @returns {Array<Object>} Flat array of row objects
   */
  static transform(datasetType, rawData) {
    const schema = getSchema(datasetType);
    if (!Array.isArray(rawData)) {
      throw new Error(`Transformer expected an array for ${datasetType}, got ${typeof rawData}`);
    }

    switch (schema.id) {
      case DATASET_SCHEMAS.CUSTOMER.id:
        return this.transformCustomers(rawData);
      case DATASET_SCHEMAS.CHART_OF_ACCOUNTS.id:
        return this.transformChartOfAccounts(rawData);
      case DATASET_SCHEMAS.SALES_REGISTER.id:
        return this.transformSalesRegister(rawData);
      case DATASET_SCHEMAS.TRIAL_BALANCE.id:
        return this.transformTrialBalance(rawData);
      default:
        throw new Error(`No transformer implementation found for ${datasetType}`);
    }
  }

  /**
   * Transforms Customer Master ledgers into the 36-column schema
   */
  static transformCustomers(customers) {
    return customers.map(cust => {
      // Address line aggregation
      let streetAddress = '';
      if (Array.isArray(cust.mailingDetails?.addressLines)) {
        streetAddress = cust.mailingDetails.addressLines.filter(Boolean).join(', ');
      } else if (cust.mailingDetails?.addressLines) {
        streetAddress = String(cust.mailingDetails.addressLines);
      }

      return {
        'Customer Code': cust.code || '',
        'Customer Name': cust.name || '',
        'Customer Type': cust.customerType || '',
        'Account Status': cust.accountStatus || (cust.active ? 'Active' : 'Inactive'),
        'Primary Contact Name': cust.contact?.name || '',
        'Primary Contact Email': cust.contact?.email || '',
        'Primary Contact Phone': cust.contact?.phone || '',
        'Street Address': streetAddress,
        'City': cust.mailingDetails?.city || '',
        'State/Province': cust.mailingDetails?.state || '',
        'Postal/ZIP Code': cust.mailingDetails?.postalCode || '',
        'Country': cust.mailingDetails?.country || 'India',
        'GST Reg Type': cust.statutory?.gstRegType || '',
        'Pan': cust.statutory?.pan || '',
        'Credit Days': cust.creditPolicy?.creditDays != null ? String(cust.creditPolicy.creditDays) : '',
        'Credit Limit': cust.creditPolicy?.creditLimit != null ? Number(cust.creditPolicy.creditLimit).toFixed(2) : '',
        'Payment Terms': cust.creditPolicy?.paymentTerms || '',
        'Currency': cust.creditPolicy?.currency || 'INR',
        'Branch ID/Name': cust.organization?.branch || '',
        'Sales Representative': cust.organization?.salesRepresentative || '',
        'GST Number': cust.statutory?.gstin || '',
        'GST State Code': cust.statutory?.gstStateCode || '',
        'GST State Name': cust.statutory?.gstStateName || '',
        'MainDistributor': cust.organization?.mainDistributor || '',
        'MainDealer': cust.organization?.mainDealer || '',
        'MainAgent': cust.organization?.mainAgent || '',
        'SubDistributor': cust.organization?.subDistributor || '',
        'SubDealer': cust.organization?.subDealer || '',
        'SubAgent': cust.organization?.subAgent || '',
        'AccPartyBankName': cust.banking?.bankName || '',
        'AccPartyBankIFSCCode': cust.banking?.ifscCode || '',
        'AccPartyBankActNo': cust.banking?.accountNumber || '',
        'AccStartDate': cust.banking?.startDate || '',
        'AccEndDate': cust.banking?.endDate || '',
        'Active': cust.active ? 'Yes' : 'No',
        'Remarks': cust.remarks || ''
      };
    });
  }

  /**
   * Transforms Chart of Accounts ledgers into the 17-column schema
   */
  static transformChartOfAccounts(accounts) {
    return accounts.map(gl => {
      let costCenter = '';
      if (Array.isArray(gl.costCenters)) {
        costCenter = gl.costCenters.join(', ');
      } else if (gl.costCenter) {
        costCenter = String(gl.costCenter);
      }

      return {
        'Account Code': gl.code || '',
        'GL Name': gl.name || '',
        'Ledger Description': gl.description || '',
        'Parent': gl.parent || '',
        'Grouping': gl.grouping || '',
        'Grouping for Financial Summary': gl.financialSummaryGrouping || '',
        'Branch': gl.branch || '',
        'Cost Center': costCenter,
        'Cost Classification': gl.costClassification || '',
        'Cost Behaviour Description': gl.costBehaviour || '',
        'SV Variable %': gl.svVariablePercent != null ? String(gl.svVariablePercent) : '',
        'Inter-branch': gl.isInterBranch ? 'Yes' : 'No',
        'Related Party': gl.isRelatedParty ? 'Yes' : 'No',
        'GST Applicable': gl.gstApplicable || '',
        'TDS Applicable': gl.tdsApplicable || '',
        'Active': gl.active ? 'Yes' : 'No',
        'Remarks': gl.remarks || ''
      };
    });
  }

  /**
   * Transforms Sales Vouchers into the 32-column line-item Sales Register
   * Unrolls hierarchical vouchers: 1 Voucher -> N Line Items
   */
  static transformSalesRegister(vouchers) {
    const flatRows = [];

    for (const voucher of vouchers) {
      // 1. Calculate Other Charges (Freight, Round-off, ancillary ledgers) from ledgerEntries if not explicit
      let otherCharges = 0;
      if (voucher.otherCharges != null) {
        otherCharges = Number(voucher.otherCharges);
      } else if (Array.isArray(voucher.ledgerEntries)) {
        const otherEntries = voucher.ledgerEntries.filter(l => l.taxType === 'OTHER_CHARGES');
        otherCharges = otherEntries.reduce((sum, l) => sum + Math.abs(Number(l.amount || 0)), 0);
      }

      const totalInvoice = voucher.totalInvoice != null
        ? Number(voucher.totalInvoice).toFixed(2)
        : '';

      const inventoryEntries = Array.isArray(voucher.allInventoryEntries) && voucher.allInventoryEntries.length > 0
        ? voucher.allInventoryEntries
        : [];

      // If voucher has inventory line items (Standard Goods Invoice)
      if (inventoryEntries.length > 0) {
        inventoryEntries.forEach(item => {
          // Resolve Godown name from item level or batch allocations
          const godown = item.godown ||
            (Array.isArray(item.batchAllocations) && item.batchAllocations[0]?.godown) ||
            voucher.branchName ||
            '';

          // Format GST percentages and amounts
          const cgstRateStr = item.cgstRate != null && item.cgstRate > 0 ? `${item.cgstRate}%` : '';
          const sgstRateStr = item.sgstRate != null && item.sgstRate > 0 ? `${item.sgstRate}%` : '';
          const igstRateStr = item.igstRate != null && item.igstRate > 0 ? `${item.igstRate}%` : '';

          flatRows.push({
            'Code': voucher.voucherKey || voucher.guid || '',
            'Sales Date': voucher.date || '',
            'Invoice No': voucher.voucherNumber || '',
            'Invoice Date': voucher.invoiceDate || voucher.date || '',
            'Customer Name/Code': voucher.partyLedgerName || voucher.partyCode || '',
            'GSTIN': voucher.partyGstin || '',
            'Customer Type': voucher.customerType || '',
            'Sales Type': voucher.salesType || '',
            'Branch Name/Code': voucher.branchName || voucher.branchCode || '',
            'Cost Center Name/Code': voucher.costCenter || '',
            'Godown Name/Code': godown,
            'Item Description': item.itemDescription || '',
            'HSN': item.hsn || '',
            'Qty': item.qty != null ? String(item.qty) : '',
            'Rate': item.rate != null ? Number(item.rate).toFixed(2) : '',
            'Discount': item.discount != null ? Number(item.discount).toFixed(2) : '0.00',
            'Tax Value': item.taxValue != null ? Number(item.taxValue).toFixed(2) : '',
            'CGST': cgstRateStr,
            'CGST Amount': item.cgstAmount != null ? Number(item.cgstAmount).toFixed(2) : '0.00',
            'SGST': sgstRateStr,
            'SGST Amount': item.sgstAmount != null ? Number(item.sgstAmount).toFixed(2) : '0.00',
            'IGST': igstRateStr,
            'IGST Amount': item.igstAmount != null ? Number(item.igstAmount).toFixed(2) : '0.00',
            'Other Charges (₹)': otherCharges > 0 ? otherCharges.toFixed(2) : '0.00',
            'Total Invoice': totalInvoice,
            'Place of Supply (State)': voucher.placeOfSupply || '',
            'Payment Terms': voucher.paymentTerms || '',
            'Due Date': voucher.dueDate || '',
            'Payment Status': voucher.paymentStatus || '',
            'Payment Date': voucher.paymentDate || '',
            'Mode Of Payment': voucher.modeOfPayment || '',
            'Remarks': voucher.narration || ''
          });
        });
      } else {
        // Service invoice without stock items: emit single row
        flatRows.push({
          'Code': voucher.voucherKey || voucher.guid || '',
          'Sales Date': voucher.date || '',
          'Invoice No': voucher.voucherNumber || '',
          'Invoice Date': voucher.invoiceDate || voucher.date || '',
          'Customer Name/Code': voucher.partyLedgerName || voucher.partyCode || '',
          'GSTIN': voucher.partyGstin || '',
          'Customer Type': voucher.customerType || '',
          'Sales Type': voucher.salesType || '',
          'Branch Name/Code': voucher.branchName || voucher.branchCode || '',
          'Cost Center Name/Code': voucher.costCenter || '',
          'Godown Name/Code': '',
          'Item Description': voucher.narration || 'Service Sales',
          'HSN': '',
          'Qty': '1',
          'Rate': totalInvoice,
          'Discount': '0.00',
          'Tax Value': totalInvoice,
          'CGST': '',
          'CGST Amount': '0.00',
          'SGST': '',
          'SGST Amount': '0.00',
          'IGST': '',
          'IGST Amount': '0.00',
          'Other Charges (₹)': otherCharges > 0 ? otherCharges.toFixed(2) : '0.00',
          'Total Invoice': totalInvoice,
          'Place of Supply (State)': voucher.placeOfSupply || '',
          'Payment Terms': voucher.paymentTerms || '',
          'Due Date': voucher.dueDate || '',
          'Payment Status': voucher.paymentStatus || '',
          'Payment Date': voucher.paymentDate || '',
          'Mode Of Payment': voucher.modeOfPayment || '',
          'Remarks': voucher.narration || ''
        });
      }
    }

    return flatRows;
  }

  /**
   * Transforms Trial Balance records into the 9-column schema
   */
  static transformTrialBalance(balances) {
    return balances.map(tb => ({
      'Month/Year': tb.monthYear || '',
      'Branch': tb.branch || '',
      'Particulars': tb.particulars || '',
      'Name': tb.name || '',
      'Opening': tb.opening != null ? Number(tb.opening).toFixed(2) : '0.00',
      'Debit': tb.debit != null ? Number(tb.debit).toFixed(2) : '0.00',
      'Credit': tb.credit != null ? Number(tb.credit).toFixed(2) : '0.00',
      'Closing': tb.closing != null ? Number(tb.closing).toFixed(2) : '0.00',
      'Dr/Cr': tb.drCr || ''
    }));
  }
}
