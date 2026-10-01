import { format } from 'fast-csv';
import { TallyXmlHttpAdapter } from '../server/src/adapters/tallyXmlHttpAdapter.js';
import { Transformer } from '../server/src/engine/transformer.js';
import { getSchema, normalizeDatasetKey } from '../server/src/engine/schemas.js';

/**
 * Formats flat objects into CSV string according to strict ordered headers
 */
function rowsToCsvString(columns, rows) {
  return new Promise((resolve, reject) => {
    let csvData = '';
    const csvStream = format({
      headers: columns,
      writeHeaders: true,
      quoteColumns: true
    });

    csvStream.on('data', chunk => {
      csvData += chunk;
    });
    csvStream.on('end', () => resolve(csvData));
    csvStream.on('error', err => reject(err));

    for (const row of rows) {
      const ordered = {};
      for (const col of columns) {
        ordered[col] = row[col] ?? '';
      }
      csvStream.write(ordered);
    }
    csvStream.end();
  });
}

export class JobProcessor {
  constructor({ cloudClient, tallyAdapter, config, pollIntervalSeconds = 10 }) {
    this.cloudClient = cloudClient;
    this.config = config;
    this.pollIntervalSeconds = pollIntervalSeconds;
    this.isProcessing = false;
    this.timer = null;

    // Use passed adapter or instantiate TallyXmlHttpAdapter with real connection
    this.tallyAdapter = tallyAdapter || new TallyXmlHttpAdapter({
      host: config.tallyHost || '127.0.0.1',
      port: config.tallyPort || 9000,
      fixtureFallback: process.env.TALLY_SIMULATE === 'true'
    });
  }

  /**
   * Executes a single export job through the pipeline:
   * Cloud Job -> TallyXmlHttpAdapter -> Transformer -> CsvExporter -> Upload to Cloud
   */
  async executeJob(job) {
    console.log(`\n[JobProcessor] === Processing Job: ${job.id} (${job.dataset}) ===`);

    try {
      // 1. Notify cloud that job is PROCESSING
      console.log(`[JobProcessor] 1/4 Updating status to PROCESSING in cloud...`);
      await this.cloudClient.updateJobStatus(job.id, {
        status: 'PROCESSING'
      });

      // 2. Validate dataset
      const datasetKey = normalizeDatasetKey(job.dataset);
      if (!datasetKey) {
        throw new Error(`Unsupported dataset type "${job.dataset}". Supported: CUSTOMER, CHART_OF_ACCOUNTS, SALES_REGISTER, TRIAL_BALANCE`);
      }
      const schema = getSchema(datasetKey);

      // 3. Query local TallyPrime via TallyXmlHttpAdapter
      console.log(`[JobProcessor] 2/4 Fetching ${datasetKey} data from local TallyPrime...`);
      let rawData = [];
      const filters = job.filters || {};

      switch (datasetKey) {
        case 'CUSTOMER':
          rawData = await this.tallyAdapter.fetchCustomers(filters);
          break;
        case 'CHART_OF_ACCOUNTS':
          rawData = await this.tallyAdapter.fetchChartOfAccounts(filters);
          break;
        case 'SALES_REGISTER':
          rawData = await this.tallyAdapter.fetchSalesRegister(filters);
          break;
        case 'TRIAL_BALANCE':
          rawData = await this.tallyAdapter.fetchTrialBalance(filters);
          break;
        default:
          throw new Error(`No handler implemented for ${datasetKey}`);
      }

      console.log(`[JobProcessor] 2/4 Retrieved ${rawData.length} raw records from Tally`);

      // 4. Transform hierarchical data into flat rows
      console.log(`[JobProcessor] 3/4 Transforming into standardized ${schema.columns.length}-column schema...`);
      const flatRows = Transformer.transform(datasetKey, rawData);
      console.log(`[JobProcessor] 3/4 Produced ${flatRows.length} normalized tabular rows`);

      // 5. Serialize into CSV
      console.log(`[JobProcessor] 4/4 Serializing to CSV and uploading to Cloud...`);
      const csvString = await rowsToCsvString(schema.columns, flatRows);
      const filename = `${schema.fileNamePrefix}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${job.id.slice(-5)}.csv`;

      // 6. Notify cloud of completion and deliver CSV
      const completeRes = await this.cloudClient.updateJobStatus(job.id, {
        status: 'COMPLETED',
        rowCount: flatRows.length,
        filename,
        csvContent: csvString,
        preview: flatRows.slice(0, 5)
      });

      if (!completeRes.success) {
        throw new Error(`Failed to upload completion to cloud: ${completeRes.error}`);
      }

      console.log(`[JobProcessor] ✔ Job ${job.id} successfully completed (${flatRows.length} rows, ${csvString.length} bytes uploaded)\n`);
      return { success: true, jobId: job.id, rowCount: flatRows.length };

    } catch (err) {
      console.error(`[JobProcessor] ✖ Job ${job.id} FAILED: ${err.message}`);
      
      // Report failure back to cloud
      await this.cloudClient.updateJobStatus(job.id, {
        status: 'FAILED',
        error: err.message
      }).catch(reportErr => {
        console.error(`[JobProcessor] Failed to report failure status: ${reportErr.message}`);
      });

      return { success: false, jobId: job.id, error: err.message };
    }
  }

  /**
   * Single polling cycle: requests pending jobs from the cloud
   */
  async pollOnce() {
    if (this.isProcessing) return;

    try {
      const result = await this.cloudClient.fetchPendingJobs();
      if (!result.success) {
        // Suppress repetitive network error noise during offline conditions
        return;
      }

      const pendingJobs = result.jobs || [];
      if (pendingJobs.length === 0) {
        return;
      }

      console.log(`[JobProcessor] Detected ${pendingJobs.length} pending job(s) from cloud.`);
      this.isProcessing = true;

      for (const job of pendingJobs) {
        await this.executeJob(job);
      }

    } catch (err) {
      console.error('[JobProcessor] Polling error:', err.message);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Starts periodic polling loop
   */
  start() {
    if (this.timer) return;

    // Run first poll shortly after start
    setTimeout(() => this.pollOnce(), 1000);

    this.timer = setInterval(() => {
      this.pollOnce();
    }, this.pollIntervalSeconds * 1000);

    console.log(`[JobProcessor] Job processor active (Polling cloud every ${this.pollIntervalSeconds}s)`);
  }

  /**
   * Stops polling loop
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[JobProcessor] Job processor stopped');
  }
}
