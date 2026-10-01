# Tally Connect — Test Suite & Development Artifact Inventory
**Document Version:** 1.0.0  
**Phase:** Test Suite & Development Artifact Cleanup  
**Date:** October 2026  

---

## 1. Executive Summary

This inventory audits every test file, test runner script, package dependency, documentation reference, and development artifact across the **Tally Connect** codebase.

The repository accumulated test scripts across 14 historical development phases. Many of these historical scripts were left sitting at the project root (`testPhase*.js`) or as 1-line re-export stubs (`import './tests/testPhase*.js'`). 

This document classifies every file to establish an active test architecture and a historical archive under `legacy/tests/`.

---

## 2. Complete Test Files Inventory & Classification

| # | File Path | Current Location | Classification | Description & Dependency Status |
|---|---|---|:---:|---|
| 1 | `tests/architecture/refactor-regression.test.js` | `tests/architecture/` | **ACTIVE REGRESSION TEST** | 14-check refactor regression suite. Standalone, zero external test dependencies. |
| 2 | `tests/external-saas/external-saas.test.js` | `tests/external-saas/` | **ACTIVE REGRESSION TEST** | 25/25 public developer experience and SaaS integration suite. |
| 3 | `tests/security/security-hardening.test.js` | `tests/security/` | **ACTIVE REGRESSION TEST** | 16/16 multi-tenant isolation, key scoping, and rate limiting suite. |
| 4 | `tests/integration/sync-engine.test.js` | `tests/integration/` | **ACTIVE REGRESSION TEST** | 7/7 sync worker, delta extraction, and permission governance test. |
| 5 | `tests/integration/customer-connection.test.js` | `tests/integration/` | **ACTIVE REGRESSION TEST** | 7/7 customer onboarding, activation code, and error catalog test. |
| 6 | `tests/integration/developer-portal.test.js` | `tests/integration/` | **ACTIVE REGRESSION TEST** | 7/7 developer management, API key rotation, and webhook dispatch test. |
| 7 | `tests/agent/agent-lifecycle.test.js` | `tests/agent/` | **ACTIVE REGRESSION TEST** | 6/6 standalone agent daemon, activation wizard, and reboot recovery test. |
| 8 | `tests/real-tally/real-tally-extraction.test.js` | `tests/real-tally/` | **REAL TALLY TEST** | 8/8 zero-mock XML HTTP protocol verification against TallyPrime port 9000. |
| 9 | `testPhase11ProductionReadiness.js` | Root | **RELEASE TEST** | Full production deployment readiness test (health probes, env validation, MySQL integrity). To be housed in `tests/release/production-readiness.test.js`. |
| 10 | `testPhase1Migration.js` | Root | **OBSOLETE TEST** | 1-line stub re-exporting `tests/testPhase1Migration.js`. Safe to archive. |
| 11 | `tests/testPhase1Migration.js` | `tests/` | **HISTORICAL TEST** | Phase 1 initial XML adapter migration test. Superseded by active suites. |
| 12 | `testPhase2Migration.js` | Root | **OBSOLETE TEST** | 1-line stub re-exporting `tests/testPhase2SaasMigration.js`. Safe to archive. |
| 13 | `tests/testPhase2SaasMigration.js` | `tests/` | **HISTORICAL TEST** | Phase 2 initial MySQL database schema verification test. |
| 14 | `testPhase3Activation.js` | Root | **OBSOLETE TEST** | 1-line stub re-exporting `tests/testPhase3Activation.js`. Safe to archive. |
| 15 | `tests/testPhase3Activation.js` | `tests/` | **HISTORICAL TEST** | Phase 3 initial activation flow test. Superseded by `customer-connection.test.js`. |
| 16 | `testPhase4AgentSimulation.js` | Root | **HISTORICAL TEST** | Phase 4 agent simulation logic. Consolidate into `tests/agent/agent-lifecycle.test.js`. |
| 17 | `testPhase5SyncEngine.js` | Root | **HISTORICAL TEST** | Phase 5 sync engine logic. Consolidate into `tests/integration/sync-engine.test.js`. |
| 18 | `testPhase6DeveloperPortal.js` | Root | **HISTORICAL TEST** | Phase 6 dev portal logic. Consolidate into `tests/integration/developer-portal.test.js`. |
| 19 | `testPhase7CustomerExperience.js` | Root | **HISTORICAL TEST** | Phase 7 customer experience logic. Consolidate into `tests/integration/customer-connection.test.js`. |
| 20 | `testPhase8ProductionReadiness.js` | Root | **HISTORICAL TEST** | Phase 8 early production validation script. |
| 21 | `testPhase9WindowsCustomerTest.js` | Root | **HISTORICAL TEST** | Phase 9 Windows customer onboarding test. Superseded by active suites. |
| 22 | `tests/testPhase9WindowsCustomerTest.js` | `tests/` | **OBSOLETE TEST** | 1-line stub re-exporting `../testPhase9WindowsCustomerTest.js`. Safe to archive. |
| 23 | `testPhase10CleanProduction.js` | Root | **HISTORICAL TEST** | Phase 10 clean architecture validation test. |
| 24 | `tests/testPhase10CleanProduction.js` | `tests/` | **OBSOLETE TEST** | Exact duplicate of `testPhase10CleanProduction.js` in root. |
| 25 | `testPhase10_5CustomerValidation.js` | Root | **HISTORICAL TEST** | Phase 10.5 customer validation simulation. |
| 26 | `testPhase11SecurityHardening.js` | Root | **HISTORICAL TEST** | Phase 11 security hardening logic. Consolidate into `tests/security/security-hardening.test.js`. |
| 27 | `testPhase12ExternalSaasIntegration.js` | Root | **HISTORICAL TEST** | Phase 12 SaaS readiness logic. Consolidate into `tests/external-saas/external-saas.test.js`. |
| 28 | `testRealTallyConnection.js` | Root | **HISTORICAL TEST** | Phase 8.5 real Tally test logic. Consolidate into `tests/real-tally/real-tally-extraction.test.js`. |
| 29 | `tests/testRealTallyConnection.js` | `tests/` | **OBSOLETE TEST** | 1-line stub re-exporting `../testRealTallyConnection.js`. Safe to archive. |
| 30 | `tests/productionHardeningSimulation.js` | `tests/` | **HISTORICAL TEST** | Multi-company pilot customer simulation script from Phase 8. |
| 31 | `tests/realCustomerPilotSimulation.js` | `tests/` | **HISTORICAL TEST** | 10-pilot customer simulation script from Phase 9. |
| 32 | `tests/finalBetaPilotTest.js` | `tests/` | **HISTORICAL TEST** | Final beta customer pilot test script from Phase 10. |
| 33 | `tests/exportLoadTest.js` | `tests/` | **HISTORICAL TEST** | Large-scale CSV/data streaming benchmark script. |
| 34 | `tests/mock/agentXmlFixtures.js` | `tests/mock/` | **ACTIVE REGRESSION TEST** | XML mock fixtures used by tests when running in offline/CI mode. |
| 35 | `tests/mock/mockData.js` | `tests/mock/` | **ACTIVE REGRESSION TEST** | Normalized JSON mock datasets used by tests. |
| 36 | `tests/mock/xmlFixtures.js` | `tests/mock/` | **ACTIVE REGRESSION TEST** | Master XML fixtures used by adapters. |
| 37 | `tests/mock/mockTallyAdapter.js` | `tests/mock/` | **ACTIVE REGRESSION TEST** | Simulated Tally HTTP server used in offline test environments. |
| 38 | `scratch/test_phase14_external_developer.js` | `scratch/` | **HISTORICAL TEST** | Phase 14 external SaaS developer blind audit script. |

---

## 3. Dependency & Reference Mapping

### A. Scripts Referencing Tests:
- `tests/agent/agent-lifecycle.test.js` -> references `testPhase4AgentSimulation.js`
- `tests/integration/sync-engine.test.js` -> references `testPhase5SyncEngine.js`
- `tests/integration/customer-connection.test.js` -> references `testPhase7CustomerExperience.js`
- `tests/integration/developer-portal.test.js` -> references `testPhase6DeveloperPortal.js`
- `tests/security/security-hardening.test.js` -> references `testPhase11SecurityHardening.js`
- `tests/external-saas/external-saas.test.js` -> references `testPhase12ExternalSaasIntegration.js`
- `tests/real-tally/real-tally-extraction.test.js` -> references `testRealTallyConnection.js`

*Action Required:* Move full test implementations directly into the `tests/*/*.test.js` files so they become completely self-contained and no longer depend on root `testPhase*.js` files.

### B. `package.json` Scripts:
- Root `package.json`: No test scripts currently defined. We will add organized test runners (`npm test`, `npm run test:architecture`, `npm run test:security`, `npm run test:saas`, etc.).
- `server/package.json`: No references to test files.
- `connector-agent/package.json`: No references to test files.

### C. CI/CD Configurations:
- No `.github/workflows` or project-level CI/CD files exist.

### D. Documentation References:
- `README.md` references:
  - `tests/external-saas/external-saas.test.js`
  - `tests/security/security-hardening.test.js`
  - `tests/integration/sync-engine.test.js`
  - `tests/integration/customer-connection.test.js`
  - `tests/agent/agent-lifecycle.test.js`
  - `tests/real-tally/real-tally-extraction.test.js`
  - `tests/architecture/refactor-regression.test.js`
- Internal documentation files (`PHASE13_BASELINE.md`, `PHASE13_FINAL_REPORT.md`, `DEPENDENCY_MAP.md`, `REMOVED_CODE.md`) reference historical `testPhase*.js` files.

### E. Source Files Importing Tests:
- No files in `server/`, `connector-agent/`, or `sdk/` import any test files. Production runtime code is completely decoupled from tests.

---

## 4. Historical Documentation & Artifacts Inventory

The following documents represent internal engineering audits, milestones, and benchmark logs that should be consolidated under `docs/internal/`:
- `docs/PHASE13_BASELINE.md`
- `docs/PHASE13_FINAL_REPORT.md`
- `docs/PHASE_10A_PRODUCTION_READINESS_REPORT.md`
- `docs/PRODUCTION_DEPLOYMENT.md`
- `docs/DEPENDENCY_MAP.md`
- `docs/REMOVED_CODE.md`
- `docs/CODEBASE_MAP.md`
- `docs/WINDOWS_CUSTOMER_TESTER_GUIDE.md`
- `docs/customer-pilot/` (entire directory)
- `docs/pilot-framework/` (entire directory)

Public documentation that **MUST REMAIN** at the root of `docs/`:
- `docs/SAAS_DEVELOPER_QUICKSTART.md` (Main integration guide)
- `docs/ARCHITECTURE.md` (System architecture & data flow)
- `docs/TERMINOLOGY.md` (Standardized domain dictionary)
- `docs/CUSTOMER_INSTALLATION_FLOW.md` (End-user onboarding guide)
- `docs/TALLY_CONNECT_SDK.md` (SDK API reference)
- `docs/EXTERNAL_DEVELOPER_HANDOFF_AUDIT.md` (Phase 14 handoff audit)
