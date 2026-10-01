# Tally Connect — Documentation Directory

Welcome to the **Tally Connect** documentation directory. All platform guides, integration tutorials, API references, and architecture specifications are organized into canonical sections below.

---

## 🚀 1. Integration & Developer Guides
Essential reading for SaaS developers building integrations with Tally Connect:

| Document | Description |
| :--- | :--- |
| [**`docs/integration/QUICKSTART.md`**](integration/QUICKSTART.md) | **10-Minute Quickstart:** Register, create app, generate activation code, and fetch first data. |
| [**`docs/integration/DEVELOPER_DEMO.md`**](integration/DEVELOPER_DEMO.md) | **Comprehensive Walkthrough:** End-to-end integration guide with copy-pasteable backend & frontend code. |
| [**`docs/integration/SAAS_DEVELOPER_DEMO_SCRIPT.md`**](integration/SAAS_DEVELOPER_DEMO_SCRIPT.md) | **5-Minute Live Demo Script:** Script and screen guide for demonstrating Tally Connect to SaaS developers. |
| [**`sdk/README.md`**](../sdk/README.md) | **Node.js / TypeScript SDK:** Installation, configuration, helper functions, and method catalog. |

---

## 📡 2. API & Specifications
Complete protocol and schema documentation:

| Document | Description |
| :--- | :--- |
| [**`docs/api/API_REFERENCE.md`**](api/API_REFERENCE.md) | Full REST API specifications, developer authentication, connection sessions, query params, and HMAC-SHA256 webhooks. |

---

## 🏛️ 3. Architecture & System Design
High-level design, data flow diagrams, and standards:

| Document | Description |
| :--- | :--- |
| [**`docs/architecture/ARCHITECTURE.md`**](architecture/ARCHITECTURE.md) | System design, bidirectional flow, cloud caching model, and security isolation. |
| [**`docs/architecture/TERMINOLOGY.md`**](architecture/TERMINOLOGY.md) | Canonical naming rules, supported accounting entities, and forbidden synonyms. |

---

## 🖥️ 4. Windows Agent & Customer Experience
Documentation for the desktop client connecting to TallyPrime:

| Document | Description |
| :--- | :--- |
| [**`docs/customer/CUSTOMER_INSTALLATION_GUIDE.md`**](customer/CUSTOMER_INSTALLATION_GUIDE.md) | Plain-English, step-by-step setup guide for non-technical customer accountants. |
| [**`docs/customer/CUSTOMER_INSTALLATION_FLOW.md`**](customer/CUSTOMER_INSTALLATION_FLOW.md) | Detailed technical sequence diagram of the agent pairing, port 9000 discovery, and permission activation. |
| [**`connector-agent/README.md`**](../connector-agent/README.md) | Architecture, local development, building `.exe` installer, and daemon service management. |

---

## 🔒 5. Internal Engineering & Audit Reports
Internal team documentation, historical audits, and deployment runbooks:

| Document | Description |
| :--- | :--- |
| [**`docs/internal/README.md`**](internal/README.md) | Index of internal engineering baselines, deployment guides, and reports. |
| [**`docs/internal/CODEBASE_INVENTORY.md`**](internal/CODEBASE_INVENTORY.md) | Full inventory of active vs archived components. |
| [**`docs/internal/EXTERNAL_DEVELOPER_FRESH_CLONE_TEST.md`**](internal/EXTERNAL_DEVELOPER_FRESH_CLONE_TEST.md) | Phase 14 fresh-clone validation audit (115/115 checks passing). |
| [**`docs/internal/PRODUCTION_DEPLOYMENT.md`**](internal/PRODUCTION_DEPLOYMENT.md) | Production cloud provisioning runbook (Nginx, Systemd, MySQL 8.0, TLS). |
