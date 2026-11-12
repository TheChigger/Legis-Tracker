#!/usr/bin/env bash
# ==============================================================================
# Texas Capitol Legislative Intelligence Engine - Tailored Deployment Script
# Configured for:
#   - Local IP:         192.168.4.20
#   - Public IP:        108.218.244.42
#   - Hostname/Domain:  legit.crickscreatives.com (Cloudflare Tunnel)
#   - Application Port: 5001 (avoiding port 5000 conflict)
#   - AI Engine:        Local Ollama (Pre-existing llama3.1)
#   - Automated Sync:   Hourly (:00 Ingestion, :30 AI llama3.1 Enrichment)
# ==============================================================================

set -e

# ANSI Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}======================================================================${NC}"
echo -e "${PURPLE}  Texas Capitol Platform - Customized Ubuntu Deployment (Port 5001)  ${NC}"
echo -e "${CYAN}======================================================================${NC}"
echo ""

CURRENT_USER=$(whoami)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Target Settings pre-configured for your network
DOMAIN="legit.crickscreatives.com"
LOCAL_IP="192.168.4.20"
PORT="5001"
OLLAMA_MODEL="llama3.1"

echo -e "${GREEN}Deploying with Pre-Configured Parameters:${NC}"
echo -e "  - Domain Name:       ${CYAN}${DOMAIN}${NC} (via Cloudflare Tunnel)"
echo -e "  - Local IP:          ${CYAN}${LOCAL_IP}${NC}"
echo -e "  - Service Port:      ${CYAN}${PORT}${NC} (Customized to avoid Port 5000 conflict)"
echo -e "  - Local AI Model:    ${CYAN}Ollama with ${OLLAMA_MODEL}${NC} (Pre-installed)"
echo -e "  - Hourly Schedule:   ${CYAN}:00 Ingest TLO FTP | :30 AI Enrichment (${OLLAMA_MODEL})${NC}"
echo -e "  - Service User:      ${CYAN}${CURRENT_USER}${NC}"
echo ""

# ------------------------------------------------------------------------------
# 1. System Packages & Node.js 20 Setup
# ------------------------------------------------------------------------------
echo -e "${BLUE}[1/6] Verifying Ubuntu system packages and Node.js 20...${NC}"
sudo apt-get update -y
sudo apt-get install -y curl git build-essential python3 python3-pip python3-venv nginx

NODE_VERSION=$(node -v 2>/dev/null || echo "none")
if [[ "$NODE_VERSION" == "none" || "${NODE_VERSION:1:2}" -lt 20 ]]; then
    echo -e "${YELLOW}Installing Node.js 20 LTS from NodeSource...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo -e "${GREEN}✔ Node.js ${NODE_VERSION} is ready.${NC}"
fi

# ------------------------------------------------------------------------------
# 2. Python Virtual Environment Setup
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[2/6] Preparing Python virtual environment for ingestion & AI enrichment...${NC}"
cd "$SCRIPT_DIR"
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
pip install requests
deactivate

# Make Python pipeline scripts executable
chmod +x "$SCRIPT_DIR/scripts/ingest_real_texas_data.py"
chmod +x "$SCRIPT_DIR/scripts/enrich_bills.py"

# ------------------------------------------------------------------------------
# 3. Node Dependencies & Production Bundle Build
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[3/6] Installing npm dependencies and compiling Vite SPA...${NC}"
cd "$SCRIPT_DIR"
npm install
npm run build

# ------------------------------------------------------------------------------
# 4. Generate Production .env File (Configured for Port 5001 & Ollama)
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[4/6] Writing production environment configuration (.env)...${NC}"
cat <<EOF > "$SCRIPT_DIR/.env"
NODE_ENV=production
PORT=${PORT}
APP_URL="https://${DOMAIN}"
OLLAMA_BASE_URL="http://127.0.0.1:11434"
OLLAMA_MODEL="${OLLAMA_MODEL}"
EOF

# ------------------------------------------------------------------------------
# 5. Verify Local Ollama and llama3.1
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[5/6] Checking local Ollama and ${OLLAMA_MODEL}...${NC}"
if command -v ollama &> /dev/null; then
    echo -e "${GREEN}✔ Local Ollama binary detected.${NC}"
    if curl -s http://127.0.0.1:11434/api/tags | grep -q "llama3.1"; then
        echo -e "${GREEN}✔ Found existing '${OLLAMA_MODEL}' model in Ollama library.${NC}"
    else
        echo -e "${YELLOW}Notice: '${OLLAMA_MODEL}' was not detected in local list. Ensuring it is available...${NC}"
        ollama pull "$OLLAMA_MODEL" || true
    fi
else
    echo -e "${YELLOW}Warning: Ollama command not found in PATH. Please verify your Ollama service is active on port 11434.${NC}"
fi

# ------------------------------------------------------------------------------
# 6. Systemd Background Service Setup (Port 5001)
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}[6/6] Registering systemd background service (texas-legis.service)...${NC}"
SERVICE_FILE="/etc/systemd/system/texas-legis.service"
sudo bash -c "cat <<EOF > ${SERVICE_FILE}
[Unit]
Description=Texas Capitol Legislative Intelligence Platform
After=network.target

[Service]
Type=simple
User=${CURRENT_USER}
WorkingDirectory=${SCRIPT_DIR}
EnvironmentFile=${SCRIPT_DIR}/.env
ExecStart=/usr/bin/npx tsx ${SCRIPT_DIR}/server.ts
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF"

sudo systemctl daemon-reload
sudo systemctl enable texas-legis
sudo systemctl restart texas-legis

# ------------------------------------------------------------------------------
# 7. Configure Nginx Reverse Proxy (Optional LAN Access on 192.168.4.20)
# ------------------------------------------------------------------------------
NGINX_CONF="/etc/nginx/sites-available/texas-legis"
sudo bash -c "cat <<EOF > ${NGINX_CONF}
server {
    listen 80;
    server_name ${DOMAIN} ${LOCAL_IP} localhost;

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\\$host;
        proxy_cache_bypass \\\$http_upgrade;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;

        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }
}
EOF"

sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/texas-legis
sudo nginx -t && sudo systemctl reload nginx || echo -e "${YELLOW}Nginx reload skipped.${NC}"

# ------------------------------------------------------------------------------
# 8. Two-Stage Hourly Cron Schedule (:00 Ingest, :30 AI Enrichment)
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}Setting up 2-stage hourly cron schedule...${NC}"
# Minute 00: Ingest fresh Capitol bills & reports
CRON_INGEST="0 * * * * ${SCRIPT_DIR}/venv/bin/python3 ${SCRIPT_DIR}/scripts/ingest_real_texas_data.py >> /var/log/texas_ingest.log 2>&1"
# Minute 30: Run AI evaluation on pending bills using local llama3.1
CRON_ENRICH="30 * * * * ${SCRIPT_DIR}/venv/bin/python3 ${SCRIPT_DIR}/scripts/enrich_bills.py >> /var/log/texas_enrich.log 2>&1"

(crontab -l 2>/dev/null | grep -Fv "ingest_real_texas_data.py" | grep -Fv "enrich_bills.py" ; echo "$CRON_INGEST" ; echo "$CRON_ENRICH") | crontab -
echo -e "${GREEN}✔ Hourly cron jobs installed:${NC}"
echo -e "   - Every hour at :00 -> TLO FTP ingestion"
echo -e "   - Every hour at :30 -> AI initial evaluation (${OLLAMA_MODEL})"

# ------------------------------------------------------------------------------
# 9. Health Check & Cloudflare Tunnel Instructions
# ------------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}Verifying application status on port ${PORT}...${NC}"
sleep 3
if curl -s "http://127.0.0.1:${PORT}/api/stats" > /dev/null; then
    echo -e "${GREEN}✔ Application is responding on http://127.0.0.1:${PORT}${NC}"
else
    echo -e "${YELLOW}Notice: Service is booting up. Check logs with: sudo journalctl -u texas-legis -n 30${NC}"
fi

echo ""
echo -e "${GREEN}======================================================================${NC}"
echo -e "${GREEN}  🎉 DEPLOYMENT COMPLETE FOR ${DOMAIN}!${NC}"
echo -e "${GREEN}======================================================================${NC}"
echo -e "Access options:"
echo -e "  • Local LAN:            ${CYAN}http://${LOCAL_IP}:${PORT}${NC} or ${CYAN}http://${LOCAL_IP}${NC}"
echo -e "  • Cloudflare Tunnel:    ${CYAN}https://${DOMAIN}${NC}"
echo ""
echo -e "${PURPLE}Cloudflare Tunnel Configuration (cloudflared):${NC}"
echo -e "In your Cloudflare Zero Trust dashboard (or in ~/.cloudflared/config.yml), point"
echo -e "the hostname ${CYAN}${DOMAIN}${NC} to your local service:"
echo -e "  ${YELLOW}service: http://localhost:${PORT}${NC}"
echo ""
echo -e "${PURPLE}Manual Pipeline Commands:${NC}"
echo -e "  • Run Ingestion now:    ${CYAN}${SCRIPT_DIR}/venv/bin/python3 ${SCRIPT_DIR}/scripts/ingest_real_texas_data.py${NC}"
echo -e "  • Run AI Analysis now: ${CYAN}${SCRIPT_DIR}/venv/bin/python3 ${SCRIPT_DIR}/scripts/enrich_bills.py${NC}"
echo -e "  • View Ingestion logs:  ${CYAN}tail -f /var/log/texas_ingest.log${NC}"
echo -e "  • View AI Analysis logs:${CYAN}tail -f /var/log/texas_enrich.log${NC}"
echo -e "  • View Web Server logs: ${CYAN}sudo journalctl -u texas-legis -f${NC}"
echo -e "${GREEN}======================================================================${NC}"
