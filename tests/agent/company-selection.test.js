import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

import { TdlBuilder, getCompanyTag } from '../../connector-agent/src/adapters/tdlBuilder.js';
import { TallyXmlHttpAdapter } from '../../connector-agent/src/adapters/tallyXmlHttpAdapter.js';
import { TallyXmlParser } from '../../connector-agent/src/adapters/xmlParser.js';
import { ExtractionSession } from '../../connector-agent/src/extraction/extractionSession.js';
import { ExtractionService } from '../../connector-agent/src/extraction/extractionService.js';
import { LocalExportStorage } from '../../connector-agent/src/storage/localExportStorage.js';
import { TallyClient } from '../../connector-agent/src/tallyClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.resolve(__dirname, 'temp_selection_test');

const CLOUD_TENANT = 'Finlayer';
const COMPANY_1 = 'Himalaya Overseas India';
const COMPANY_2 = 'ABC Traders Pvt Ltd';
const COMPANY_3 = 'XYZ Manufacturing Ltd';
const TEST_PORT = 9199;

let serverCompanies = [
  { name: COMPANY_1, guid: 'guid-himalaya-001', from: '20260401', to: '20270331' },
  { name: COMPANY_2, guid: 'guid-abc-002', from: '20260401', to: '20270331' },
  { name: COMPANY_3, guid: 'guid-xyz-003', from: '20260401', to: '20270331' }
];

let lastReceivedPayload = '';
let tallyServer = null;

function createMockTallyServer(port = TEST_PORT) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        lastReceivedPayload = body;

        // Company Discovery
        if (body.includes('ActiveCompaniesCollection')) {
          res.writeHead(200, { 'Content-Type': 'text/xml;charset=utf-8' });
          if (!serverCompanies || serverCompanies.length === 0) {
            res.end(`
<ENVELOPE>
  <HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER>
  <BODY><DATA><COLLECTION></COLLECTION></DATA></BODY>
</ENVELOPE>`.trim());
            return;
          }

          const xmlCompanies = serverCompanies.map(c => `
        <COMPANY NAME="${c.name}">
          <NAME>${c.name}</NAME>
          <GUID>${c.guid}</GUID>
          <STARTINGFROM>${c.from}</STARTINGFROM>
          <ENDINGAT>${c.to}</ENDINGAT>
        </COMPANY>`).join('');

          res.end(`
<ENVELOPE>
  <HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER>
  <BODY>
    <DATA>
      <COLLECTION>
        ${xmlCompanies}
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>`.trim());
          return;
        }

        // Trial Balance
        if (body.includes('TrialBalance')) {
          res.writeHead(200, { 'Content-Type': 'text/xml;charset=utf-8' });
          res.end(`
<ENVELOPE>
  <HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER>
  <BODY>
    <DATA>
      <DSPRECORD>
        <DSPACCNAME>Operating Capital</DSPACCNAME>
        <DSPGROUPNAME>Capital Account</DSPGROUPNAME>
        <DSPOPDRBAL>0.00</DSPOPDRBAL>
        <DSPOPCRBAL>1000000.00</DSPOPCRBAL>
        <DSPDRAMT>0.00</DSPDRAMT>
        <DSPCRAMT>0.00</DSPCRAMT>
        <DSPCLDRAMT>0.00</DSPCLDRAMT>
        <DSPCLCRAMT>1000000.00</DSPCLCRAMT>
      </DSPRECORD>
    </DATA>
  </BODY>
</ENVELOPE>`.trim());
          return;
        }

        // Default empty response
        res.writeHead(200, { 'Content-Type': 'text/xml;charset=utf-8' });
        res.end('<ENVELOPE><HEADER><STATUS>1</STATUS></HEADER><BODY><DATA></DATA></BODY></ENVELOPE>');
      });
    });

    server.listen(port, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

async function run() {
  console.log('===============================================================');
  console.log('🧪 TALLY CONNECT — REGRESSION SUITE: EXPLICIT COMPANY SELECTION');
  console.log('===============================================================\n');

  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    tallyServer = await createMockTallyServer(TEST_PORT);
    const adapter = new TallyXmlHttpAdapter({ host: '127.0.0.1', port: TEST_PORT });
    const storage = new LocalExportStorage({ baseDir: tempDir });
    const service = new ExtractionService({
      host: '127.0.0.1',
      port: TEST_PORT,
      exportStorage: storage
    });

    // -------------------------------------------------------------
    // Requirement 1: Multiple companies returned by Tally
    // -------------------------------------------------------------
    console.log('▶ Test 1: Multiple companies discovered from live TallyPrime response...');
    const companies = await service.getAvailableCompanies();
    assert.strictEqual(companies.length, 3, 'Discovered exactly 3 open companies from live Tally response');
    assert.strictEqual(companies[0].name, COMPANY_1, `First company is "${COMPANY_1}"`);
    assert.strictEqual(companies[1].name, COMPANY_2, `Second company is "${COMPANY_2}"`);
    assert.strictEqual(companies[2].name, COMPANY_3, `Third company is "${COMPANY_3}"`);
    console.log(`  ✔ Returned ${companies.length} live companies: ${companies.map(c => `"${c.name}"`).join(', ')}`);

    // -------------------------------------------------------------
    // Requirement 2: User selects Himalaya Overseas India
    // -------------------------------------------------------------
    console.log('\n▶ Test 2: User explicitly selects "Himalaya Overseas India"...');
    const selected = await service.selectCompany(COMPANY_1);
    assert.strictEqual(selected.name, COMPANY_1, `Selected company is "${COMPANY_1}"`);
    assert.strictEqual(service.getSelectedCompany(), COMPANY_1, `Session stores selectedCompany="${COMPANY_1}"`);
    console.log(`  ✔ In-memory session updated: selectedCompany = "${service.getSelectedCompany()}"`);

    // -------------------------------------------------------------
    // Requirement 3: Selected company is used in <SVCurrentCompany>
    // -------------------------------------------------------------
    console.log('\n▶ Test 3: Selected company is injected into <SVCurrentCompany> TDL tag...');
    await service.extractEntity('trial_balance');
    assert(lastReceivedPayload.includes(`<SVCurrentCompany>${COMPANY_1}</SVCurrentCompany>`),
      `TDL payload must include <SVCurrentCompany>${COMPANY_1}</SVCurrentCompany>`);
    console.log(`  ✔ Request verified: <SVCurrentCompany>${COMPANY_1}</SVCurrentCompany>`);

    // -------------------------------------------------------------
    // Requirement 4: Export metadata uses selected Tally company
    // -------------------------------------------------------------
    console.log('\n▶ Test 4: Export metadata (XML and CSV) uses selected Tally company...');
    const exportResult = await service.extractEntity('trial_balance', { format: 'both' });
    assert.strictEqual(exportResult.company, COMPANY_1, `Export result company is "${COMPANY_1}"`);
    assert(fs.existsSync(exportResult.xmlFilePath), 'XML export file exists');
    const xmlContent = fs.readFileSync(exportResult.xmlFilePath, 'utf-8');
    assert(xmlContent.includes(`company="${COMPANY_1}"`), `XML metadata contains company="${COMPANY_1}"`);
    console.log(`  ✔ Export metadata verified: company="${COMPANY_1}" in ${exportResult.filename}`);

    // -------------------------------------------------------------
    // Requirement 5: Finlayer never appears in Tally extraction context
    // -------------------------------------------------------------
    console.log('\n▶ Test 5: Verify cloud tenant "Finlayer" NEVER appears in Tally extraction context or export metadata...');
    assert(!lastReceivedPayload.includes(CLOUD_TENANT), `TDL payload must not contain "${CLOUD_TENANT}"`);
    assert(!xmlContent.includes(`company="${CLOUD_TENANT}"`), `Export metadata must not contain company="${CLOUD_TENANT}"`);
    assert(!xmlContent.includes(CLOUD_TENANT), `Export file must have ZERO occurrences of "${CLOUD_TENANT}"`);
    console.log(`  ✔ Zero contamination: "${CLOUD_TENANT}" is completely absent from TDL and export files`);

    // -------------------------------------------------------------
    // Requirement 6: User selects another company
    // -------------------------------------------------------------
    console.log('\n▶ Test 6: User selects another company ("ABC Traders Pvt Ltd")...');
    const selected2 = await service.selectCompany(COMPANY_2);
    assert.strictEqual(selected2.name, COMPANY_2, `Selected company switched to "${COMPANY_2}"`);
    assert.strictEqual(service.getSelectedCompany(), COMPANY_2, `Session stores selectedCompany="${COMPANY_2}"`);

    const exportResult2 = await service.extractEntity('trial_balance', { format: 'both' });
    assert.strictEqual(exportResult2.company, COMPANY_2, `Export result company is "${COMPANY_2}"`);
    assert(lastReceivedPayload.includes(`<SVCurrentCompany>${COMPANY_2}</SVCurrentCompany>`),
      `TDL payload updated to <SVCurrentCompany>${COMPANY_2}</SVCurrentCompany>`);
    const xmlContent2 = fs.readFileSync(exportResult2.xmlFilePath, 'utf-8');
    assert(xmlContent2.includes(`company="${COMPANY_2}"`), `XML metadata contains company="${COMPANY_2}"`);
    console.log(`  ✔ Switch successful: <SVCurrentCompany>${COMPANY_2}</SVCurrentCompany> and export metadata updated`);

    // -------------------------------------------------------------
    // Requirement 7 & 8: Tally company changes after selection -> Extraction stops & requires reselection
    // -------------------------------------------------------------
    console.log('\n▶ Test 7 & 8: Tally company changes after selection -> Halt immediately with COMPANY_CHANGED...');
    // Re-select Himalaya Overseas India
    await service.selectCompany(COMPANY_1);
    assert.strictEqual(service.getSelectedCompany(), COMPANY_1);

    // TallyPrime switches open companies: now only ABC Traders Pvt Ltd is open!
    serverCompanies = [
      { name: COMPANY_2, guid: 'guid-abc-002', from: '20260401', to: '20270331' }
    ];

    let changeDetected = false;
    try {
      // Extraction must detect switch and halt!
      await service.extractEntity('trial_balance');
    } catch (err) {
      changeDetected = true;
      assert.strictEqual(err.code, 'COMPANY_CHANGED', `Expected error code COMPANY_CHANGED, got ${err.code}`);
      assert(err.message.includes('Tally company changed'), 'Error message states Tally company changed');
      assert(err.message.includes(COMPANY_1), `Error message lists old company "${COMPANY_1}"`);
      assert(err.message.includes(COMPANY_2), `Error message lists new company "${COMPANY_2}"`);
      assert(err.message.includes('Please select the company again'), 'Prompts user to select company again');
      console.log('  ✔ Mismatch detected:\n' + err.message.split('\n').map(l => '     ' + l).join('\n'));
    }
    assert(changeDetected, 'Extraction halted immediately when company switched in TallyPrime');
    assert.strictEqual(service.getSelectedCompany(), null, 'Session invalidated: selectedCompany reset to null');
    console.log('  ✔ Session invalidated (selectedCompany = null). User forced to re-select.');

    // -------------------------------------------------------------
    // Requirement 9: Tally becomes unavailable
    // -------------------------------------------------------------
    console.log('\n▶ Test 9: Tally becomes unavailable (server closes)...');
    await new Promise(resolve => tallyServer.close(resolve));
    tallyServer = null;

    let offlineDetected = false;
    try {
      await service.getAvailableCompanies();
    } catch (err) {
      offlineDetected = true;
      assert.strictEqual(err.code, 'TALLY_NOT_RUNNING', `Expected code TALLY_NOT_RUNNING, got ${err.code}`);
      console.log(`  ✔ Correct offline error: ${err.code} - ${err.message}`);
    }
    assert(offlineDetected, 'getAvailableCompanies failed when Tally is offline');

    // -------------------------------------------------------------
    // Requirement 10: No fallback to previous company
    // -------------------------------------------------------------
    console.log('\n▶ Test 10: Zero fallback to previous company when Tally is offline...');
    assert.strictEqual(service.getSelectedCompany(), null, 'No previous company reused after failure');
    let noPreviousFallback = false;
    try {
      await service.extractEntity('trial_balance');
    } catch (err) {
      noPreviousFallback = true;
      assert(err.code === 'NO_COMPANY_SELECTED' || err.code === 'TALLY_NOT_RUNNING');
    }
    assert(noPreviousFallback, 'Extraction halted with no fallback to previous company');
    console.log('  ✔ Confirmed: No fallback to previous company');

    // -------------------------------------------------------------
    // Requirement 11: No fallback to tenantName
    // -------------------------------------------------------------
    console.log('\n▶ Test 11: Zero fallback to tenantName ("Finlayer")...');
    const tallyClient = new TallyClient({ host: '127.0.0.1', port: TEST_PORT });
    const offlineStatus = await tallyClient.checkStatus();
    assert.strictEqual(offlineStatus.online, false, 'Tally status is offline');
    assert.strictEqual(offlineStatus.activeCompany, null, 'Active company is strictly null');
    assert.notStrictEqual(offlineStatus.activeCompany, CLOUD_TENANT, `Active company is NOT "${CLOUD_TENANT}"`);
    console.log('  ✔ Confirmed: Offline status activeCompany is null, never "Finlayer"');

    // -------------------------------------------------------------
    // Requirement 12: Company list comes from live Tally response rather than fixtures
    // -------------------------------------------------------------
    console.log('\n▶ Test 12: Company list originates dynamically from live Tally rather than hardcoded fixtures...');
    // Restart mock server with a brand new, never-before-seen company name
    const DYNAMIC_NEW_COMPANY = 'Kailash Textiles International Corp';
    serverCompanies = [
      { name: DYNAMIC_NEW_COMPANY, guid: 'guid-dynamic-999', from: '20260401', to: '20270331' }
    ];
    tallyServer = await createMockTallyServer(TEST_PORT);

    const freshCompanies = await service.getAvailableCompanies();
    assert.strictEqual(freshCompanies.length, 1, 'Reflects live dynamic company list');
    assert.strictEqual(freshCompanies[0].name, DYNAMIC_NEW_COMPANY, `Discovered dynamic live company: "${DYNAMIC_NEW_COMPANY}"`);

    // Verify rejecting any non-existent company
    let rejectedInvalid = false;
    try {
      await service.selectCompany('NonExistent Company Name');
    } catch (err) {
      rejectedInvalid = true;
      assert.strictEqual(err.code, 'COMPANY_NOT_FOUND', `Expected COMPANY_NOT_FOUND, got ${err.code}`);
      assert(err.message.includes(DYNAMIC_NEW_COMPANY), 'Error message lists currently available live companies');
    }
    assert(rejectedInvalid, 'Rejected manually supplied company that does not exist in live Tally');

    // Select dynamic new company and extract
    await service.selectCompany(DYNAMIC_NEW_COMPANY);
    const dynamicResult = await service.extractEntity('trial_balance', { format: 'csv' });
    assert.strictEqual(dynamicResult.company, DYNAMIC_NEW_COMPANY);
    assert(lastReceivedPayload.includes(`<SVCurrentCompany>${DYNAMIC_NEW_COMPANY}</SVCurrentCompany>`));
    console.log(`  ✔ Confirmed: Dynamic company "${DYNAMIC_NEW_COMPANY}" accepted and injected into <SVCurrentCompany>`);

    console.log('\n===============================================================');
    console.log('✅ ALL 12 EXPLICIT COMPANY SELECTION REGRESSION TESTS PASSED');
    console.log('===============================================================\n');
  } finally {
    if (tallyServer) {
      await new Promise(resolve => tallyServer.close(resolve));
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

run().catch(err => {
  console.error('\n❌ Test Failed:', err);
  if (tallyServer) tallyServer.close();
  process.exit(1);
});
