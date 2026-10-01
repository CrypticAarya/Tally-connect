/**
 * Mock Tally Hierarchical Data Fixtures
 * 
 * Accurately models TallyPrime internal XML/JSON data structures:
 * - Ledgers under Sundry Debtors (with addresses, GST, PAN, banking, credit terms)
 * - Group & Ledger hierarchy for Chart of Accounts
 * - Multi-line Vouchers with nested ALLINVENTORYENTRIES and LEDGERENTRIES
 * - Trial Balance period ledger balances
 */

export const mockTallyData = {
  company: {
    name: 'National Trading Corporation',
    guid: 'e2a87593-4710-482d-83f5-091a0b38cf40',
    financialYearFrom: '2026-04-01',
    financialYearTo: '2027-03-31',
    tallyVersion: 'TallyPrime 4.1 (Build 184)',
    port: 9000
  },

  customers: [
    {
      guid: 'cust-guid-00101',
      name: 'Apex Retail Enterprises Pvt Ltd',
      code: 'CUST-00101',
      parent: 'Sundry Debtors',
      customerType: 'B2B Corporate',
      accountStatus: 'Active',
      contact: {
        name: 'Vikram Malhotra',
        email: 'accounts@apexretail.in',
        phone: '+91 98200 12345'
      },
      mailingDetails: {
        addressLines: ['Unit 402, Trade Tower', 'Senapati Bapat Marg', 'Lower Parel'],
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400013',
        country: 'India'
      },
      statutory: {
        gstRegType: 'Regular',
        gstin: '27AAACA1234D1Z5',
        gstStateCode: '27',
        gstStateName: 'Maharashtra',
        pan: 'AAACA1234D'
      },
      creditPolicy: {
        creditDays: 30,
        creditLimit: 750000.00,
        paymentTerms: 'Net 30 Days',
        currency: 'INR'
      },
      organization: {
        branch: 'Mumbai Central Branch',
        salesRepresentative: 'Rajesh Verma',
        mainDistributor: 'West Coast Logistics',
        mainDealer: 'Prime Dealers Ltd',
        mainAgent: 'Apex Agency',
        subDistributor: 'South Mumbai Distributors',
        subDealer: 'Fort Retailers',
        subAgent: 'Direct Sales Rep'
      },
      banking: {
        bankName: 'HDFC Bank Ltd',
        ifscCode: 'HDFC0000123',
        accountNumber: '50200012345678',
        startDate: '2024-04-01',
        endDate: ''
      },
      active: true,
      remarks: 'Key corporate account for Western region'
    },
    {
      guid: 'cust-guid-00102',
      name: 'Bengaluru Infotech Supplies',
      code: 'CUST-00102',
      parent: 'Sundry Debtors - South',
      customerType: 'B2B Enterprise',
      accountStatus: 'Active',
      contact: {
        name: 'Anita Nair',
        email: 'procurement@blrif.com',
        phone: '+91 98450 98765'
      },
      mailingDetails: {
        addressLines: ['Plot 18, Electronic City Phase 1', 'Hosur Road'],
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560100',
        country: 'India'
      },
      statutory: {
        gstRegType: 'Regular',
        gstin: '29AABCB5678E1Z2',
        gstStateCode: '29',
        gstStateName: 'Karnataka',
        pan: 'AABCB5678E'
      },
      creditPolicy: {
        creditDays: 45,
        creditLimit: 1200000.00,
        paymentTerms: 'Net 45 Days',
        currency: 'INR'
      },
      organization: {
        branch: 'South Hub Branch',
        salesRepresentative: 'Karthik Raman',
        mainDistributor: 'Karnataka Supply Chain',
        mainDealer: 'Bangalore Tech Distributors',
        mainAgent: 'South Agency',
        subDistributor: 'Whitefield Distributors',
        subDealer: 'Tech Dealers',
        subAgent: 'Field Rep South'
      },
      banking: {
        bankName: 'ICICI Bank Ltd',
        ifscCode: 'ICIC0000045',
        accountNumber: '004505001234',
        startDate: '2023-08-15',
        endDate: ''
      },
      active: true,
      remarks: 'Regular high-volume hardware & supplies client'
    },
    {
      guid: 'cust-guid-00103',
      name: 'Delhi Metro Traders',
      code: 'CUST-00103',
      parent: 'Sundry Debtors - North',
      customerType: 'Wholesale Dealer',
      accountStatus: 'Active',
      contact: {
        name: 'Suresh Singhania',
        email: 'singhania@delhitraders.co.in',
        phone: '+91 98110 54321'
      },
      mailingDetails: {
        addressLines: ['Shop 24, Chandni Chowk', 'Main Bazaar'],
        city: 'Delhi',
        state: 'Delhi',
        postalCode: '110006',
        country: 'India'
      },
      statutory: {
        gstRegType: 'Composition',
        gstin: '07AACCD9012F1Z8',
        gstStateCode: '07',
        gstStateName: 'Delhi',
        pan: 'AACCD9012F'
      },
      creditPolicy: {
        creditDays: 15,
        creditLimit: 300000.00,
        paymentTerms: '15 Days PDC',
        currency: 'INR'
      },
      organization: {
        branch: 'North Regional Branch',
        salesRepresentative: 'Amitabh Sen',
        mainDistributor: 'Northern Logistics',
        mainDealer: 'Old Delhi Trading Co',
        mainAgent: 'Capital Agents',
        subDistributor: 'Daryaganj Wholesale',
        subDealer: 'Chandni Chowk Retail',
        subAgent: 'North Rep'
      },
      banking: {
        bankName: 'State Bank of India',
        ifscCode: 'SBIN0000691',
        accountNumber: '31234567890',
        startDate: '2025-01-10',
        endDate: ''
      },
      active: true,
      remarks: 'Prompt payment history'
    }
  ],

  chartOfAccounts: [
    {
      guid: 'gl-guid-001',
      code: 'GL-1001',
      name: 'Apex Retail Enterprises Pvt Ltd',
      description: 'Sundry Debtor ledger for Apex Retail Enterprises',
      parent: 'Sundry Debtors',
      grouping: 'Current Assets',
      financialSummaryGrouping: 'Trade Receivables',
      branch: 'Mumbai Central Branch',
      costCenter: 'Sales Western Region',
      costClassification: 'Direct Asset',
      costBehaviour: 'Variable',
      svVariablePercent: 100.0,
      isInterBranch: false,
      isRelatedParty: false,
      gstApplicable: 'Applicable',
      tdsApplicable: 'Not Applicable',
      active: true,
      remarks: 'Domestic debtor account'
    },
    {
      guid: 'gl-guid-002',
      code: 'GL-4001',
      name: 'Sales - Domestic 18%',
      description: 'Primary revenue account for taxable 18% domestic goods',
      parent: 'Sales Accounts',
      grouping: 'Direct Incomes',
      financialSummaryGrouping: 'Revenue from Operations',
      branch: 'Mumbai Central Branch',
      costCenter: 'Manufacturing & Distribution',
      costClassification: 'Direct Income',
      costBehaviour: 'Variable',
      svVariablePercent: 100.0,
      isInterBranch: false,
      isRelatedParty: false,
      gstApplicable: 'Applicable',
      tdsApplicable: 'Not Applicable',
      active: true,
      remarks: 'GST 18% standard product sales'
    },
    {
      guid: 'gl-guid-003',
      code: 'GL-4002',
      name: 'Sales - Interstate 18%',
      description: 'Revenue from interstate supplies subject to IGST',
      parent: 'Sales Accounts',
      grouping: 'Direct Incomes',
      financialSummaryGrouping: 'Revenue from Operations',
      branch: 'South Hub Branch',
      costCenter: 'Interstate Commerce',
      costClassification: 'Direct Income',
      costBehaviour: 'Variable',
      svVariablePercent: 100.0,
      isInterBranch: false,
      isRelatedParty: false,
      gstApplicable: 'Applicable',
      tdsApplicable: 'Not Applicable',
      active: true,
      remarks: 'Interstate sales revenue ledger'
    },
    {
      guid: 'gl-guid-004',
      code: 'GL-2001',
      name: 'Output CGST @ 9%',
      description: 'Central GST liability on intra-state outward supplies',
      parent: 'Duties & Taxes',
      grouping: 'Current Liabilities',
      financialSummaryGrouping: 'Statutory Dues & Taxes',
      branch: 'Mumbai Central Branch',
      costCenter: 'Statutory Compliance',
      costClassification: 'Indirect Liability',
      costBehaviour: 'Variable',
      svVariablePercent: 100.0,
      isInterBranch: false,
      isRelatedParty: false,
      gstApplicable: 'Applicable',
      tdsApplicable: 'Not Applicable',
      active: true,
      remarks: 'Central tax collection ledger'
    },
    {
      guid: 'gl-guid-005',
      code: 'GL-2002',
      name: 'Output SGST @ 9%',
      description: 'State GST liability on intra-state outward supplies',
      parent: 'Duties & Taxes',
      grouping: 'Current Liabilities',
      financialSummaryGrouping: 'Statutory Dues & Taxes',
      branch: 'Mumbai Central Branch',
      costCenter: 'Statutory Compliance',
      costClassification: 'Indirect Liability',
      costBehaviour: 'Variable',
      svVariablePercent: 100.0,
      isInterBranch: false,
      isRelatedParty: false,
      gstApplicable: 'Applicable',
      tdsApplicable: 'Not Applicable',
      active: true,
      remarks: 'State tax collection ledger'
    },
    {
      guid: 'gl-guid-006',
      code: 'GL-2003',
      name: 'Output IGST @ 18%',
      description: 'Integrated GST liability on inter-state outward supplies',
      parent: 'Duties & Taxes',
      grouping: 'Current Liabilities',
      financialSummaryGrouping: 'Statutory Dues & Taxes',
      branch: 'South Hub Branch',
      costCenter: 'Statutory Compliance',
      costClassification: 'Indirect Liability',
      costBehaviour: 'Variable',
      svVariablePercent: 100.0,
      isInterBranch: false,
      isRelatedParty: false,
      gstApplicable: 'Applicable',
      tdsApplicable: 'Not Applicable',
      active: true,
      remarks: 'Integrated tax collection ledger'
    },
    {
      guid: 'gl-guid-007',
      code: 'GL-5010',
      name: 'Freight & Delivery Charges',
      description: 'Freight collected from customers on sales invoices',
      parent: 'Direct Incomes',
      grouping: 'Other Operating Income',
      financialSummaryGrouping: 'Other Income',
      branch: 'Mumbai Central Branch',
      costCenter: 'Logistics Outward',
      costClassification: 'Indirect Income',
      costBehaviour: 'Semi-Variable',
      svVariablePercent: 65.0,
      isInterBranch: false,
      isRelatedParty: false,
      gstApplicable: 'Applicable',
      tdsApplicable: 'Not Applicable',
      active: true,
      remarks: 'Ancillary shipping recoveries'
    },
    {
      guid: 'gl-guid-008',
      code: 'GL-1020',
      name: 'HDFC Current Account',
      description: 'Main operating bank account in Lower Parel branch',
      parent: 'Bank Accounts',
      grouping: 'Current Assets',
      financialSummaryGrouping: 'Cash & Cash Equivalents',
      branch: 'Mumbai Central Branch',
      costCenter: 'Treasury & Finance',
      costClassification: 'Direct Asset',
      costBehaviour: 'Fixed',
      svVariablePercent: 0.0,
      isInterBranch: false,
      isRelatedParty: false,
      gstApplicable: 'Not Applicable',
      tdsApplicable: 'Not Applicable',
      active: true,
      remarks: 'Primary settlement account'
    }
  ],

  salesVouchers: [
    {
      voucherKey: '9f8e7d6c-5b4a-3210-9876-543210abcdef-00000042',
      date: '2026-04-12',
      voucherNumber: 'INV/2026-27/00108',
      invoiceDate: '2026-04-12',
      voucherType: 'Sales',
      partyLedgerName: 'Apex Retail Enterprises Pvt Ltd',
      partyCode: 'CUST-00101',
      partyGstin: '27AAACA1234D1Z5',
      customerType: 'B2B',
      salesType: 'Intra-State Taxable',
      branchName: 'Mumbai Central Branch',
      branchCode: 'B001',
      costCenter: 'West Region Hub',
      placeOfSupply: 'Maharashtra',
      paymentTerms: 'Net 30 Days',
      dueDate: '2026-05-12',
      paymentStatus: 'Unpaid',
      paymentDate: '',
      modeOfPayment: 'NEFT/RTGS',
      narration: 'Being sales of industrial valves & gaskets against PO # PO-2026-441',
      otherCharges: 1920.00,
      totalInvoice: 144700.00,
      allInventoryEntries: [
        {
          itemDescription: 'Industrial Valve 50mm Brass',
          hsn: '84818030',
          godown: 'Bhiwandi Central Godown',
          qty: 100,
          rate: 800.00,
          discount: 4000.00, // 5% discount on 80,000 = 76,000 taxable
          taxValue: 76000.00,
          cgstRate: 9.0,
          cgstAmount: 6840.00,
          sgstRate: 9.0,
          sgstAmount: 6840.00,
          igstRate: 0.0,
          igstAmount: 0.00,
          batchAllocations: [
            { batchNo: 'BATCH-2026-01', godown: 'Bhiwandi Central Godown', qty: 100 }
          ]
        },
        {
          itemDescription: 'High Pressure Rubber Gasket 2-inch',
          hsn: '40169320',
          godown: 'Bhiwandi Central Godown',
          qty: 250,
          rate: 180.00,
          discount: 0.00, // 45,000 taxable
          taxValue: 45000.00,
          cgstRate: 9.0,
          cgstAmount: 4050.00,
          sgstRate: 9.0,
          sgstAmount: 4050.00,
          igstRate: 0.0,
          igstAmount: 0.00,
          batchAllocations: [
            { batchNo: 'BATCH-2026-02', godown: 'Bhiwandi Central Godown', qty: 250 }
          ]
        }
      ],
      ledgerEntries: [
        {
          ledgerName: 'Apex Retail Enterprises Pvt Ltd',
          isDeemedPositive: true,
          amount: -144700.00,
          taxType: 'PARTY'
        },
        {
          ledgerName: 'Sales - Domestic 18%',
          isDeemedPositive: false,
          amount: 121000.00,
          taxType: 'SALES'
        },
        {
          ledgerName: 'Output CGST @ 9%',
          isDeemedPositive: false,
          amount: 10890.00,
          taxType: 'CGST'
        },
        {
          ledgerName: 'Output SGST @ 9%',
          isDeemedPositive: false,
          amount: 10890.00,
          taxType: 'SGST'
        },
        {
          ledgerName: 'Freight & Delivery Charges',
          isDeemedPositive: false,
          amount: 1900.00,
          taxType: 'OTHER_CHARGES'
        },
        {
          ledgerName: 'Round Off',
          isDeemedPositive: false,
          amount: 20.00,
          taxType: 'OTHER_CHARGES'
        }
      ]
    },
    {
      voucherKey: '8e7d6c5b-4a32-1098-7654-3210fedcba98-00000043',
      date: '2026-04-18',
      voucherNumber: 'INV/2026-27/00109',
      invoiceDate: '2026-04-18',
      voucherType: 'Sales',
      partyLedgerName: 'Bengaluru Infotech Supplies',
      partyCode: 'CUST-00102',
      partyGstin: '29AABCB5678E1Z2',
      customerType: 'B2B',
      salesType: 'Inter-State Taxable',
      branchName: 'South Hub Branch',
      branchCode: 'B002',
      costCenter: 'South Tech Distribution',
      placeOfSupply: 'Karnataka',
      paymentTerms: 'Net 45 Days',
      dueDate: '2026-06-02',
      paymentStatus: 'Paid',
      paymentDate: '2026-05-20',
      modeOfPayment: 'Online Transfer',
      narration: 'Interstate shipment of network switches & cables',
      otherCharges: 2500.00,
      totalInvoice: 244400.00,
      allInventoryEntries: [
        {
          itemDescription: 'Gigabit Managed Switch 24-Port',
          hsn: '85176290',
          godown: 'Electronic City Main Godown',
          qty: 20,
          rate: 7500.00,
          discount: 7500.00, // 5% discount on 150,000 = 142,500 taxable
          taxValue: 142500.00,
          cgstRate: 0.0,
          cgstAmount: 0.00,
          sgstRate: 0.0,
          sgstAmount: 0.00,
          igstRate: 18.0,
          igstAmount: 25650.00,
          batchAllocations: [
            { batchNo: 'SW-2026-B1', godown: 'Electronic City Main Godown', qty: 20 }
          ]
        },
        {
          itemDescription: 'Cat6 Shielded Patch Cord 2m',
          hsn: '85444999',
          godown: 'Electronic City Main Godown',
          qty: 500,
          rate: 130.00,
          discount: 2500.00, // 65,000 - 2,500 = 62,500 taxable
          taxValue: 62500.00,
          cgstRate: 0.0,
          cgstAmount: 0.00,
          sgstRate: 0.0,
          sgstAmount: 0.00,
          igstRate: 18.0,
          igstAmount: 11250.00,
          batchAllocations: [
            { batchNo: 'CBL-2026-08', godown: 'Electronic City Main Godown', qty: 500 }
          ]
        }
      ],
      ledgerEntries: [
        {
          ledgerName: 'Bengaluru Infotech Supplies',
          isDeemedPositive: true,
          amount: -244400.00,
          taxType: 'PARTY'
        },
        {
          ledgerName: 'Sales - Interstate 18%',
          isDeemedPositive: false,
          amount: 205000.00,
          taxType: 'SALES'
        },
        {
          ledgerName: 'Output IGST @ 18%',
          isDeemedPositive: false,
          amount: 36900.00,
          taxType: 'IGST'
        },
        {
          ledgerName: 'Freight & Delivery Charges',
          isDeemedPositive: false,
          amount: 2500.00,
          taxType: 'OTHER_CHARGES'
        }
      ]
    }
  ],

  trialBalance: [
    {
      monthYear: '2026-04',
      branch: 'Mumbai Central Branch',
      particulars: 'Sundry Debtors',
      name: 'Apex Retail Enterprises Pvt Ltd',
      opening: 150000.00,
      debit: 144700.00,
      credit: 120000.00,
      closing: 174700.00,
      drCr: 'Dr'
    },
    {
      monthYear: '2026-04',
      branch: 'South Hub Branch',
      particulars: 'Sundry Debtors',
      name: 'Bengaluru Infotech Supplies',
      opening: 85000.00,
      debit: 244400.00,
      credit: 244400.00,
      closing: 85000.00,
      drCr: 'Dr'
    },
    {
      monthYear: '2026-04',
      branch: 'North Regional Branch',
      particulars: 'Sundry Debtors',
      name: 'Delhi Metro Traders',
      opening: 45000.00,
      debit: 95000.00,
      credit: 75000.00,
      closing: 65000.00,
      drCr: 'Dr'
    },
    {
      monthYear: '2026-04',
      branch: 'Mumbai Central Branch',
      particulars: 'Sales Accounts',
      name: 'Sales - Domestic 18%',
      opening: 0.00,
      debit: 0.00,
      credit: 121000.00,
      closing: 121000.00,
      drCr: 'Cr'
    },
    {
      monthYear: '2026-04',
      branch: 'South Hub Branch',
      particulars: 'Sales Accounts',
      name: 'Sales - Interstate 18%',
      opening: 0.00,
      debit: 0.00,
      credit: 205000.00,
      closing: 205000.00,
      drCr: 'Cr'
    },
    {
      monthYear: '2026-04',
      branch: 'Mumbai Central Branch',
      particulars: 'Duties & Taxes',
      name: 'Output CGST @ 9%',
      opening: 0.00,
      debit: 0.00,
      credit: 10890.00,
      closing: 10890.00,
      drCr: 'Cr'
    },
    {
      monthYear: '2026-04',
      branch: 'Mumbai Central Branch',
      particulars: 'Duties & Taxes',
      name: 'Output SGST @ 9%',
      opening: 0.00,
      debit: 0.00,
      credit: 10890.00,
      closing: 10890.00,
      drCr: 'Cr'
    },
    {
      monthYear: '2026-04',
      branch: 'South Hub Branch',
      particulars: 'Duties & Taxes',
      name: 'Output IGST @ 18%',
      opening: 0.00,
      debit: 0.00,
      credit: 36900.00,
      closing: 36900.00,
      drCr: 'Cr'
    },
    {
      monthYear: '2026-04',
      branch: 'Mumbai Central Branch',
      particulars: 'Bank Accounts',
      name: 'HDFC Current Account',
      opening: 1250000.00,
      debit: 364400.00,
      credit: 215000.00,
      closing: 1399400.00,
      drCr: 'Dr'
    }
  ]
};

export const mockData = mockTallyData;
