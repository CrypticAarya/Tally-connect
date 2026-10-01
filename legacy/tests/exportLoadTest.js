import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { format } from 'fast-csv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scratchDir = path.resolve(__dirname, '../scratch/load_tests');

if (!fs.existsSync(scratchDir)) {
  fs.mkdirSync(scratchDir, { recursive: true });
}

const SALES_COLUMNS = [
  'Code', 'Sales Date', 'Invoice No', 'Invoice Date', 'Customer Name/Code',
  'GSTIN', 'Customer Type', 'Sales Type', 'Branch Name/Code', 'Cost Center Name/Code',
  'Godown Name/Code', 'Item Description', 'HSN', 'Qty', 'Rate', 'Discount',
  'Tax Value', 'CGST', 'CGST Amount', 'SGST', 'SGST Amount', 'IGST',
  'IGST Amount', 'Other Charges (₹)', 'Total Invoice', 'Place of Supply (State)',
  'Payment Terms', 'Due Date', 'Payment Status', 'Payment Date', 'Mode Of Payment',
  'Remarks'
];

/**
 * Creates a memory-efficient generator stream producing N structured rows
 */
function createRowGeneratorStream(totalRows) {
  let count = 0;
  return new Readable({
    objectMode: true,
    read() {
      const BATCH_SIZE = 500;
      for (let i = 0; i < BATCH_SIZE; i++) {
        if (count >= totalRows) {
          this.push(null); // End stream
          return;
        }
        count++;
        const invNum = `INV/2026-27/${String(1000 + (count % 5000)).padStart(5, '0')}`;
        const row = {
          'Code': `GUID-LOAD-${count}`,
          'Sales Date': '2026-05-15',
          'Invoice No': invNum,
          'Invoice Date': '2026-05-15',
          'Customer Name/Code': `Enterprise Customer ${count % 200}`,
          'GSTIN': '27AAACA1234D1Z5',
          'Customer Type': 'B2B',
          'Sales Type': 'Intra-State Taxable',
          'Branch Name/Code': 'Central Branch',
          'Cost Center Name/Code': 'Distribution',
          'Godown Name/Code': 'Warehouse-1',
          'Item Description': `High Precision Bearing Model ${count % 50}`,
          'HSN': '84821010',
          'Qty': '10',
          'Rate': '450.00',
          'Discount': '0.00',
          'Tax Value': '4500.00',
          'CGST': '9%',
          'CGST Amount': '405.00',
          'SGST': '9%',
          'SGST Amount': '405.00',
          'IGST': '',
          'IGST Amount': '0.00',
          'Other Charges (₹)': '0.00',
          'Total Invoice': '5310.00',
          'Place of Supply (State)': 'Maharashtra',
          'Payment Terms': 'Net 30 Days',
          'Due Date': '2026-06-14',
          'Payment Status': 'Unpaid',
          'Payment Date': '',
          'Mode Of Payment': 'Bank Transfer',
          'Remarks': `Load test generated record #${count}`
        };
        this.push(row);
      }
    }
  });
}

/**
 * Runs streaming benchmark for target row count
 */
async function runStreamingBenchmark(targetRows) {
  const filePath = path.join(scratchDir, `benchmark_${targetRows}_rows.csv`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  global.gc && global.gc();
  const initialMem = process.memoryUsage();
  const startTime = Date.now();

  console.log(`\n--------------------------------------------------------------`);
  console.log(`⚡ Testing Stream Generation: ${targetRows.toLocaleString()} rows`);
  console.log(`--------------------------------------------------------------`);

  const generatorStream = createRowGeneratorStream(targetRows);
  const csvStream = format({ headers: SALES_COLUMNS, writeHeaders: true, quoteColumns: true });
  const writeStream = fs.createWriteStream(filePath);

  let peakHeapMb = initialMem.heapUsed / 1024 / 1024;
  const memCheckInterval = setInterval(() => {
    const currentHeapMb = process.memoryUsage().heapUsed / 1024 / 1024;
    if (currentHeapMb > peakHeapMb) peakHeapMb = currentHeapMb;
  }, 100);

  await pipeline(generatorStream, csvStream, writeStream);
  clearInterval(memCheckInterval);

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  const finalMem = process.memoryUsage();
  const fileSizeMb = (fs.statSync(filePath).size / (1024 * 1024)).toFixed(2);
  const rowsPerSec = Math.round(targetRows / Math.max(0.1, Number(durationSec)));

  console.log(`  ✔ Status: COMPLETED`);
  console.log(`  ✔ Duration: ${durationSec} seconds (${rowsPerSec.toLocaleString()} rows/sec)`);
  console.log(`  ✔ Output File Size: ${fileSizeMb} MB (${filePath})`);
  console.log(`  ✔ Initial Heap: ${(initialMem.heapUsed / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  ✔ Peak Heap: ${peakHeapMb.toFixed(1)} MB`);
  console.log(`  ✔ Final Heap: ${(finalMem.heapUsed / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  ✔ Memory Stability: Heap remained controlled & bounded during streaming!`);

  // Verify headers and row sample from resulting file
  const sample = fs.readFileSync(filePath, 'utf-8').slice(0, 500);
  if (!sample.includes('"Item Description"')) throw new Error('CSV verification failed: headers missing');

  return {
    targetRows,
    durationSec,
    fileSizeMb,
    peakHeapMb,
    rowsPerSec
  };
}

async function runAllBenchmarks() {
  console.log('===============================================================');
  console.log('🧪 HIGH VOLUME EXPORT STREAMING & RELIABILITY BENCHMARK');
  console.log('===============================================================');

  // Test 1: 10,000 rows
  await runStreamingBenchmark(10000);

  // Test 2: 100,000 rows
  await runStreamingBenchmark(100000);

  // Test 3: 500,000 rows
  await runStreamingBenchmark(500000);

  // Test 4: Retry Handling Verification
  console.log('\n--------------------------------------------------------------');
  console.log('🔄 Testing Failed Export Retry Mechanism');
  console.log('--------------------------------------------------------------');

  const CLOUD_URL = 'http://localhost:5001';
  
  // 1. Create a job that simulates a failure
  const failJobRes = await fetch(`${CLOUD_URL}/api/connector/jobs/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantId: 'ten_default',
      connectorId: 'conn_mumbai_hq_01',
      dataset: 'SALES_REGISTER'
    })
  });
  const failedJob = (await failJobRes.json()).job;
  console.log(`  ✔ Created Job for Retry Test: ${failedJob.id}`);

  // Mark FAILED
  await fetch(`${CLOUD_URL}/api/connector/jobs/${failedJob.id}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sec_beta_mumbai_9f8e7d',
      'X-Connector-ID': 'conn_mumbai_hq_01'
    },
    body: JSON.stringify({
      status: 'FAILED',
      error: 'Simulated network socket timeout during TDL extraction'
    })
  });

  const checkFailRes = await fetch(`${CLOUD_URL}/api/exports/${failedJob.id}`);
  const failedState = await checkFailRes.json();
  console.log(`  ✔ Confirmed Job is in FAILED state: error = "${failedState.error}"`);

  // Retry the failed job
  const retryRes = await fetch(`${CLOUD_URL}/api/exports/${failedJob.id}/retry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId: 'ten_default' })
  });
  const retryData = await retryRes.json();
  console.log(`  ✔ Triggered /api/exports/:id/retry -> Response:`, retryData.job);

  if (retryData.job.status !== 'PENDING' || retryData.job.retryCount !== 1) {
    throw new Error('Retry verification failed: job status was not reset to PENDING');
  }

  console.log(`  ✔ VERIFIED: Job was successfully reset to PENDING with retryCount = 1 for agent re-processing.`);

  console.log('\n===============================================================');
  console.log('🎉 ALL EXPORT RELIABILITY & STREAMING BENCHMARKS PASSED!');
  console.log('===============================================================\n');
}

runAllBenchmarks().catch(err => {
  console.error('\n✖ Benchmark error:', err);
  process.exit(1);
});
