# CAR-AGENTS Frappe CRM — Deployment Guide

Complete step-by-step guide to deploy self-hosted Frappe CRM with the
custom `car_agents_crm` app on your own server.

> **Cost:** €0 in software licensing. Only server hosting cost (~€10–20/month on Hetzner/DigitalOcean).

---

## Prerequisites

| Requirement | Version | Notes |
| :--- | :--- | :--- |
| Docker | ≥ 24.x | Install via `apt install docker.io` |
| Docker Compose | ≥ 2.x | `apt install docker-compose-plugin` |
| RAM | ≥ 4 GB | 8 GB recommended for production |
| Disk | ≥ 20 GB | For MariaDB data + uploaded files |
| OS | Ubuntu 22.04 LTS | Recommended. Debian 12 also works |

---

## Step 1 — Upload Files to Server

```bash
# On your LOCAL machine — copy the frappe/ folder to the VPS
scp -r "d:\CARS AI\frappe" root@YOUR_SERVER_IP:/opt/car-agents/
ssh root@YOUR_SERVER_IP
cd /opt/car-agents/frappe
```

---

## Step 2 — Configure Environment

```bash
# Copy the example env file and fill in your values
cp .env.example .env
nano .env
```

Fill in at minimum:
- `DB_ROOT_PASSWORD` — strong random password
- `DB_PASSWORD` — another strong password
- `FRAPPE_ADMIN_PASSWORD` — your Frappe admin login password
- `FRAPPE_SITE_NAME` — e.g. `crm.car-agents.de` (or `car-agents.localhost` for local testing)

---

## Step 3 — Start the Stack

```bash
# Pull all Docker images (first run may take 3–5 minutes)
docker compose pull

# Start all services in background
docker compose up -d

# Watch logs to confirm everything started cleanly
docker compose logs -f backend
```

---

## Step 4 — Initialize the Frappe Site

```bash
# Enter the backend container
docker compose exec backend bash

# Create the Frappe site (replace values from your .env)
bench new-site car-agents.localhost \
  --db-root-password "$DB_ROOT_PASSWORD" \
  --admin-password "$FRAPPE_ADMIN_PASSWORD" \
  --db-name "$DB_NAME"

# Install Frappe CRM app on the site
bench --site car-agents.localhost install-app crm

# Install our custom app
bench --site car-agents.localhost install-app car_agents_crm

# Load custom field fixtures
bench --site car-agents.localhost import-fixtures --app car_agents_crm

# Run database migrations
bench --site car-agents.localhost migrate

exit
```

---

## Step 5 — Access the CRM

Open your browser and navigate to:
```
http://YOUR_SERVER_IP:8080
```

Login with:
- **Username:** `Administrator`
- **Password:** Your `FRAPPE_ADMIN_PASSWORD` from `.env`

Navigate to **CRM** from the top menu.

---

## Step 6 — Generate API Key for n8n Integration

1. In Frappe → **Settings → Users → Administrator**
2. Scroll to **API Access** section
3. Click **Generate Keys**
4. Copy the **API Key** and **API Secret**
5. Add to your `.env`:
   ```env
   FRAPPE_API_KEY=your_copied_key
   FRAPPE_API_SECRET=your_copied_secret
   ```

---

## Step 7 — Place Contract Template PDFs

Copy the 4 CAR-AGENTS contract PDFs into the app templates directory:

```bash
# On your LOCAL machine
scp "d:\CARS AI\client_data\CAR-AGENTS_Vermittlungsvertrag_B2C_aktiv.pdf" \
    root@YOUR_SERVER_IP:/opt/car-agents/frappe/car_agents_crm/car_agents_crm/templates/contracts/Vermittlungsvertrag_B2C_aktiv.pdf

scp "d:\CARS AI\client_data\CAR-AGENTS_Vermittlungsvertrag_Beschaffung_Final__passiv.pdf" \
    root@YOUR_SERVER_IP:/opt/car-agents/frappe/car_agents_crm/car_agents_crm/templates/contracts/Vermittlungsvertrag_Beschaffung_passiv.pdf

scp "d:\CARS AI\client_data\Kaufvertrag-C2C-Bilingual.pdf" \
    root@YOUR_SERVER_IP:/opt/car-agents/frappe/car_agents_crm/car_agents_crm/templates/contracts/Kaufvertrag-C2C-Bilingual.pdf

scp "d:\CARS AI\client_data\CAR-AGENTS_Fahrzeug-Übergabeprotokoll.pdf" \
    root@YOUR_SERVER_IP:/opt/car-agents/frappe/car_agents_crm/car_agents_crm/templates/contracts/Fahrzeug-Uebergabeprotokoll.pdf
```

---

## Step 8 — Update n8n Workflows

In n8n, update the following credential/node configurations for all W1–W6 workflows:

| Workflow | Old Target | New Target |
| :--- | :--- | :--- |
| W1 — Email Logger | HubSpot API | `POST {FRAPPE_URL}/api/method/car_agents_crm.api.log_communication` |
| W2 — WhatsApp Logger | HubSpot API | `POST {FRAPPE_URL}/api/method/car_agents_crm.api.log_communication` |
| W3 — Document OCR | Google Docs | `POST {FRAPPE_URL}/api/method/car_agents_crm.api.extract_vehicle_specs` |
| W4 — Voice Transcriber | HubSpot Notes | `POST {FRAPPE_URL}/api/resource/CRM Comment` |
| W5 — Executive Briefing | HubSpot Data | `GET {FRAPPE_URL}/api/method/car_agents_crm.api.get_pipeline_summary` |
| W6 — Inactivity Tracker | HubSpot Deals | Handled by Frappe scheduler (no n8n change needed) |

**n8n HTTP Request Headers for all calls:**
```
Authorization: token YOUR_FRAPPE_API_KEY:YOUR_FRAPPE_API_SECRET
Content-Type:  application/json
```

---

## Step 9 — WhatsApp Webhook Configuration

In Meta Business Manager, update your webhook URL from the old n8n URL to:
```
http://YOUR_SERVER_IP:8080/api/method/car_agents_crm.api.log_communication
```

Or keep routing through n8n (recommended) — n8n receives the webhook and
calls the Frappe API. No Meta Business Manager change required in this case.

---

## Maintenance Commands

```bash
# Restart all Frappe services
docker compose restart

# View real-time logs
docker compose logs -f

# Backup database
docker compose exec db mysqldump -u root -p$DB_ROOT_PASSWORD $DB_NAME > backup_$(date +%Y%m%d).sql

# Update Frappe CRM app
docker compose exec backend bash -c "bench get-app crm && bench --site car-agents.localhost migrate"
```

---

## Installed Python Dependencies (for car_agents_crm)

Add these to the custom app's `requirements.txt`:
```
pypdf>=4.0.0
weasyprint>=60.0
requests>=2.31.0
```

Install inside the container:
```bash
docker compose exec backend pip install pypdf weasyprint requests
```
