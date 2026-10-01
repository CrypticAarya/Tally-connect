# Tally Connect — Production Deployment & Operations Guide

**Version:** 1.0.0 (Production Release)  
**Target Environment:** Ubuntu 22.04 LTS / Debian 12 / Enterprise Linux (x64)  
**Architecture:** Node.js Backend API + MySQL 8.0 Database + Nginx Reverse Proxy + PM2 Process Manager + Outbound-Only Windows Desktop Agent  

---

## 1. System Requirements & Architecture Topology

```mermaid
graph TD
    ClientApp[🌐 SaaS Platform / Web App] -->|HTTPS :443| Nginx[🛡️ Nginx Reverse Proxy / SSL Termination]
    WinAgent[💻 Windows Desktop Agent<br/>Runs on Customer PC] -->|HTTPS :443 Outbound| Nginx
    
    subgraph Host Server ["Ubuntu 22.04 LTS Production Server"]
        Nginx -->|Reverse Proxy :5000| PM2[⚡ PM2 Process Cluster]
        PM2 --> AppInstance1[Node.js Instance 1]
        PM2 --> AppInstance2[Node.js Instance 2]
        AppInstance1 -->|Local Socket / TCP :3306| MySQL[(🗄️ MySQL 8.0 Database)]
        AppInstance2 -->|Local Socket / TCP :3306| MySQL
    end
```

### Hardware Specifications

| Tier | Concurrent Agents | vCPU | RAM | SSD Storage | Network |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Minimum** | Up to 100 | 2 vCPU | 4 GB | 50 GB NVMe | 1 Gbps |
| **Standard (Recommended)** | Up to 1,000 | 4 vCPU | 8 GB | 150 GB NVMe | 1 Gbps |
| **High Availability** | 5,000+ | 8 vCPU | 16 GB | 500 GB NVMe | 10 Gbps |

### Network & Firewall Rules

| Port | Protocol | Source | Destination | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **443** | TCP | 0.0.0.0/0 (Public) | Server | Public HTTPS API, Webhooks & Desktop Agent Ingress |
| **80** | TCP | 0.0.0.0/0 (Public) | Server | HTTP to HTTPS redirection & Let's Encrypt validation |
| **22** | TCP | Admin IPs / Bastion | Server | SSH Administrative Access |
| **3306** | TCP | Localhost (127.0.0.1) | Server | Internal MySQL Database (Never expose to public) |
| **5000** | TCP | Localhost (127.0.0.1) | Server | Internal Node.js API Service |

---

## 2. Server Setup & Node.js Installation

### Step 2.1: Update System Packages
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential ufw software-properties-common fail2ban
```

### Step 2.2: Install Node.js LTS (v20.x or v22.x)
```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js and verify
sudo apt install -y nodejs
node -v    # Expected: v20.x.x
npm -v     # Expected: 10.x.x
```

### Step 2.3: Install PM2 Globally
```bash
sudo npm install -g pm2
pm2 -v
```

### Step 2.4: Create Non-Root Service User
```bash
sudo useradd -m -s /bin/bash tally
sudo usermod -aG sudo tally
```

---

## 3. MySQL 8.0 Setup & Hardening

### Step 3.1: Install MySQL Server
```bash
sudo apt install -y mysql-server
sudo systemctl enable mysql
sudo systemctl start mysql
```

### Step 3.2: Secure MySQL Installation
```bash
sudo mysql_secure_installation
```
- Disallow root login remotely: **Yes**
- Remove anonymous users: **Yes**
- Remove test database: **Yes**
- Reload privilege tables: **Yes**

### Step 3.3: Create Production Database & User
Log into MySQL as root:
```bash
sudo mysql -u root
```

Execute SQL commands:
```sql
-- Create production database with full UTF-8 support
CREATE DATABASE tally_connect_prod 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

-- Create dedicated production application user
CREATE USER 'tally_connect_user'@'localhost' 
  IDENTIFIED BY 'ChangeThisToAStrongRandomPassword123!';

-- Grant required schema privileges
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER, REFERENCES 
  ON tally_connect_prod.* 
  TO 'tally_connect_user'@'localhost';

FLUSH PRIVILEGES;
EXIT;
```

### Step 3.4: Tune MySQL for High Concurrency (`/etc/mysql/mysql.conf.d/mysqld.cnf`)
```ini
[mysqld]
bind-address           = 127.0.0.1
max_connections        = 250
wait_timeout           = 300
interactive_timeout    = 300
innodb_buffer_pool_size = 2G      # Set to ~50% of available RAM
innodb_log_file_size   = 256M
innodb_flush_log_at_trx_commit = 2
```
Restart MySQL:
```bash
sudo systemctl restart mysql
```

---

## 4. Application Deployment & Environment Configuration

### Step 4.1: Deploy Codebase
```bash
# Target deployment folder
sudo mkdir -p /var/www/tally-connect
sudo chown -R tally:tally /var/www/tally-connect

# Switch to tally user
sudo -u tally -i
cd /var/www/tally-connect

# Clone or deploy repository
git clone <YOUR_GIT_REPO_URL> .
npm run install:all
```

### Step 4.2: Configure `.env.production`
Create `/var/www/tally-connect/server/.env.production`:
```bash
nano /var/www/tally-connect/server/.env.production
```

Add production variables:
```ini
# ==============================================================================
# Tally Connect — Production Configuration
# ==============================================================================
NODE_ENV=production
PORT=5000
HOST=127.0.0.1

# ------------------------------------------------------------------------------
# API Domain & Public Endpoints
# ------------------------------------------------------------------------------
API_DOMAIN=api.tallyconnect.cloud
API_URL=https://api.tallyconnect.cloud
AGENT_CLOUD_URL=https://api.tallyconnect.cloud
CLIENT_URL=https://app.tallyconnect.cloud

# ------------------------------------------------------------------------------
# Database Connection (Unified DATABASE_URL or discrete fields)
# ------------------------------------------------------------------------------
DATABASE_URL=mysql://tally_connect_user:ChangeThisToAStrongRandomPassword123!@127.0.0.1:3306/tally_connect_prod
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=tally_connect_user
MYSQL_PASSWORD=ChangeThisToAStrongRandomPassword123!
MYSQL_DATABASE=tally_connect_prod

# ------------------------------------------------------------------------------
# Security, JWT & Cryptographic Secrets (Generate with crypto.randomBytes(32))
# ------------------------------------------------------------------------------
API_MASTER_SECRET=1f84b609c2a74c10a30b5030e46249de6f2c398e0965d1d64389658f8b0542ab
JWT_SECRET=8e9b678c2e645934524419de748c9735d4b532788e0db432a938210356194b1a
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
WEBHOOK_SIGNING_SECRET=c9b0e12738c6418fa90562e3d81b4129

# ------------------------------------------------------------------------------
# Object Storage (Local directory or AWS S3 / Cloud Storage)
# ------------------------------------------------------------------------------
STORAGE_PROVIDER=local
STORAGE_BUCKET=tally-connect-production
STORAGE_LOCAL_DIR=/var/www/tally-connect/server/storage/exports

# ------------------------------------------------------------------------------
# Rate Limiting & Queue Concurrency
# ------------------------------------------------------------------------------
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=120
QUEUE_CONCURRENCY=10
QUEUE_POLL_INTERVAL_MS=2000
QUEUE_MAX_RETRIES=5
```

Lock down permissions:
```bash
chmod 600 /var/www/tally-connect/server/.env.production
```

---

## 5. PM2 Process Management

### Step 5.1: Create PM2 Ecosystem File (`ecosystem.config.cjs`)
Create `/var/www/tally-connect/ecosystem.config.cjs`:
```javascript
module.exports = {
  apps: [
    {
      name: 'tally-connect-api',
      script: './server/src/index.js',
      instances: 'max',               // Utilize all available CPU cores
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      max_memory_restart: '1G',
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      listen_timeout: 8000,
      kill_timeout: 5000,
      error_file: '/var/log/tally-connect/error.log',
      out_file: '/var/log/tally-connect/out.log',
      merge_logs: true,
      time: true
    }
  ]
};
```

### Step 5.2: Create Log Directory
```bash
sudo mkdir -p /var/log/tally-connect
sudo chown -R tally:tally /var/log/tally-connect
```

### Step 5.3: Start & Enable Service on Boot
```bash
# Start cluster with production profile
pm2 start ecosystem.config.cjs --env production

# Verify cluster status
pm2 status
pm2 logs tally-connect-api --lines 20

# Save process list and register systemd service
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u tally --hp /home/tally
```

---

## 6. Nginx Reverse Proxy Configuration

### Step 6.1: Install Nginx
```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

### Step 6.2: Create Site Configuration
Create `/etc/nginx/sites-available/tally-connect.conf`:
```nginx
# Rate Limiting Zone
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/s;

upstream tally_backend {
    server 127.0.0.1:5000;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name api.tallyconnect.cloud;

    # Let's Encrypt ACME challenge directory
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all HTTP traffic to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.tallyconnect.cloud;

    # SSL Certificates (managed via Certbot)
    ssl_certificate /etc/letsencrypt/live/api.tallyconnect.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.tallyconnect.cloud/privkey.pem;

    # Modern TLS Security Parameters
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Support high payload sizes for batch ledger/inventory syncs
    client_max_body_size 50M;
    client_body_buffer_size 128k;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;

    # Proxy to Node.js Backend Cluster
    location / {
        limit_req zone=api_limit burst=50 nodelay;

        proxy_pass http://tally_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }
}
```

### Step 6.3: Enable Site & Test Syntax
```bash
sudo ln -sf /etc/nginx/sites-available/tally-connect.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. SSL Certificate Setup (Let's Encrypt Certbot)

### Step 7.1: Install Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Step 7.2: Obtain & Install Certificate
```bash
sudo certbot --nginx -d api.tallyconnect.cloud --non-interactive --agree-tos -m admin@tallyconnect.cloud
```

### Step 7.3: Verify Automatic Renewal
```bash
sudo certbot renew --dry-run
```
Certbot installs an automated systemd timer (`certbot.timer`) that runs twice daily and renews certificates within 30 days of expiration.

---

## 8. Backup & Disaster Recovery Strategy

### Step 8.1: Database Backup Script (`/opt/scripts/backup-db.sh`)
Create the backup utility:
```bash
sudo mkdir -p /opt/scripts /var/backups/tally-connect
sudo nano /opt/scripts/backup-db.sh
```

Add backup logic:
```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/var/backups/tally-connect"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/tally_connect_prod_${TIMESTAMP}.sql.gz"
DB_NAME="tally_connect_prod"
DB_USER="tally_connect_user"
DB_PASS="ChangeThisToAStrongRandomPassword123!"

echo "[$(date)] Starting MySQL backup for $DB_NAME..."
mysqldump -u "$DB_USER" -p"$DB_PASS" --single-transaction --quick --routines --triggers "$DB_NAME" | gzip > "$FILENAME"

echo "[$(date)] Backup completed: $FILENAME ($(du -h "$FILENAME" | cut -f1))"

# Keep last 7 daily backups locally
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete

# Optional: Sync to AWS S3 bucket for offsite disaster recovery
# aws s3 cp "$FILENAME" s3://tally-connect-production-backups/daily/
```

Make executable:
```bash
sudo chmod +x /opt/scripts/backup-db.sh
```

### Step 8.2: Schedule Daily Cron Job
```bash
sudo crontab -e
```
Add scheduled backup at 02:00 AM daily:
```cron
0 2 * * * /opt/scripts/backup-db.sh >> /var/log/tally-connect/backup.log 2>&1
```

### Step 8.3: Disaster Recovery Restore Procedure
In the event of total server loss:
1. Provision new server following Sections 1–4.
2. Transfer latest backup file `tally_connect_prod_YYYYMMDD_HHMMSS.sql.gz`.
3. Restore database:
   ```bash
   gunzip < tally_connect_prod_YYYYMMDD_HHMMSS.sql.gz | mysql -u root -p tally_connect_prod
   ```
4. Start PM2 cluster (`pm2 start ecosystem.config.cjs --env production`).

---

## 9. Health & Monitoring Observability Endpoints

Tally Connect includes standardized REST probes for load balancers (AWS ALB, Cloudflare, Kubernetes, Datadog):

| Endpoint | Method | Expected HTTP | Purpose | Sample Response |
| :--- | :--- | :--- | :--- | :--- |
| `/health` | `GET` | `200 OK` | Liveness Probe | `{"status":"OK","service":"tally-connect-server","uptime":3600,"timestamp":"..."}` |
| `/ready` | `GET` | `200 OK` | Readiness Probe | `{"status":"READY","database":"connected","queue":"idle","uptime":3600,"timestamp":"..."}` |
| `/version` | `GET` | `200 OK` | Build Inspection | `{"version":"1.0.0","service":"tally-connect-server","environment":"production","commit":"..."}` |

### Testing Probes from Terminal
```bash
curl -s https://api.tallyconnect.cloud/health | jq .
curl -s https://api.tallyconnect.cloud/ready | jq .
curl -s https://api.tallyconnect.cloud/version | jq .
```
