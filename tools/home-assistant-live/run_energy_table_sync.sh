#!/bin/zsh
set -euo pipefail

LOG_FILE=/tmp/ha-energy-table-refresh.wrapper.log
exec >>"${LOG_FILE}" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] starting energy table sync"

SCRIPT_DIR=${0:a:h}
REPO_DIR=${SCRIPT_DIR:h:h}
NODE_BIN=${NODE_BIN:-/Users/krasi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node}

echo "script_dir=${SCRIPT_DIR}"
echo "repo_dir=${REPO_DIR}"
echo "node_bin=${NODE_BIN}"

cd "${REPO_DIR}"
source "${REPO_DIR}/protected/main.sh" prod home-assistant >/dev/null

echo "protected config loaded"
echo "running node sync"
HA_BASE=${HA_URL%/} "${NODE_BIN}" "${SCRIPT_DIR}/sync_room_energy_tables.js"

echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] finished energy table sync"
