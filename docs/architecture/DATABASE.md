# Tally Connect — Database Architecture & Dual-Database Analysis
**Document Version:** 1.0.0  
**Phase:** External Developer Handoff Cleanup  
**Date:** October 2026  
**Status:** Canonical Reference  

---

## 1. Executive Summary

Tally Connect currently contains code references to two relational database management systems: **MySQL** and **PostgreSQL**.

- **MySQL (Active Production Database):**  
  Powering 100% of active SaaS integration features: developer registration, multi-tenant application management, customer connection sessions, activation code replay protection, customer data permission enforcement, desktop agent heartbeats, asynchronous sync jobs, normalized entity caching, and HMAC-signed webhook delivery logs.
- **PostgreSQL (Legacy Prototype Database):**  
  Originating from early single-tenant prototypes (Phases 1–3) for manual CSV export jobs and internal pilot tracking. It is **not** used by the active SaaS REST API (`/api/v1/*`), developer portal, or modern desktop sync worker.

---

## 2. Table-by-Table Mapping Matrix

| Table Name | Database | Engine / Component | Active vs. Legacy | Purpose & Responsibility |
|:---|:---:|:---|:---:|:---|
| `developers` | **MySQL** | `server/src/db/saasRepository.js` | **ACTIVE PRODUCTION** | Developer accounts (email, password hash, company name). |
| `saas_apps` | **MySQL** | `server/src/db/saasRepository.js` | **ACTIVE PRODUCTION** | Registered SaaS apps (`tc_live_...` API keys, secrets, webhooks). |
| `connections` | **MySQL** | `server/src/db/saasRepository.js` | **ACTIVE PRODUCTION** | Customer connection sessions (`conn_...`, Tally company name, status). |
| `agent_sessions` | **MySQL** | `server/src/db/saasRepository.js` | **ACTIVE PRODUCTION** | Linked Windows desktop agents (`agt_...`, `agt_tok_...` hash). |
| `activation_codes` | **MySQL** | `server/src/db/saasRepository.js` | **ACTIVE PRODUCTION** | 6-character activation codes (`TC-XXXX`, expiration, replay protection). |
| `customer_permissions` | **MySQL** | `server/src/services/permissionService.js` | **ACTIVE PRODUCTION** | Per-connection entity permission toggles (customers, vendors, inventory, etc.). |
| `sync_jobs` | **MySQL** | `server/src/queue/jobQueue.js` | **ACTIVE PRODUCTION** | On-demand and scheduled entity sync jobs dispatched to agents. |
| `entity_cache` | **MySQL** | `server/src/db/saasRepository.js` | **ACTIVE PRODUCTION** | High-performance JSON cache of extracted Tally accounting records. |
| `webhook_logs` | **MySQL** | `server/src/services/webhookService.js` | **ACTIVE PRODUCTION** | Delivery audit trail for HMAC-SHA256 signed event webhooks. |
| `api_usage_logs` | **MySQL** | `server/src/middleware/apiUsageTracker.js` | **ACTIVE PRODUCTION** | Rate-limiting and API access telemetry logs. |
| `tenants` | **PostgreSQL** | `server/src/db/index.js` | **LEGACY ARCHIVE** | Early Phase 1 tenant identifier table. |
| `users` | **PostgreSQL** | `server/src/db/index.js` | **LEGACY ARCHIVE** | Early Phase 2 single-tenant admin user store. |
| `sessions` | **PostgreSQL** | `server/src/db/index.js` | **LEGACY ARCHIVE** | Cookie-based web session table. |
| `connectors` | **PostgreSQL** | `server/src/db/index.js` | **LEGACY ARCHIVE** | Phase 1-3 hardcoded connector registry. |
| `exportJobs` | **PostgreSQL** | `server/src/db/index.js` | **LEGACY ARCHIVE** | Historical manual CSV file generation jobs. |
| `audit_logs` | **PostgreSQL** | `server/src/db/index.js` | **LEGACY ARCHIVE** | Early prototype CSV download audit logs. |
| `pilot_customers` | **PostgreSQL** | `server/src/db/index.js` | **LEGACY ARCHIVE** | Historical manual CRM tracking table from Phase 3. |
| `customer_feedback` | **PostgreSQL** | `server/src/db/index.js` | **LEGACY ARCHIVE** | Historical issue feedback table from Phase 3. |

---

## 3. Runtime Verification & Dependencies

1. **MySQL Connectivity:**  
   Managed via `mysql2/promise` in [`server/src/db/mysql.js`](file:///Users/eunoia/Desktop/Tally%20Connect/server/src/db/mysql.js). All tests, services, controllers, and middleware connect exclusively to MySQL via `pool` export.
2. **PostgreSQL Connectivity:**  
   Managed via `pg` in [`server/src/db/index.js`](file:///Users/eunoia/Desktop/Tally%20Connect/server/src/db/index.js). Only invoked if `initDb()` is called from legacy scripts.
3. **Recommendation:**  
   PostgreSQL is retained in `server/src/db/index.js` to preserve backward compatibility for historical simulations, but is marked as **LEGACY**. Future production deployments require only MySQL 8.0+.
