#!/usr/bin/env bash
# ==============================================================================
# Texas Capitol Platform - Fast Update Script (Zero Downtime / One Command)
# Usage: ./update.sh
# ==============================================================================

set -e

# ANSI Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${CYAN}======================================================================${NC}"
echo -e "${BLUE}  Pulling latest changes and updating Texas Capitol Engine...         ${NC}"
echo -e "${CYAN}======================================================================${NC}"

# 0. Preserve any legacy runtime edits on src/data/realBills.json before pulling
if ! git diff --quiet -- src/data/realBills.json; then
    echo -e "\n${YELLOW}[0/5] Backing up legacy local bill data before git pull...${NC}"
    mkdir -p data
    cp src/data/realBills.json data/pre_update_realBills.json
    git checkout -- src/data/realBills.json
fi

# 1. Fetch latest commits from GitHub
echo -e "\n${YELLOW}[1/5] Pulling latest code from GitHub...${NC}"
git pull

# 2. Ensure executable permissions & initialize SQLite WAL runtime snapshot
echo -e "\n${YELLOW}[2/5] Initializing SQLite WAL database & script permissions...${NC}"
chmod +x scripts/*.py update.sh deploy.sh
PYTHON_BIN="${SCRIPT_DIR}/venv/bin/python3"
if [ ! -x "$PYTHON_BIN" ]; then
    PYTHON_BIN="python3"
fi
"$PYTHON_BIN" "${SCRIPT_DIR}/scripts/db_store.py" --init

# 3. Update Node dependencies if package.json was modified
echo -e "\n${YELLOW}[3/5] Verifying dependencies...${NC}"
npm install --legacy-peer-deps

# 4. Rebuild production Vite frontend bundle
echo -e "\n${YELLOW}[4/5] Rebuilding frontend assets (Vite)...${NC}"
npm run build

# 5. Restart background systemd service
echo -e "\n${YELLOW}[5/5] Restarting texas-legis background service...${NC}"
sudo systemctl restart texas-legis

# 5. Quick Health Check
sleep 2
if curl -s http://127.0.0.1:5001/api/stats > /dev/null; then
    echo -e "\n${GREEN}✔ Update successful! The website is live on port 5001.${NC}"
else
    echo -e "\n${YELLOW}Notice: Service is restarting. Check logs with: sudo journalctl -u texas-legis -n 20${NC}"
fi

echo -e "${CYAN}======================================================================${NC}"
