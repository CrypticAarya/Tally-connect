-- Tally Connect - MySQL Schema (Phase 2)
-- Universal Tally Integration Platform

CREATE TABLE IF NOT EXISTS saas_apps (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  api_key VARCHAR(64) NOT NULL UNIQUE,
  api_secret VARCHAR(255) NOT NULL,
  redirect_url VARCHAR(512),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_saas_api_key (api_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS connections (
  id VARCHAR(64) PRIMARY KEY,
  saas_app_id VARCHAR(64) NOT NULL,
  external_user_id VARCHAR(128) NOT NULL,
  company_name VARCHAR(255),
  agent_id VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  activation_code VARCHAR(16) UNIQUE,
  expiry_time TIMESTAMP NULL,
  last_sync TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (saas_app_id) REFERENCES saas_apps(id) ON DELETE CASCADE,
  INDEX idx_conn_saas_app (saas_app_id),
  INDEX idx_conn_ext_user (external_user_id),
  INDEX idx_conn_activation (activation_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agents (
  id VARCHAR(64) PRIMARY KEY,
  connection_id VARCHAR(64) NOT NULL,
  machine_name VARCHAR(255),
  status VARCHAR(32) NOT NULL DEFAULT 'OFFLINE',
  agent_token VARCHAR(255) NULL,
  last_heartbeat TIMESTAMP NULL,
  active_company VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE,
  INDEX idx_agent_conn (connection_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
  connection_id VARCHAR(64) PRIMARY KEY,
  allow_customers BOOLEAN NOT NULL DEFAULT TRUE,
  allow_vendors BOOLEAN NOT NULL DEFAULT TRUE,
  allow_sales BOOLEAN NOT NULL DEFAULT TRUE,
  allow_inventory BOOLEAN NOT NULL DEFAULT FALSE,
  allow_ledgers BOOLEAN NOT NULL DEFAULT TRUE,
  allow_orders BOOLEAN NOT NULL DEFAULT FALSE,
  allow_delivery_notes BOOLEAN NOT NULL DEFAULT FALSE,
  allow_receipt_notes BOOLEAN NOT NULL DEFAULT FALSE,
  allow_trial_balance BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sync_jobs (
  id VARCHAR(64) PRIMARY KEY,
  connection_id VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE,
  INDEX idx_sync_conn (connection_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS entity_cache (
  id VARCHAR(64) PRIMARY KEY,
  connection_id VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  data_json JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE,
  UNIQUE KEY uq_conn_entity (connection_id, entity_type),
  INDEX idx_entity_type (entity_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Phase 6: SaaS Developer Portal & Webhooks
CREATE TABLE IF NOT EXISTS developers (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dev_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS apps (
  id VARCHAR(64) PRIMARY KEY,
  developer_id VARCHAR(64) NULL,
  app_name VARCHAR(255) NOT NULL,
  api_key VARCHAR(64) NOT NULL UNIQUE,
  api_secret VARCHAR(255) NOT NULL,
  webhook_url VARCHAR(512) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (developer_id) REFERENCES developers(id) ON DELETE SET NULL,
  INDEX idx_apps_dev (developer_id),
  INDEX idx_apps_api_key (api_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webhook_logs (
  id VARCHAR(64) PRIMARY KEY,
  app_id VARCHAR(64) NOT NULL,
  event VARCHAR(64) NOT NULL,
  payload JSON NOT NULL,
  target_url VARCHAR(512) NOT NULL,
  status_code INT NULL,
  response_body TEXT NULL,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  attempts INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wh_app (app_id),
  INDEX idx_wh_event (event)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Phase 8: Production Hardening & API Usage Logs
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id VARCHAR(64) PRIMARY KEY,
  app_id VARCHAR(64) NULL,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(16) NOT NULL,
  response_status INT NOT NULL,
  duration_ms INT NOT NULL DEFAULT 0,
  ip_address VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_usage_app (app_id),
  INDEX idx_usage_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


