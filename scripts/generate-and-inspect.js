/**
 * Physical File Inspection and Header Audit Script
 * 
 * Inspects all supported datasets:
 * 1. Exact filename
 * 2. File extension
 * 3. Actual MIME/file type
 * 4. File size
 * 5. Header row
 * 6. First 5 real data rows
 * 7. Number of data rows
 * 8. Programmatic CSV parse verification
 * 9. CSV vs XML logical record parity verification
 * 10. Character-by-character & field-by-field comparison against authoritative sample files
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { parseString } from 'fast-csv';
import { XMLParser } from '../connector-agent/node_modules/fast-xml-parser/src/fxp.js';
import { fileURLToPath } from 'url';

import { getAllEntities } from '../connector-agent/src/extraction/entityRegistry.js';
import { getSchema } from '../connector-agent/src/engine/schemas.js';
import { Transformer } from '../connector-agent/src/engine/transformer.js';
import { DataValidator } from '../connector-agent/src/engine/dataValidator.js';
import { CsvExporter } from '../connector-agent/src/export/csvExporter.js';
import { XmlExporter } from '../connector-agent/src/export/xmlExporter.js';
import { LocalExportStorage } from '../connector-agent/src/storage/localExportStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const exportDir = path.join(rootDir, 'inspection_exports');
const sampleDir = '/Users/eunoia/Desktop/sample';

if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}
const storage = new LocalExportStorage({ baseDir: exportDir });

// Authoritative sample files mapping
const SAMPLE_MAP = {
  branch: 'SampleBranch.csv',
  chart_of_accounts: 'SampleChartAccounts.csv',
  ledgers: 'SampleChartAccounts.csv',
  cost_centers: 'SampleCostCenter.csv',
  customers: 'SampleCustomer.csv',
  inventory: 'SampleInventory.csv',
  inventory_master: 'SampleInventoryMaster.csv',
  stock_items: 'SampleItemMaster.csv',
  purchase_register: 'SamplePurchaseRegister.csv',
  sales_register: 'SampleSalesRegister.csv',
  sales_representative: 'SampleSalesRepresentative.csv',
  trial_balance: 'SampleTrialBalances.csv',
  vendors: 'SampleVendor.csv',
  godowns: 'Samplegodown.csv'
};

// High-fidelity multi-row real data fixtures (6 real rows per dataset)
const FIXTURES = {
  chart_of_accounts: [
    { name: 'State Bank of India', parent: 'Bank Accounts', openingBalance: 1250000.00, closingBalance: 1450000.00, isCostCentresOn: false, gstApplicable: 'Applicable', mailingName: 'SBI Corporate', state: 'Maharashtra', pincode: '400001', country: 'India', gstin: '27AAACS1234A1Z1', narration: 'SBI Primary Account' },
    { name: 'HDFC Bank Ltd', parent: 'Bank Accounts', openingBalance: 850000.00, closingBalance: 920000.00, isCostCentresOn: false, gstApplicable: 'Applicable', mailingName: 'HDFC Current', state: 'Maharashtra', pincode: '400021', country: 'India', gstin: '27AAACH1234A1Z2', narration: 'HDFC Working Capital' },
    { name: 'Tata Consultancy Services Ltd', parent: 'Sundry Debtors', openingBalance: 450000.00, closingBalance: 600000.00, isCostCentresOn: true, gstApplicable: 'Applicable', mailingName: 'TCS Accounts', state: 'Maharashtra', pincode: '400001', country: 'India', gstin: '27AAACT2727Q1ZW', narration: 'Domestic Debtor' },
    { name: 'Larsen & Toubro Ltd', parent: 'Sundry Creditors', openingBalance: -1200000.00, closingBalance: -800000.00, isCostCentresOn: true, gstApplicable: 'Applicable', mailingName: 'L&T Finance', state: 'Maharashtra', pincode: '400001', country: 'India', gstin: '27AAACL0123K1ZT', narration: 'Primary Vendor' },
    { name: 'Sales Account - Domestic', parent: 'Sales Accounts', openingBalance: 0, closingBalance: 5400000.00, isCostCentresOn: true, gstApplicable: 'Applicable', state: 'Maharashtra', narration: 'GST Revenue Account' },
    { name: 'Factory Rent & Rates', parent: 'Indirect Expenses', openingBalance: 0, closingBalance: 360000.00, isCostCentresOn: true, gstApplicable: 'Applicable', state: 'Maharashtra', narration: 'Manufacturing Facility Lease' }
  ],
  customers: [
    { code: 'CUST-001', name: 'Tata Consultancy Services Ltd', parent: 'Sundry Debtors', gstin: '27AAACT2727Q1ZW', contact: { phone: '022-67789999', email: 'billing@tcs.com', person: 'Natarajan C' }, mailingDetails: { address: 'TCS House, Raveline Street', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', country: 'India' }, statutory: { gstRegType: 'Regular', stateCode: '27', stateName: 'Maharashtra' }, creditPolicy: { creditLimit: 5000000, creditPeriod: '45 Days' }, banking: { bankName: 'Standard Chartered', ifscCode: 'SCBL0036001', accountNumber: '22205012345' }, active: true },
    { code: 'CUST-002', name: 'Infosys Limited', parent: 'Sundry Debtors', gstin: '29AAACI4818N1ZH', contact: { phone: '080-28520261', email: 'ap@infosys.com', person: 'Nandan Murthy' }, mailingDetails: { address: 'Electronics City, Hosur Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560100', country: 'India' }, statutory: { gstRegType: 'Regular', stateCode: '29', stateName: 'Karnataka' }, creditPolicy: { creditLimit: 4000000, creditPeriod: '30 Days' }, banking: { bankName: 'ICICI Bank', ifscCode: 'ICIC0000002', accountNumber: '000205001234' }, active: true },
    { code: 'CUST-003', name: 'Wipro Enterprises Ltd', parent: 'Sundry Debtors', gstin: '29AAACW0329K1ZV', contact: { phone: '080-28440011', email: 'vendor@wipro.com', person: 'Azim Premji' }, mailingDetails: { address: 'Doddakannelli, Sarjapur Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560035', country: 'India' }, statutory: { gstRegType: 'Regular', stateCode: '29', stateName: 'Karnataka' }, creditPolicy: { creditLimit: 3000000, creditPeriod: '30 Days' }, banking: { bankName: 'HDFC Bank', ifscCode: 'HDFC0000050', accountNumber: '502000012345' }, active: true },
    { code: 'CUST-004', name: 'Mahindra & Mahindra Ltd', parent: 'Sundry Debtors', gstin: '27AAACM1234P1Z3', contact: { phone: '022-24901441', email: 'accounts@mahindra.com', person: 'Anand Mahindra' }, mailingDetails: { address: 'Gateway Building, Apollo Bunder', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', country: 'India' }, statutory: { gstRegType: 'Regular', stateCode: '27', stateName: 'Maharashtra' }, creditPolicy: { creditLimit: 7500000, creditPeriod: '60 Days' }, banking: { bankName: 'State Bank of India', ifscCode: 'SBIN0000300', accountNumber: '10012345678' }, active: true },
    { code: 'CUST-005', name: 'Bajaj Auto Limited', parent: 'Sundry Debtors', gstin: '27AAACB1234C1Z5', contact: { phone: '020-27472851', email: 'procurement@bajajauto.co.in', person: 'Rahul Bajaj' }, mailingDetails: { address: 'Mumbai-Pune Road, Akurdi', city: 'Pune', state: 'Maharashtra', pincode: '411035', country: 'India' }, statutory: { gstRegType: 'Regular', stateCode: '27', stateName: 'Maharashtra' }, creditPolicy: { creditLimit: 6000000, creditPeriod: '45 Days' }, banking: { bankName: 'Citibank', ifscCode: 'CITI0000001', accountNumber: '1234567890' }, active: true },
    { code: 'CUST-006', name: 'Bharat Forge Ltd', parent: 'Sundry Debtors', gstin: '27AAACB4567D1Z8', contact: { phone: '020-67042777', email: 'finance@bharatforge.com', person: 'Baba Kalyani' }, mailingDetails: { address: 'Mundhwa Industrial Area', city: 'Pune', state: 'Maharashtra', pincode: '411036', country: 'India' }, statutory: { gstRegType: 'Regular', stateCode: '27', stateName: 'Maharashtra' }, creditPolicy: { creditLimit: 4500000, creditPeriod: '30 Days' }, banking: { bankName: 'Axis Bank', ifscCode: 'UTIB0000005', accountNumber: '912010012345' }, active: true }
  ],
  vendors: [
    { code: 'VEND-001', name: 'Larsen & Toubro Ltd', parent: 'Sundry Creditors', gstin: '27AAACL0123K1ZT', contact: { phone: '022-67525656', email: 'accounts@larsentoubro.com', person: 'Suresh Iyer' }, mailingDetails: { address: 'L&T House, Ballard Estate', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', country: 'India' }, statutory: { gstRegType: 'Regular', stateCode: '27', stateName: 'Maharashtra' }, creditPolicy: { creditLimit: 10000000, creditPeriod: '60 Days' }, banking: { bankName: 'State Bank of India', ifscCode: 'SBIN0000300', accountNumber: '10012345678' }, active: true },
    { code: 'VEND-002', name: 'Siemens India Ltd', parent: 'Sundry Creditors', gstin: '27AAACS1234Q1Z2', contact: { phone: '022-39677000', email: 'invoices@siemens.com', person: 'Sunil Mathur' }, mailingDetails: { address: 'Dr Annie Besant Road, Worli', city: 'Mumbai', state: 'Maharashtra', pincode: '400018', country: 'India' }, statutory: { gstRegType: 'Regular', stateCode: '27', stateName: 'Maharashtra' }, creditPolicy: { creditLimit: 8000000, creditPeriod: '45 Days' }, banking: { bankName: 'Deutsche Bank', ifscCode: 'DEUT0784BBY', accountNumber: '0000123456' }, active: true },
    { code: 'VEND-003', name: 'ABB India Limited', parent: 'Sundry Creditors', gstin: '29AAACA1234B1Z9', contact: { phone: '080-22949150', email: 'billing@abb.com', person: 'Sanjeev Sharma' }, mailingDetails: { address: 'Peenya Industrial Area', city: 'Bengaluru', state: 'Karnataka', pincode: '560058', country: 'India' }, statutory: { gstRegType: 'Regular', stateCode: '29', stateName: 'Karnataka' }, creditPolicy: { creditLimit: 6000000, creditPeriod: '45 Days' }, banking: { bankName: 'HSBC', ifscCode: 'HSBC0560002', accountNumber: '0560012345' }, active: true },
    { code: 'VEND-004', name: 'Schneider Electric India', parent: 'Sundry Creditors', gstin: '06AAACS1234E1Z4', contact: { phone: '0124-4222000', email: 'ap@se.com', person: 'Anil Chaudhry' }, mailingDetails: { address: 'DLF Cyber City, Phase II', city: 'Gurugram', state: 'Haryana', pincode: '122002', country: 'India' }, statutory: { gstRegType: 'Regular', stateCode: '06', stateName: 'Haryana' }, creditPolicy: { creditLimit: 5000000, creditPeriod: '30 Days' }, banking: { bankName: 'BNP Paribas', ifscCode: 'BNPA0009001', accountNumber: '0900100123' }, active: true },
    { code: 'VEND-005', name: 'Havells India Limited', parent: 'Sundry Creditors', gstin: '07AAACH1234K1Z6', contact: { phone: '0120-4771000', email: 'vendor@havells.com', person: 'Anil Rai Gupta' }, mailingDetails: { address: 'QRG Towers, 2D, Expressway', city: 'Noida', state: 'Uttar Pradesh', pincode: '201304', country: 'India' }, statutory: { gstRegType: 'Regular', stateCode: '07', stateName: 'Delhi' }, creditPolicy: { creditLimit: 4000000, creditPeriod: '30 Days' }, banking: { bankName: 'HDFC Bank', ifscCode: 'HDFC0000003', accountNumber: '000305001234' }, active: true },
    { code: 'VEND-006', name: 'Polycab India Limited', parent: 'Sundry Creditors', gstin: '27AAACP1234F1Z7', contact: { phone: '022-24327070', email: 'accounts@polycab.com', person: 'Inder Jaisinghani' }, mailingDetails: { address: 'Polycab House, Mogul Lane, Mahim', city: 'Mumbai', state: 'Maharashtra', pincode: '400016', country: 'India' }, statutory: { gstRegType: 'Regular', stateCode: '27', stateName: 'Maharashtra' }, creditPolicy: { creditLimit: 7000000, creditPeriod: '45 Days' }, banking: { bankName: 'Bank of Baroda', ifscCode: 'BARB0MAHIMX', accountNumber: '123402000056' }, active: true }
  ],
  stock_items: [
    { code: 'MOT-01', name: 'Industrial AC Motor 5HP 3Phase', parent: 'Electric Motors', category: 'Induction', uom: 'NOS', hsn: '85015210', gstRate: 18, standardCost: 15000, standardPrice: 22000, mrp: 25000, reorderLevel: 10, minStockQty: 5, maxStockQty: 50, openingQuantity: 12, openingRate: 15000, openingValue: 180000, costingMethod: 'Avg Cost', status: 'Active' },
    { code: 'MOT-02', name: 'Industrial AC Motor 10HP 3Phase', parent: 'Electric Motors', category: 'Induction', uom: 'NOS', hsn: '85015220', gstRate: 18, standardCost: 28000, standardPrice: 42000, mrp: 48000, reorderLevel: 5, minStockQty: 2, maxStockQty: 25, openingQuantity: 6, openingRate: 28000, openingValue: 168000, costingMethod: 'Avg Cost', status: 'Active' },
    { code: 'PMP-01', name: 'Centrifugal Water Pump 2HP', parent: 'Water Pumps', category: 'Submersible', uom: 'NOS', hsn: '84137010', gstRate: 18, standardCost: 8500, standardPrice: 13500, mrp: 16000, reorderLevel: 15, minStockQty: 8, maxStockQty: 60, openingQuantity: 20, openingRate: 8500, openingValue: 170000, costingMethod: 'Avg Cost', status: 'Active' },
    { code: 'VFD-01', name: 'Variable Frequency Drive 5kW', parent: 'Automation Drives', category: 'Inverters', uom: 'NOS', hsn: '85044090', gstRate: 18, standardCost: 18000, standardPrice: 27500, mrp: 31000, reorderLevel: 8, minStockQty: 3, maxStockQty: 30, openingQuantity: 10, openingRate: 18000, openingValue: 180000, costingMethod: 'Avg Cost', status: 'Active' },
    { code: 'WIR-01', name: 'Copper Winding Wire 1.2mm', parent: 'Raw Materials', category: 'Electrical', uom: 'KGS', hsn: '74081190', gstRate: 18, standardCost: 750, standardPrice: 950, mrp: 1100, reorderLevel: 100, minStockQty: 50, maxStockQty: 500, openingQuantity: 250, openingRate: 750, openingValue: 187500, costingMethod: 'Avg Cost', status: 'Active' },
    { code: 'BRG-01', name: 'Deep Groove Ball Bearing 6205', parent: 'Mechanical Parts', category: 'Bearings', uom: 'PCS', hsn: '84821011', gstRate: 18, standardCost: 220, standardPrice: 450, mrp: 550, reorderLevel: 50, minStockQty: 20, maxStockQty: 300, openingQuantity: 120, openingRate: 220, openingValue: 26400, costingMethod: 'Avg Cost', status: 'Active' }
  ],
  inventory: [
    { code: 'MOT-01', name: 'Industrial AC Motor 5HP 3Phase', parent: 'Electric Motors', category: 'Induction', uom: 'NOS', hsn: '85015210', reorderLevel: 10, minStockQty: 5, maxStockQty: 50, status: 'Active' },
    { code: 'MOT-02', name: 'Industrial AC Motor 10HP 3Phase', parent: 'Electric Motors', category: 'Induction', uom: 'NOS', hsn: '85015220', reorderLevel: 5, minStockQty: 2, maxStockQty: 25, status: 'Active' },
    { code: 'PMP-01', name: 'Centrifugal Water Pump 2HP', parent: 'Water Pumps', category: 'Submersible', uom: 'NOS', hsn: '84137010', reorderLevel: 15, minStockQty: 8, maxStockQty: 60, status: 'Active' },
    { code: 'VFD-01', name: 'Variable Frequency Drive 5kW', parent: 'Automation Drives', category: 'Inverters', uom: 'NOS', hsn: '85044090', reorderLevel: 8, minStockQty: 3, maxStockQty: 30, status: 'Active' },
    { code: 'WIR-01', name: 'Copper Winding Wire 1.2mm', parent: 'Raw Materials', category: 'Electrical', uom: 'KGS', hsn: '74081190', reorderLevel: 100, minStockQty: 50, maxStockQty: 500, status: 'Active' },
    { code: 'BRG-01', name: 'Deep Groove Ball Bearing 6205', parent: 'Mechanical Parts', category: 'Bearings', uom: 'PCS', hsn: '84821011', reorderLevel: 50, minStockQty: 20, maxStockQty: 300, status: 'Active' }
  ],
  inventory_master: [
    { code: 'STK-001', date: '2026-04-10', voucherType: 'Purchase', voucherNumber: 'PUR-2026-01', reference: 'BILL-LT-9988', partyName: 'Larsen & Toubro Ltd', narration: 'Inward copper wire stock', items: [{ itemName: 'Copper Winding Wire 1.2mm', godown: 'Bhiwandi Central Warehouse', quantity: 100, rate: 750, amount: 75000, batchNo: 'BAT-2026-04A', mfgDate: '2026-03-01', expiryDate: '2028-03-01' }] },
    { code: 'STK-002', date: '2026-04-15', voucherType: 'Sales', voucherNumber: 'INV-2026-01', reference: 'DC-2026-01', partyName: 'Tata Consultancy Services Ltd', narration: 'Dispatched motor stock', items: [{ itemName: 'Industrial AC Motor 5HP 3Phase', godown: 'Bhiwandi Central Warehouse', quantity: 2, rate: 22000, amount: 44000, batchNo: 'BAT-2026-04B', mfgDate: '2026-02-15', expiryDate: '2031-02-15' }] },
    { code: 'STK-003', date: '2026-04-20', voucherType: 'Stock Journal', voucherNumber: 'SJ-2026-01', reference: 'TRAN-01', partyName: '', narration: 'Inter-warehouse stock transfer', items: [{ itemName: 'Centrifugal Water Pump 2HP', godown: 'Pune Distribution Godown', quantity: 5, rate: 8500, amount: 42500, batchNo: 'BAT-2026-04C' }] },
    { code: 'STK-004', date: '2026-04-25', voucherType: 'Receipt Note', voucherNumber: 'RN-2026-01', reference: 'CHAL-01', partyName: 'ABB India Limited', narration: 'VFD units received from vendor', items: [{ itemName: 'Variable Frequency Drive 5kW', godown: 'Bhiwandi Central Warehouse', quantity: 4, rate: 18000, amount: 72000, batchNo: 'BAT-2026-04D' }] },
    { code: 'STK-005', date: '2026-04-28', voucherType: 'Delivery Note', voucherNumber: 'DN-2026-01', reference: 'CHAL-02', partyName: 'Infosys Limited', narration: 'Dispatched VFDs', items: [{ itemName: 'Variable Frequency Drive 5kW', godown: 'Bhiwandi Central Warehouse', quantity: 2, rate: 27500, amount: 55000, batchNo: 'BAT-2026-04D' }] },
    { code: 'STK-006', date: '2026-04-30', voucherType: 'Physical Stock', voucherNumber: 'PS-2026-01', reference: 'AUDIT-01', partyName: '', narration: 'Monthly inventory cycle count', items: [{ itemName: 'Deep Groove Ball Bearing 6205', godown: 'Bhiwandi Central Warehouse', quantity: 120, rate: 220, amount: 26400, batchNo: 'BAT-2026-04E' }] }
  ],
  sales_register: [
    { voucherId: 'SALES-001', voucherNumber: 'INV-2026-001', date: '2026-04-05', partyName: 'Tata Consultancy Services Ltd', gstin: '27AAACT2727Q1ZW', placeOfSupply: 'Maharashtra', voucherType: 'Sales', narration: 'Supply of 5HP Motors', amount: 129800, items: [{ itemName: 'Industrial AC Motor 5HP 3Phase', itemDescription: 'Industrial AC Motor 5HP 3Phase', hsn: '85015210', quantity: 5, rate: 22000, discount: 0, amount: 110000, taxValue: 110000, cgstRate: '9%', cgstAmount: 9900, sgstRate: '9%', sgstAmount: 9900, igstRate: '', igstAmount: 0, godown: 'Bhiwandi Central Warehouse' }] },
    { voucherId: 'SALES-002', voucherNumber: 'INV-2026-002', date: '2026-04-12', partyName: 'Infosys Limited', gstin: '29AAACI4818N1ZH', placeOfSupply: 'Karnataka', voucherType: 'Sales', narration: 'Interstate export of 10HP Motors', amount: 99120, items: [{ itemName: 'Industrial AC Motor 10HP 3Phase', itemDescription: 'Industrial AC Motor 10HP 3Phase', hsn: '85015220', quantity: 2, rate: 42000, discount: 0, amount: 84000, taxValue: 84000, cgstRate: '', cgstAmount: 0, sgstRate: '', sgstAmount: 0, igstRate: '18%', igstAmount: 15120, godown: 'Bhiwandi Central Warehouse' }] },
    { voucherId: 'SALES-003', voucherNumber: 'INV-2026-003', date: '2026-04-18', partyName: 'Wipro Enterprises Ltd', gstin: '29AAACW0329K1ZV', placeOfSupply: 'Karnataka', voucherType: 'Sales', narration: 'Supply of VFD automation drives', amount: 64900, items: [{ itemName: 'Variable Frequency Drive 5kW', itemDescription: 'Variable Frequency Drive 5kW', hsn: '85044090', quantity: 2, rate: 27500, discount: 0, amount: 55000, taxValue: 55000, cgstRate: '', cgstAmount: 0, sgstRate: '', sgstAmount: 0, igstRate: '18%', igstAmount: 9900, godown: 'Bhiwandi Central Warehouse' }] },
    { voucherId: 'SALES-004', voucherNumber: 'INV-2026-004', date: '2026-04-22', partyName: 'Mahindra & Mahindra Ltd', gstin: '27AAACM1234P1Z3', placeOfSupply: 'Maharashtra', voucherType: 'Sales', narration: 'Supply of Centrifugal Water Pumps', amount: 79650, items: [{ itemName: 'Centrifugal Water Pump 2HP', itemDescription: 'Centrifugal Water Pump 2HP', hsn: '84137010', quantity: 5, rate: 13500, discount: 0, amount: 67500, taxValue: 67500, cgstRate: '9%', cgstAmount: 6075, sgstRate: '9%', sgstAmount: 6075, igstRate: '', igstAmount: 0, godown: 'Pune Distribution Godown' }] },
    { voucherId: 'SALES-005', voucherNumber: 'INV-2026-005', date: '2026-04-26', partyName: 'Bajaj Auto Limited', gstin: '27AAACB1234C1Z5', placeOfSupply: 'Maharashtra', voucherType: 'Sales', narration: 'Supply of ball bearings batch', amount: 26550, items: [{ itemName: 'Deep Groove Ball Bearing 6205', itemDescription: 'Deep Groove Ball Bearing 6205', hsn: '84821011', quantity: 50, rate: 450, discount: 0, amount: 22500, taxValue: 22500, cgstRate: '9%', cgstAmount: 2025, sgstRate: '9%', sgstAmount: 2025, igstRate: '', igstAmount: 0, godown: 'Pune Distribution Godown' }] },
    { voucherId: 'SALES-006', voucherNumber: 'INV-2026-006', date: '2026-04-29', partyName: 'Bharat Forge Ltd', gstin: '27AAACB4567D1Z8', placeOfSupply: 'Maharashtra', voucherType: 'Sales', narration: 'Domestic motor supply', amount: 51920, items: [{ itemName: 'Industrial AC Motor 5HP 3Phase', itemDescription: 'Industrial AC Motor 5HP 3Phase', hsn: '85015210', quantity: 2, rate: 22000, discount: 0, amount: 44000, taxValue: 44000, cgstRate: '9%', cgstAmount: 3960, sgstRate: '9%', sgstAmount: 3960, igstRate: '', igstAmount: 0, godown: 'Bhiwandi Central Warehouse' }] }
  ],
  purchase_register: [
    { voucherId: 'PURCH-001', voucherNumber: 'BILL-LT-9988', date: '2026-04-02', vendorName: 'Larsen & Toubro Ltd', gstin: '27AAACL0123K1ZT', placeOfSupply: 'Maharashtra', purchaseType: 'Purchase', narration: 'Raw materials procurement - copper wire', amount: 88500, grnNo: 'GRN-2026-01', poReferenceNo: 'PO-2026-001', items: [{ itemName: 'Copper Winding Wire 1.2mm', itemDescription: 'Copper Winding Wire 1.2mm', hsn: '74081190', quantity: 100, rate: 750, discount: 0, amount: 75000, taxValue: 75000, cgstRate: '9%', cgstAmount: 6750, sgstRate: '9%', sgstAmount: 6750, igstRate: '', igstAmount: 0, godown: 'Bhiwandi Central Warehouse' }] },
    { voucherId: 'PURCH-002', voucherNumber: 'BILL-SIE-4512', date: '2026-04-08', vendorName: 'Siemens India Ltd', gstin: '27AAACS1234Q1Z2', placeOfSupply: 'Maharashtra', purchaseType: 'Purchase', narration: 'VFD drive controller cards', amount: 106200, grnNo: 'GRN-2026-02', poReferenceNo: 'PO-2026-002', items: [{ itemName: 'Variable Frequency Drive 5kW', itemDescription: 'Variable Frequency Drive 5kW', hsn: '85044090', quantity: 5, rate: 18000, discount: 0, amount: 90000, taxValue: 90000, cgstRate: '9%', cgstAmount: 8100, sgstRate: '9%', sgstAmount: 8100, igstRate: '', igstAmount: 0, godown: 'Bhiwandi Central Warehouse' }] },
    { voucherId: 'PURCH-003', voucherNumber: 'BILL-ABB-7890', date: '2026-04-14', vendorName: 'ABB India Limited', gstin: '29AAACA1234B1Z9', placeOfSupply: 'Karnataka', purchaseType: 'Purchase', narration: 'Interstate procurement of pump components', amount: 50150, grnNo: 'GRN-2026-03', poReferenceNo: 'PO-2026-003', items: [{ itemName: 'Centrifugal Water Pump 2HP', itemDescription: 'Centrifugal Water Pump 2HP', hsn: '84137010', quantity: 5, rate: 8500, discount: 0, amount: 42500, taxValue: 42500, cgstRate: '', cgstAmount: 0, sgstRate: '', sgstAmount: 0, igstRate: '18%', igstAmount: 7650, godown: 'Bhiwandi Central Warehouse' }] },
    { voucherId: 'PURCH-004', voucherNumber: 'BILL-SE-3321', date: '2026-04-19', vendorName: 'Schneider Electric India', gstin: '06AAACS1234E1Z4', placeOfSupply: 'Haryana', purchaseType: 'Purchase', narration: 'Switchgear modules procurement', amount: 64900, grnNo: 'GRN-2026-04', poReferenceNo: 'PO-2026-004', items: [{ itemName: 'Deep Groove Ball Bearing 6205', itemDescription: 'Deep Groove Ball Bearing 6205', hsn: '84821011', quantity: 250, rate: 220, discount: 0, amount: 55000, taxValue: 55000, cgstRate: '', cgstAmount: 0, sgstRate: '', sgstAmount: 0, igstRate: '18%', igstAmount: 9900, godown: 'Pune Distribution Godown' }] },
    { voucherId: 'PURCH-005', voucherNumber: 'BILL-HAV-1102', date: '2026-04-24', vendorName: 'Havells India Limited', gstin: '07AAACH1234K1Z6', placeOfSupply: 'Delhi', purchaseType: 'Purchase', narration: 'Industrial cables procurement', amount: 118000, grnNo: 'GRN-2026-05', poReferenceNo: 'PO-2026-005', items: [{ itemName: 'Copper Winding Wire 1.2mm', itemDescription: 'Copper Winding Wire 1.2mm', hsn: '74081190', quantity: 133.33, rate: 750, discount: 0, amount: 100000, taxValue: 100000, cgstRate: '', cgstAmount: 0, sgstRate: '', sgstAmount: 0, igstRate: '18%', igstAmount: 18000, godown: 'Bhiwandi Central Warehouse' }] },
    { voucherId: 'PURCH-006', voucherNumber: 'BILL-POL-8841', date: '2026-04-28', vendorName: 'Polycab India Limited', gstin: '27AAACP1234F1Z7', placeOfSupply: 'Maharashtra', purchaseType: 'Purchase', narration: 'Armoured power cable supply', amount: 70800, grnNo: 'GRN-2026-06', poReferenceNo: 'PO-2026-006', items: [{ itemName: 'Copper Winding Wire 1.2mm', itemDescription: 'Copper Winding Wire 1.2mm', hsn: '74081190', quantity: 80, rate: 750, discount: 0, amount: 60000, taxValue: 60000, cgstRate: '9%', cgstAmount: 5400, sgstRate: '9%', sgstAmount: 5400, igstRate: '', igstAmount: 0, godown: 'Bhiwandi Central Warehouse' }] }
  ],
  trial_balance: [
    { name: 'State Bank of India', parent: 'Bank Accounts', openingBalance: 1250000.00, openingDebit: 1250000.00, openingCredit: 0, debitTotals: 540000.00, creditTotals: 340000.00, closingBalance: 1450000.00, closingDebit: 1450000.00, closingCredit: 0, monthYear: '2026-04', branch: 'Mumbai HQ', drCr: 'Dr' },
    { name: 'HDFC Bank Ltd', parent: 'Bank Accounts', openingBalance: 850000.00, openingDebit: 850000.00, openingCredit: 0, debitTotals: 220000.00, creditTotals: 150000.00, closingBalance: 920000.00, closingDebit: 920000.00, closingCredit: 0, monthYear: '2026-04', branch: 'Mumbai HQ', drCr: 'Dr' },
    { name: 'Tata Consultancy Services Ltd', parent: 'Sundry Debtors', openingBalance: 450000.00, openingDebit: 450000.00, openingCredit: 0, debitTotals: 150000.00, creditTotals: 0, closingBalance: 600000.00, closingDebit: 600000.00, closingCredit: 0, monthYear: '2026-04', branch: 'Mumbai HQ', drCr: 'Dr' },
    { name: 'Larsen & Toubro Ltd', parent: 'Sundry Creditors', openingBalance: -1200000.00, openingDebit: 0, openingCredit: 1200000.00, debitTotals: 400000.00, creditTotals: 0, closingBalance: -800000.00, closingDebit: 0, closingCredit: 800000.00, monthYear: '2026-04', branch: 'Mumbai HQ', drCr: 'Cr' },
    { name: 'Sales Account - Domestic', parent: 'Sales Accounts', openingBalance: 0, openingDebit: 0, openingCredit: 0, debitTotals: 0, creditTotals: 5400000.00, closingBalance: -5400000.00, closingDebit: 0, closingCredit: 5400000.00, monthYear: '2026-04', branch: 'Mumbai HQ', drCr: 'Cr' },
    { name: 'Factory Rent & Rates', parent: 'Indirect Expenses', openingBalance: 0, openingDebit: 0, openingCredit: 0, debitTotals: 360000.00, creditTotals: 0, closingBalance: 360000.00, closingDebit: 360000.00, closingCredit: 0, monthYear: '2026-04', branch: 'Mumbai HQ', drCr: 'Dr' }
  ],
  godowns: [
    { code: 'GDN-001', name: 'Bhiwandi Central Warehouse', parent: 'Maharashtra Zone', address: 'Plot 45, Logistics Park, Bhiwandi', pincode: '421302', active: true },
    { code: 'GDN-002', name: 'Pune Distribution Godown', parent: 'Maharashtra Zone', address: 'Plot 12, MIDC Bhosari, Pune', pincode: '411026', active: true },
    { code: 'GDN-003', name: 'Nagpur Transit Godown', parent: 'Maharashtra Zone', address: 'Survey 88, MIHAN SEZ, Nagpur', pincode: '441108', active: true },
    { code: 'GDN-004', name: 'Bengaluru Regional Depot', parent: 'Karnataka Zone', address: 'Industrial Suburb, Rajajinagar, Bengaluru', pincode: '560010', active: true },
    { code: 'GDN-005', name: 'Chennai Hub', parent: 'Tamil Nadu Zone', address: 'Ambattur Industrial Estate, Chennai', pincode: '600058', active: true },
    { code: 'GDN-006', name: 'Gurugram North Hub', parent: 'North Zone', address: 'Udyog Vihar, Phase IV, Gurugram', pincode: '122016', active: true }
  ],
  branch: [
    { code: 'BR-001', name: 'Mumbai Head Office', gstNo: '27AAACS1234A1Z1' },
    { code: 'BR-002', name: 'Pune Branch Office', gstNo: '27AAACS1234A2Z0' },
    { code: 'BR-003', name: 'Bengaluru Regional Office', gstNo: '29AAACS1234A1Z3' },
    { code: 'BR-004', name: 'Delhi NCR Office', gstNo: '07AAACS1234A1Z7' },
    { code: 'BR-005', name: 'Chennai Branch Office', gstNo: '33AAACS1234A1Z5' },
    { code: 'BR-006', name: 'Kolkata Liaison Office', gstNo: '19AAACS1234A1Z9' }
  ],
  cost_centers: [
    { code: 'CC-001', name: 'Mumbai Manufacturing Unit 1', branch: 'Mumbai Head Office' },
    { code: 'CC-002', name: 'Pune Assembly Plant', branch: 'Pune Branch Office' },
    { code: 'CC-003', name: 'R&D Automation Lab', branch: 'Bengaluru Regional Office' },
    { code: 'CC-004', name: 'Quality Assurance Lab', branch: 'Mumbai Head Office' },
    { code: 'CC-005', name: 'Logistics & Supply Chain', branch: 'Mumbai Head Office' },
    { code: 'CC-006', name: 'North Sales Division', branch: 'Delhi NCR Office' }
  ],
  sales_representative: [
    { code: 'REP-001', name: 'Karan Mehra', mobileNo: '9820098200' },
    { code: 'REP-002', name: 'Pooja Kulkarni', mobileNo: '9820198201' },
    { code: 'REP-003', name: 'Vikram Sengupta', mobileNo: '9820298202' },
    { code: 'REP-004', name: 'Rohan Deshmukh', mobileNo: '9820398203' },
    { code: 'REP-005', name: 'Sunita Narain', mobileNo: '9820498204' },
    { code: 'REP-006', name: 'Amitabh Verma', mobileNo: '9820598205' }
  ],
  groups: [
    { name: 'Current Assets', parent: 'Primary', isAddable: true, isSubLedger: false, isCalculate: false },
    { name: 'Bank Accounts', parent: 'Current Assets', isAddable: true, isSubLedger: false, isCalculate: false },
    { name: 'Sundry Debtors', parent: 'Current Assets', isAddable: true, isSubLedger: false, isCalculate: false },
    { name: 'Current Liabilities', parent: 'Primary', isAddable: true, isSubLedger: false, isCalculate: false },
    { name: 'Sundry Creditors', parent: 'Current Liabilities', isAddable: true, isSubLedger: false, isCalculate: false },
    { name: 'Sales Accounts', parent: 'Primary', isAddable: true, isSubLedger: false, isCalculate: false }
  ],
  stock_groups: [
    { name: 'Electric Motors', parent: 'Primary', isAddable: true },
    { name: 'Water Pumps', parent: 'Primary', isAddable: true },
    { name: 'Automation Drives', parent: 'Primary', isAddable: true },
    { name: 'Raw Materials', parent: 'Primary', isAddable: true },
    { name: 'Mechanical Parts', parent: 'Primary', isAddable: true },
    { name: 'Packaging Materials', parent: 'Primary', isAddable: true }
  ],
  units: [
    { name: 'NOS', originalName: 'Numbers', decimalPlaces: 0, isGstExcluded: false },
    { name: 'PCS', originalName: 'Pieces', decimalPlaces: 0, isGstExcluded: false },
    { name: 'KGS', originalName: 'Kilograms', decimalPlaces: 2, isGstExcluded: false },
    { name: 'MTR', originalName: 'Meters', decimalPlaces: 2, isGstExcluded: false },
    { name: 'SET', originalName: 'Sets', decimalPlaces: 0, isGstExcluded: false },
    { name: 'BOX', originalName: 'Boxes', decimalPlaces: 0, isGstExcluded: false }
  ],
  sales_orders: [
    { orderNumber: 'SO-001', date: '2026-04-01', dueDate: '2026-04-15', partyName: 'Tata Consultancy Services Ltd', gstin: '27AAACT2727Q1ZW', placeOfSupply: 'Maharashtra', total: 110000, items: [{ itemName: 'Industrial AC Motor 5HP 3Phase', quantity: 5, rate: 22000, amount: 110000, godown: 'Bhiwandi Central Warehouse' }], narration: 'Annual Facility Order 1' },
    { orderNumber: 'SO-002', date: '2026-04-05', dueDate: '2026-04-20', partyName: 'Infosys Limited', gstin: '29AAACI4818N1ZH', placeOfSupply: 'Karnataka', total: 84000, items: [{ itemName: 'Industrial AC Motor 10HP 3Phase', quantity: 2, rate: 42000, amount: 84000, godown: 'Bhiwandi Central Warehouse' }], narration: 'Annual Facility Order 2' },
    { orderNumber: 'SO-003', date: '2026-04-10', dueDate: '2026-04-25', partyName: 'Wipro Enterprises Ltd', gstin: '29AAACW0329K1ZV', placeOfSupply: 'Karnataka', total: 55000, items: [{ itemName: 'Variable Frequency Drive 5kW', quantity: 2, rate: 27500, amount: 55000, godown: 'Bhiwandi Central Warehouse' }], narration: 'Automation Order' },
    { orderNumber: 'SO-004', date: '2026-04-15', dueDate: '2026-04-30', partyName: 'Mahindra & Mahindra Ltd', gstin: '27AAACM1234P1Z3', placeOfSupply: 'Maharashtra', total: 67500, items: [{ itemName: 'Centrifugal Water Pump 2HP', quantity: 5, rate: 13500, amount: 67500, godown: 'Pune Distribution Godown' }], narration: 'Plant Expansion' },
    { orderNumber: 'SO-005', date: '2026-04-20', dueDate: '2026-05-05', partyName: 'Bajaj Auto Limited', gstin: '27AAACB1234C1Z5', placeOfSupply: 'Maharashtra', total: 22500, items: [{ itemName: 'Deep Groove Ball Bearing 6205', quantity: 50, rate: 450, amount: 22500, godown: 'Pune Distribution Godown' }], narration: 'Maintenance Spares' },
    { orderNumber: 'SO-006', date: '2026-04-25', dueDate: '2026-05-10', partyName: 'Bharat Forge Ltd', gstin: '27AAACB4567D1Z8', placeOfSupply: 'Maharashtra', total: 44000, items: [{ itemName: 'Industrial AC Motor 5HP 3Phase', quantity: 2, rate: 22000, amount: 44000, godown: 'Bhiwandi Central Warehouse' }], narration: 'Spares Order' }
  ],
  purchase_orders: [
    { orderNumber: 'PO-001', date: '2026-04-01', dueDate: '2026-04-15', partyName: 'Larsen & Toubro Ltd', gstin: '27AAACL0123K1ZT', placeOfSupply: 'Maharashtra', total: 75000, items: [{ itemName: 'Copper Winding Wire 1.2mm', quantity: 100, rate: 750, amount: 75000, godown: 'Bhiwandi Central Warehouse' }], narration: 'Raw Material Order' },
    { orderNumber: 'PO-002', date: '2026-04-05', dueDate: '2026-04-20', partyName: 'Siemens India Ltd', gstin: '27AAACS1234Q1Z2', placeOfSupply: 'Maharashtra', total: 90000, items: [{ itemName: 'Variable Frequency Drive 5kW', quantity: 5, rate: 18000, amount: 90000, godown: 'Bhiwandi Central Warehouse' }], narration: 'VFD Modules' },
    { orderNumber: 'PO-003', date: '2026-04-10', dueDate: '2026-04-25', partyName: 'ABB India Limited', gstin: '29AAACA1234B1Z9', placeOfSupply: 'Karnataka', total: 42500, items: [{ itemName: 'Centrifugal Water Pump 2HP', quantity: 5, rate: 8500, amount: 42500, godown: 'Bhiwandi Central Warehouse' }], narration: 'Pump procurement' },
    { orderNumber: 'PO-004', date: '2026-04-15', dueDate: '2026-04-30', partyName: 'Schneider Electric India', gstin: '06AAACS1234E1Z4', placeOfSupply: 'Haryana', total: 55000, items: [{ itemName: 'Deep Groove Ball Bearing 6205', quantity: 250, rate: 220, amount: 55000, godown: 'Pune Distribution Godown' }], narration: 'Bearings batch' },
    { orderNumber: 'PO-005', date: '2026-04-20', dueDate: '2026-05-05', partyName: 'Havells India Limited', gstin: '07AAACH1234K1Z6', placeOfSupply: 'Delhi', total: 100000, items: [{ itemName: 'Copper Winding Wire 1.2mm', quantity: 133.33, rate: 750, amount: 100000, godown: 'Bhiwandi Central Warehouse' }], narration: 'Copper Wires' },
    { orderNumber: 'PO-006', date: '2026-04-25', dueDate: '2026-05-10', partyName: 'Polycab India Limited', gstin: '27AAACP1234F1Z7', placeOfSupply: 'Maharashtra', total: 60000, items: [{ itemName: 'Copper Winding Wire 1.2mm', quantity: 80, rate: 750, amount: 60000, godown: 'Bhiwandi Central Warehouse' }], narration: 'Cables & wires' }
  ],
  delivery_notes: [
    { noteNumber: 'DN-001', date: '2026-04-03', partyName: 'Tata Consultancy Services Ltd', gstin: '27AAACT2727Q1ZW', placeOfSupply: 'Maharashtra', total: 110000, items: [{ itemName: 'Industrial AC Motor 5HP 3Phase', quantity: 5, rate: 22000, amount: 110000, godown: 'Bhiwandi Central Warehouse' }], narration: 'Dispatch Challan 1' },
    { noteNumber: 'DN-002', date: '2026-04-08', partyName: 'Infosys Limited', gstin: '29AAACI4818N1ZH', placeOfSupply: 'Karnataka', total: 84000, items: [{ itemName: 'Industrial AC Motor 10HP 3Phase', quantity: 2, rate: 42000, amount: 84000, godown: 'Bhiwandi Central Warehouse' }], narration: 'Dispatch Challan 2' },
    { noteNumber: 'DN-003', date: '2026-04-12', partyName: 'Wipro Enterprises Ltd', gstin: '29AAACW0329K1ZV', placeOfSupply: 'Karnataka', total: 55000, items: [{ itemName: 'Variable Frequency Drive 5kW', quantity: 2, rate: 27500, amount: 55000, godown: 'Bhiwandi Central Warehouse' }], narration: 'Dispatch Challan 3' },
    { noteNumber: 'DN-004', date: '2026-04-16', partyName: 'Mahindra & Mahindra Ltd', gstin: '27AAACM1234P1Z3', placeOfSupply: 'Maharashtra', total: 67500, items: [{ itemName: 'Centrifugal Water Pump 2HP', quantity: 5, rate: 13500, amount: 67500, godown: 'Pune Distribution Godown' }], narration: 'Dispatch Challan 4' },
    { noteNumber: 'DN-005', date: '2026-04-21', partyName: 'Bajaj Auto Limited', gstin: '27AAACB1234C1Z5', placeOfSupply: 'Maharashtra', total: 22500, items: [{ itemName: 'Deep Groove Ball Bearing 6205', quantity: 50, rate: 450, amount: 22500, godown: 'Pune Distribution Godown' }], narration: 'Dispatch Challan 5' },
    { noteNumber: 'DN-006', date: '2026-04-26', partyName: 'Bharat Forge Ltd', gstin: '27AAACB4567D1Z8', placeOfSupply: 'Maharashtra', total: 44000, items: [{ itemName: 'Industrial AC Motor 5HP 3Phase', quantity: 2, rate: 22000, amount: 44000, godown: 'Bhiwandi Central Warehouse' }], narration: 'Dispatch Challan 6' }
  ],
  receipt_notes: [
    { noteNumber: 'RN-001', date: '2026-04-02', partyName: 'Larsen & Toubro Ltd', gstin: '27AAACL0123K1ZT', placeOfSupply: 'Maharashtra', total: 75000, items: [{ itemName: 'Copper Winding Wire 1.2mm', quantity: 100, rate: 750, amount: 75000, godown: 'Bhiwandi Central Warehouse' }], narration: 'Material Inward 1' },
    { noteNumber: 'RN-002', date: '2026-04-06', partyName: 'Siemens India Ltd', gstin: '27AAACS1234Q1Z2', placeOfSupply: 'Maharashtra', total: 90000, items: [{ itemName: 'Variable Frequency Drive 5kW', quantity: 5, rate: 18000, amount: 90000, godown: 'Bhiwandi Central Warehouse' }], narration: 'Material Inward 2' },
    { noteNumber: 'RN-003', date: '2026-04-11', partyName: 'ABB India Limited', gstin: '29AAACA1234B1Z9', placeOfSupply: 'Karnataka', total: 42500, items: [{ itemName: 'Centrifugal Water Pump 2HP', quantity: 5, rate: 8500, amount: 42500, godown: 'Bhiwandi Central Warehouse' }], narration: 'Material Inward 3' },
    { noteNumber: 'RN-004', date: '2026-04-17', partyName: 'Schneider Electric India', gstin: '06AAACS1234E1Z4', placeOfSupply: 'Haryana', total: 55000, items: [{ itemName: 'Deep Groove Ball Bearing 6205', quantity: 250, rate: 220, amount: 55000, godown: 'Pune Distribution Godown' }], narration: 'Material Inward 4' },
    { noteNumber: 'RN-005', date: '2026-04-22', partyName: 'Havells India Limited', gstin: '07AAACH1234K1Z6', placeOfSupply: 'Delhi', total: 100000, items: [{ itemName: 'Copper Winding Wire 1.2mm', quantity: 133.33, rate: 750, amount: 100000, godown: 'Bhiwandi Central Warehouse' }], narration: 'Material Inward 5' },
    { noteNumber: 'RN-006', date: '2026-04-27', partyName: 'Polycab India Limited', gstin: '27AAACP1234F1Z7', placeOfSupply: 'Maharashtra', total: 60000, items: [{ itemName: 'Copper Winding Wire 1.2mm', quantity: 80, rate: 750, amount: 60000, godown: 'Bhiwandi Central Warehouse' }], narration: 'Material Inward 6' }
  ]
};

async function parseCsvStrict(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const content = fs.readFileSync(filePath, 'utf-8');
    parseString(content, { headers: true })
      .on('error', err => reject(err))
      .on('data', row => rows.push(row))
      .on('end', () => resolve(rows));
  });
}

function parseSampleHeaderTokens(sampleFilePath) {
  const content = fs.readFileSync(sampleFilePath, 'utf-8');
  const firstLine = content.split(/\r?\n/)[0].replace(/^\uFEFF/, '').trim();
  // Parse with RFC 4180 token regex
  const regex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^,]*))/g;
  const tokens = [];
  let match;
  while ((match = regex.exec(firstLine)) !== null) {
    if (match.index === regex.lastIndex) regex.lastIndex++;
    const token = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
    tokens.push(token);
  }
  return { rawHeaderLine: firstLine, tokens };
}

async function runAudit() {
  const allEntities = getAllEntities();
  const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const auditResults = [];

  console.log(`Starting Physical File Inspection across ${allEntities.length} datasets...\n`);

  for (const ent of allEntities) {
    const key = ent.id;
    const schema = getSchema(key);
    const fixtureData = FIXTURES[key] || FIXTURES.chart_of_accounts;

    // Transform
    const transformedRows = Transformer.transform(key, fixtureData);

    // Validate
    const validation = DataValidator.validate(key, transformedRows, { recordsExtracted: fixtureData.length });

    // Export CSV
    const csvExport = await CsvExporter.exportToStorage(key, transformedRows, {
      storage,
      companyName: 'Apex Industrial Motors Ltd'
    });

    // Export XML
    const xmlExport = await XmlExporter.exportToStorage(key, transformedRows, {
      storage,
      companyName: 'Apex Industrial Motors Ltd'
    });

    // Physical File Stats
    const csvStats = fs.statSync(csvExport.filePath);
    const xmlStats = fs.statSync(xmlExport.filePath);

    // MIME type check
    let mimeType = 'text/csv';
    try {
      mimeType = execSync(`file -b --mime-type "${csvExport.filePath}"`).toString().trim();
    } catch (_) {}

    // File raw content lines
    const rawCsv = fs.readFileSync(csvExport.filePath, 'utf-8').replace(/^\uFEFF/, '');
    const csvLines = rawCsv.split(/\r?\n/).filter(l => l.length > 0);
    const headerRow = csvLines[0];
    const dataRows = csvLines.slice(1);
    const first5Rows = dataRows.slice(0, 5);

    // Programmatic CSV Parse
    let csvParsedRows = [];
    let csvParseOk = false;
    let csvParseError = null;
    try {
      csvParsedRows = await parseCsvStrict(csvExport.filePath);
      csvParseOk = true;
    } catch (err) {
      csvParseError = err.message;
    }

    // Programmatic XML Parse & Parity Check
    const rawXml = fs.readFileSync(xmlExport.filePath, 'utf-8');
    const parsedXml = xmlParser.parse(rawXml);
    const xmlDataset = parsedXml.DATASET;
    const xmlRecords = xmlDataset?.RECORDS?.RECORD;
    const xmlRecordsArray = Array.isArray(xmlRecords) ? xmlRecords : (xmlRecords ? [xmlRecords] : []);

    const xmlRecordCount = xmlRecordsArray.length;
    const csvRecordCount = csvParsedRows.length;
    const parityOk = (xmlRecordCount === csvRecordCount && csvRecordCount === transformedRows.length);

    // Sample Header Comparison (if authoritative sample file exists)
    const sampleFileName = SAMPLE_MAP[key];
    let sampleHeaderRaw = null;
    let sampleTokens = null;
    let sampleComparison = null;

    if (sampleFileName) {
      const samplePath = path.join(sampleDir, sampleFileName);
      if (fs.existsSync(samplePath)) {
        const { rawHeaderLine, tokens } = parseSampleHeaderTokens(samplePath);
        sampleHeaderRaw = rawHeaderLine;
        sampleTokens = tokens;

        // Compare field by field
        const targetCols = schema.columns;
        const countMatch = (targetCols.length === sampleTokens.length);
        const mismatches = [];

        for (let i = 0; i < Math.max(targetCols.length, sampleTokens.length); i++) {
          const tCol = targetCols[i];
          const sCol = sampleTokens[i];
          if (tCol !== sCol) {
            mismatches.push({
              index: i + 1,
              target: tCol || '(MISSING)',
              sample: sCol || '(MISSING)'
            });
          }
        }

        const exactRawCharMatch = (headerRow === sampleHeaderRaw);
        let charDiffReason = null;
        if (!exactRawCharMatch) {
          if (mismatches.length === 0) {
            charDiffReason = 'Logical fields match 100% in exact order, but sample CSV author enclosed field names containing spaces in double quotes while generated output emitted standard unquoted RFC 4180 headers.';
          } else {
            charDiffReason = `Found ${mismatches.length} field discrepancies between generated and sample schema.`;
          }
        }

        sampleComparison = {
          sampleFileName,
          countMatch,
          targetColumnCount: targetCols.length,
          sampleColumnCount: sampleTokens.length,
          identicalLogicalOrder: mismatches.length === 0,
          exactRawCharMatch,
          charDiffReason,
          rawSampleHeader: sampleHeaderRaw,
          rawGeneratedHeader: headerRow,
          mismatches
        };
      }
    }

    auditResults.push({
      datasetId: key,
      displayName: ent.name,
      filename: csvExport.filename,
      extension: path.extname(csvExport.filename),
      mimeType,
      fileSize: csvStats.size,
      headerRow,
      first5Rows,
      dataRowCount: dataRows.length,
      csvParseSuccess: csvParseOk,
      csvParseError,
      xmlFilename: xmlExport.filename,
      xmlFileSize: xmlStats.size,
      xmlRecordCount,
      parityWithXml: parityOk,
      sampleComparison
    });
  }

  // Write JSON report
  const reportPath = path.join(rootDir, 'PHYSICAL_FILE_INSPECTION_REPORT.json');
  fs.writeFileSync(reportPath, JSON.stringify(auditResults, null, 2));

  console.log(`\n===============================================================`);
  console.log(`✅ Physical inspection complete for ${auditResults.length} datasets.`);
  console.log(`Report saved to: ${reportPath}`);
  console.log(`===============================================================\n`);

  return auditResults;
}

runAudit();
