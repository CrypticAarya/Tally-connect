# Tally Connect: 14-Day Pilot Customer Onboarding Framework

This document outlines the standard operating procedure (SOP) for managing external customers through the **Tally Connect Beta Customer Pilot**.

```text
+-----------------------+     +-----------------------+     +-----------------------+     +-----------------------+
|        Day 0          |     |        Day 1          |     |        Week 1         |     |        Week 2         |
|     INSTALLATION      | --> |     FIRST EXPORT      | --> |     REVIEW USAGE      | --> |   COLLECT FEEDBACK    |
| - Account provisioned |     | - Master data extract |     | - Scheduled exports   |     | - Issue triage        |
| - Agent running       |     | - CSV verified        |     | - Performance audit   |     | - Feature requests    |
| - Heartbeat online    |     | - Export status done  |     | - Retention check     |     | - Graduation          |
+-----------------------+     +-----------------------+     +-----------------------+     +-----------------------+
```

---

## Stage 1: Day 0 — Installation & Host Pairing

**Primary Objective**: Get the Tally Connect Desktop Agent running as a background service and communicating with the cloud.

### Customer Actions:
1. Customer receives invitation email and logs into the Dashboard (`https://app.tallyconnect.cloud`).
2. Generates credentials in **Connectors** → **+ Provision New Connector** (`Connector ID` & `Secret Token`).
3. Downloads `TallyConnectAgentSetup.exe`.
4. Runs installer as Administrator on the Windows host running TallyPrime.
5. Verifies TallyPrime connectivity setting (`F1` → **Settings** → **Connectivity** → Port `9000`).

### Success Criteria:
- [ ] Connector status transitions to `ONLINE` on the Cloud Support Dashboard.
- [ ] Heartbeat frequency steady at 30-second intervals.
- [ ] Active company name correctly identified in telemetry.

---

## Stage 2: Day 1 — First Export & Data Verification

**Primary Objective**: Successfully trigger, process, and download the first structured CSV export.

### Customer Actions:
1. Open the **Dataset Export Cockpit** on the Dashboard.
2. Trigger the initial **Customer Master** export.
3. Observe execution pipeline: `PENDING` → `PROCESSING` → `COMPLETED`.
4. Preview the top 5 records in the Dashboard preview modal.
5. Download and verify the generated CSV in Microsoft Excel or Google Sheets.

### Success Criteria:
- [ ] Export status marked `COMPLETED` in `< 3 seconds` for master data.
- [ ] CSV columns match the 36-column standardized specification.
- [ ] Record count matches customer ledger count in TallyPrime.
- [ ] System automatically logs `csv_download` audit event and marks `firstExportAt`.

---

## Stage 3: Week 1 — Review Usage & Stress Validation

**Primary Objective**: Monitor multi-dataset synchronization, date-range filtering, and high-volume transaction registers.

### Key Milestones:
1. **Sales Register Extraction**:
   - Customer submits export request for 6 months of historical vouchers.
   - Verify unrolled inventory entries and multi-rate GST allocations (CGST, SGST, IGST).
2. **Trial Balance Validation**:
   - Customer extracts monthly trial balances.
   - Validate that total debit balances equal credit balances.
3. **Operational Stability Review**:
   - Review agent stability during machine sleep/restart and TallyPrime restarts.
   - Ensure dynamic offline detection triggers after 90 seconds of inactivity and recovers automatically.

### Success Criteria:
- [ ] 100% export success rate across all requested datasets.
- [ ] No heap memory exhaustion during large streaming exports (>100,000 rows).
- [ ] Zero unhandled socket disconnects.

---

## Stage 4: Week 2 — Feedback Collection & Pilot Graduation

**Primary Objective**: Collect structured qualitative and quantitative feedback, resolve edge-case issues, and prepare for commercial graduation.

### Structured Feedback Protocol:
The Tally Connect support team conducts a 20-minute pilot review meeting:

1. **Issue Reporting & Bug Triage**:
   - Capture any discrepancies in ledger groupings, tax classifications, or special characters.
   - Record in Support Portal via `POST /api/feedback` with severity level (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
2. **Feature Requests**:
   - Record customer-requested fields (e.g. custom voucher types, batch numbers, godown aliases).
3. **Performance Rating**:
   - Reliability: 1 to 5 score.
   - Speed of export: 1 to 5 score.
   - Ease of installation: 1 to 5 score.

### Graduation Criteria:
- [ ] 0 unresolved `HIGH` or `CRITICAL` issues.
- [ ] Minimum 5 successful exports executed and validated.
- [ ] Customer sign-off on data integrity.
