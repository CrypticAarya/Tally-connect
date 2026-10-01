# Tally Connect Customer Pilot: First Export Guide

Congratulations on setting up your Tally Connect desktop connector. This guide walks you through generating and validating your very first automated data export from TallyPrime.

---

## 1. Verify Operational Readiness

Before triggering an export, open the Tally Connect Dashboard and check the **Customer Setup Checklist** card at the top:

```text
[✔] Tally Connected       - TallyPrime XML Server responsive on port 9000
[✔] Agent Installed       - Desktop agent provisioned
[✔] Connector Online      - Telemetry pulse verified within 30 seconds
[ ] First Export Completed - Pending your initial export run
```

Ensure all first three items are marked with green checkmarks.

---

## 2. Triggering Your First Export

We recommend starting with the **Customer Master** dataset to confirm ledger field mappings.

### Steps:
1. In the Dashboard under **Dataset Export Cockpit**, locate the **Customer Master** card (36 Standardized Columns).
2. Click **⚡ Export Customer Master**.
3. The button will indicate: `Extracting...`.
4. The system will switch to the **Export History** tab automatically.

---

## 3. Monitoring Export Execution Flow

Tally Connect executes exports through an asynchronous 5-stage pipeline:

```text
[1. Cloud Queue]      → Export job queued as PENDING
         ↓
[2. Desktop Agent]    → Agent polls and claims job (Status: PROCESSING)
         ↓
[3. TallyPrime Query] → Local TDL XML query executed on port 9000
         ↓
[4. Transformation]   → Hierarchical XML flattened into 36-column schema
         ↓
[5. Cloud Delivery]   → Streaming CSV uploaded & available for download (Status: COMPLETED)
```

- Standard master exports typically complete in **< 2 seconds**.
- Large transaction registers (100k+ rows) stream incrementally with bounded memory.

---

## 4. Previewing and Downloading the Output

Once the status badge turns **green (COMPLETED)**:

1. **Preview First 5 Rows**:
   - Click the **👁 Preview** button next to your completed job.
   - Inspect the normalized columns:
     - `Customer Name/Code`
     - `GSTIN` & `GST State Name`
     - `PAN`
     - `Credit Limit` & `Payment Terms`
     - `Primary Contact Email` & `Phone`
2. **Download Complete CSV**:
   - Click **⬇ Download CSV**.
   - Your browser will download the standardized file: e.g. `Customer_20260928_0197b.csv`.
3. **Open in Microsoft Excel or Google Sheets**:
   - Verify that columns are formatted with quotes, numbers have clean decimals without trailing symbols, and dates adhere to ISO `YYYY-MM-DD`.

---

## 5. Next Step: Exporting Sales Register with Date Filters

To export transaction invoices:
1. Go to the **Export History** tab.
2. Select **Sales Register** in the Target Dataset dropdown.
3. Choose your date range:
   - **From Date**: `2026-04-01`
   - **To Date**: `2026-09-30`
4. Click **⚡ Request Export**.
5. The exported CSV will contain item-level breakdown, HSN codes, CGST, SGST, IGST, and total invoice amounts.
