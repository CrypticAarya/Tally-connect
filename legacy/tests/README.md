# Legacy Historical Test Archive

This directory contains historical test scripts, pilot customer simulation runners, and early development validation benchmarks from Phases 1 through 13.

> [!NOTE]
> These tests document historical development and validation phases. They are not part of the active production regression suite.

---

## Active Test Suite Location

Active, maintained regression tests reside in the [`tests/`](file:///Users/eunoia/Desktop/Tally%20Connect/tests) directory:
- `tests/architecture/refactor-regression.test.js` — 14-point architecture verification
- `tests/external-saas/external-saas.test.js` — 25-check public SDK & developer experience suite
- `tests/security/security-hardening.test.js` — 16-check multi-tenant isolation suite
- `tests/integration/` — Sync worker, customer onboarding, developer portal suites
- `tests/agent/agent-lifecycle.test.js` — Daemon lifecycle, setup wizard, reboot resilience
- `tests/real-tally/real-tally-extraction.test.js` — Zero-mock live TallyPrime XML extraction
- `tests/release/production-readiness.test.js` — Health probes, environment audit, release validation

---

## Historical Files Inventory in this Archive

| Filename | Original Phase | Purpose |
| :--- | :---: | :--- |
| `testPhase1Migration.js` | Phase 1 | Initial XML adapter & TDL builder tests |
| `testPhase2SaasMigration.js` | Phase 2 | Initial MySQL schema & app management |
| `testPhase3Activation.js` | Phase 3 | Early customer connection & activation flow |
| `testPhase4AgentSimulation.js` | Phase 4 | Standalone binary startup & reboot recovery |
| `testPhase5SyncEngine.js` | Phase 5 | Permission reading & delta sync verification |
| `testPhase6DeveloperPortal.js` | Phase 6 | Developer registration, apps, webhooks |
| `testPhase7CustomerExperience.js` | Phase 7 | Customer onboarding, activation code & error catalog |
| `testPhase8ProductionReadiness.js` | Phase 8 | Multi-company simulation & export verification |
| `testPhase9WindowsCustomerTest.js` | Phase 9 | Windows customer setup validation |
| `testPhase10CleanProduction.js` | Phase 10 | Production architecture validation |
| `testPhase10_5CustomerValidation.js`| Phase 10.5 | Customer pilot validation scenarios |
| `testPhase11ProductionReadiness.js` | Phase 11 | Health probes, environment audit, release readiness |
| `testPhase11SecurityHardening.js` | Phase 11 | Multi-tenant isolation & rate limiting hardening |
| `testPhase12ExternalSaasIntegration.js` | Phase 12 | 25-check public external SaaS suite |
| `testRealTallyConnection.js` | Phase 8.5 | Zero-mock TallyPrime XML extraction |
| `productionHardeningSimulation.js` | Pilot | Multi-tenant customer load simulation |
| `realCustomerPilotSimulation.js` | Pilot | 10-pilot customer operational simulation |
| `finalBetaPilotTest.js` | Pilot | Beta customer test execution |
| `exportLoadTest.js` | Load Test | High-volume voucher & export streaming benchmark |
