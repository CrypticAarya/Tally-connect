import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

import { TdlBuilder, getCompanyTag } from '../../connector-agent/src/adapters/tdlBuilder.js';
import { TallyXmlHttpAdapter } from '../../connector-agent/src/adapters/tallyXmlHttpAdapter.js';
import { ExtractionService } from '../../connector-agent/src/extraction/extractionService.js';
import { XmlExporter } from '../../connector-agent/src/export/xmlExporter.js';
import { LocalExportStorage } from '../../connector-agent/src/storage/localExportStorage.js';
import { ConnectorAgent } from '../../connector-agent/src/agent.js';
import { HeartbeatService } from '../../connector-agent/src/heartbeat.js';
import { TallyClient } from '../../connector-agent/src/tallyClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.resolve(__dirname, 'temp_identity_test');

const CLOUD_TENANT = 'Finlayer';
const LIVE_TALLY_COMPANY = 'Himalaya Overseas India';
const TEST_PORT = 9188;

let tallyServer = null;

function createMockTallyServer(port = TEST_PORT, companyName = LIVE_TALLY_COMPANY) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        // Probe for active company
        if (body.includes('ActiveCompaniesCollection')) {
          res.writeHead(200, { 'Content-Type': 'text/xml;charset=utf-8' });
          res.end(`
<ENVELOPE>
  <HEADER><VERSION>1</VERSION><STATUS>1</STATUS></HEADER>
  <BODY>
    <DATA>
      <COLLECTION>
        <COMPANY NAME="${companyName}">
          <NAME>${companyName}</NAME>
          <GUID>himalaya-guid-9999</GUID>
          <STARTINGFROM>20260401</STARTINGFROM>
          <ENDINGAT>20270331</ENDINGAT>
        </COMPANY>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>`.trim());
          return;
        }

        // Trial Balance request
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
  console.log('🧪 REGRESSION TEST: COMPANY IDENTITY & TENANT SEPARATION');
  console.log('===============================================================\n');

  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // -------------------------------------------------------------
    // Test 1: Config Migration (Legacy companyName -> tenantName)
    // -------------------------------------------------------------
    console.log('▶ Test 1: Configuration migration from legacy companyName to tenantName...');
    const legacyConfigPath = path.join(tempDir, 'config.json');
    fs.writeFileSync(legacyConfigPath, JSON.stringify({
      cloudUrl: 'http://127.0.0.1:5001',
      connectionId: 'conn_test_123',
      agentToken: 'token_abc12345678901234567890',
      companyName: CLOUD_TENANT // Legacy ambiguous field
    }, null, 2));

    const agent = new ConnectorAgent(legacyConfigPath);
    agent.loadConfig();

    assert.strictEqual(agent.config.tenantName, CLOUD_TENANT, 'Migrated legacy companyName to tenantName');
    assert.strictEqual(agent.config.companyName, undefined, 'Ambiguous companyName field deleted from config object');

    const migratedOnDisk = JSON.parse(fs.readFileSync(legacyConfigPath, 'utf-8'));
    assert.strictEqual(migratedOnDisk.tenantName, CLOUD_TENANT, 'tenantName written to disk');
    assert.strictEqual(migratedOnDisk.companyName, undefined, 'companyName removed from config.json on disk');
    console.log('  ✔ Config safely migrated: tenantName = "Finlayer", companyName purged');

    // -------------------------------------------------------------
    // Test 2: Start Mock Tally Server with LIVE company "Himalaya Overseas India"
    // -------------------------------------------------------------
    console.log('\n▶ Test 2: Live TallyPrime company detection...');
    tallyServer = await createMockTallyServer(TEST_PORT, LIVE_TALLY_COMPANY);

    const adapter = new TallyXmlHttpAdapter({ host: '127.0.0.1', port: TEST_PORT });
    const storage = new LocalExportStorage({ baseDir: tempDir });
    const extractionService = new ExtractionService({
      host: '127.0.0.1',
      port: TEST_PORT,
      exportStorage: storage
    });

    const companyInfo = await extractionService.detectActiveCompany();
    assert.strictEqual(companyInfo.companyName, LIVE_TALLY_COMPANY, `Live company detected matches: "${LIVE_TALLY_COMPANY}"`);
    assert.notStrictEqual(companyInfo.companyName, CLOUD_TENANT, `Company name is NOT tenant name "${CLOUD_TENANT}"`);
    console.log(`  ✔ Live Tally Company detected: "${companyInfo.companyName}"`);

    // -------------------------------------------------------------
    // Test 3: TDL Request <SVCurrentCompany> Binding
    // -------------------------------------------------------------
    console.log('\n▶ Test 3: TDL request explicit company binding...');
    const companyTag = getCompanyTag({ companyName: companyInfo.companyName });
    assert(companyTag.includes(`<SVCurrentCompany>${LIVE_TALLY_COMPANY}</SVCurrentCompany>`), 'TDL contains live company tag');
    assert(!companyTag.includes(CLOUD_TENANT), `TDL does NOT contain tenant name "${CLOUD_TENANT}"`);

    const tbReq = TdlBuilder.buildTrialBalanceRequest({ companyName: companyInfo.companyName });
    assert(tbReq.includes(`<SVCurrentCompany>${LIVE_TALLY_COMPANY}</SVCurrentCompany>`), 'Trial Balance TDL has live company tag');
    assert(!tbReq.includes(`<SVCurrentCompany>${CLOUD_TENANT}</SVCurrentCompany>`), 'Trial Balance TDL does NOT have Finlayer tag');
    console.log('  ✔ TDL correctly bound to <SVCurrentCompany>Himalaya Overseas India</SVCurrentCompany>');
    console.log('  ✔ Forbidden <SVCurrentCompany>Finlayer</SVCurrentCompany> verified absent');

    // -------------------------------------------------------------
    // Test 4: Extraction & Export Metadata
    // -------------------------------------------------------------
    console.log('\n▶ Test 4: Extraction and XML/CSV export company metadata...');
    const result = await extractionService.extractEntity('trial_balance', {
      format: 'both',
      companyName: companyInfo.companyName
    });

    assert.strictEqual(result.company, LIVE_TALLY_COMPANY, `Result company is "${LIVE_TALLY_COMPANY}"`);
    assert.notStrictEqual(result.company, CLOUD_TENANT, `Result company is NOT "${CLOUD_TENANT}"`);

    assert(fs.existsSync(result.xmlFilePath), 'XML file created');
    const xmlContent = fs.readFileSync(result.xmlFilePath, 'utf-8');
    assert(xmlContent.includes(`company="${LIVE_TALLY_COMPANY}"`), `XML metadata contains company="${LIVE_TALLY_COMPANY}"`);
    assert(!xmlContent.includes(`company="${CLOUD_TENANT}"`), `XML metadata does NOT contain company="${CLOUD_TENANT}"`);
    assert(!xmlContent.includes(`company="Finlayer"`), 'XML metadata has zero occurrences of "Finlayer"');
    console.log(`  ✔ XML export metadata verified: company="${LIVE_TALLY_COMPANY}"`);
    console.log('  ✔ Forbidden company="Finlayer" verified absent');

    // -------------------------------------------------------------
    // Test 5: Heartbeat Service Live vs Null
    // -------------------------------------------------------------
    console.log('\n▶ Test 5: Heartbeat telemetry live vs null...');
    const tallyClient = new TallyClient({ host: '127.0.0.1', port: TEST_PORT });
    const mockCloudClient = {
      sendHeartbeat: async (payload) => ({ success: true, payload })
    };

    const heartbeat = new HeartbeatService({
      tallyClient,
      cloudClient: mockCloudClient,
      config: agent.config,
      machineName: 'TEST-PC'
    });

    const pulse1 = await heartbeat.pulse();
    assert.strictEqual(pulse1.payload.activeCompany, LIVE_TALLY_COMPANY, 'Heartbeat reports live company');
    assert.notStrictEqual(pulse1.payload.activeCompany, CLOUD_TENANT, 'Heartbeat does NOT report tenant name');
    console.log(`  ✔ Heartbeat reports activeCompany="${LIVE_TALLY_COMPANY}"`);

    // -------------------------------------------------------------
    // Test 6: Zero Fallback when Tally is Offline / Unavailable
    // -------------------------------------------------------------
    console.log('\n▶ Test 6: Zero fallback when Tally is unreachable...');
    await new Promise((resolve) => tallyServer.close(resolve));
    tallyServer = null;

    let threwAsExpected = false;
    try {
      await extractionService.detectActiveCompany();
    } catch (err) {
      threwAsExpected = true;
      assert(err.code === 'TALLY_NOT_RUNNING' || err.message.includes('could not be reached'), `Proper error thrown: ${err.message}`);
    }
    assert(threwAsExpected, 'detectActiveCompany threw error when Tally unreachable');

    // Verify heartbeat with offline Tally sets activeCompany = null, NOT tenantName
    const offlinePulse = await heartbeat.pulse();
    assert.strictEqual(offlinePulse.payload.activeCompany, null, 'Offline heartbeat activeCompany is null');
    assert.notStrictEqual(offlinePulse.payload.activeCompany, CLOUD_TENANT, 'Offline heartbeat does NOT fall back to tenantName');
    assert.strictEqual(offlinePulse.payload.tallyStatus, 'OFFLINE', 'Offline heartbeat reports tallyStatus OFFLINE');
    console.log('  ✔ Zero silent fallback confirmed: Tally offline throws error and reports activeCompany=null');

    console.log('\n===============================================================');
    console.log('✅ ALL COMPANY IDENTITY & TENANT SEPARATION TESTS PASSED');
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
