#!/bin/bash
# Runs after the egg clones the GitHub repo into /mnt/server (or /home/container).
set -euo pipefail

ROOT="${1:-/mnt/server}"
cd "${ROOT}"

echo "==> THRUM install: Python deps"
export HOME="${ROOT}"
export PATH="${ROOT}/.local/bin:${PATH}"
python -m pip install -U pip --prefix "${ROOT}/.local"
python -m pip install -U --prefix "${ROOT}/.local" -r backend/requirements.txt

echo "==> THRUM install: build React frontend"
if ! command -v npm >/dev/null 2>&1; then
  echo "npm missing in install container" >&2
  exit 1
fi
cd "${ROOT}/frontend"
npm install
npm run build
cd "${ROOT}"

chmod +x "${ROOT}/pterodactyl/start.sh" "${ROOT}/pterodactyl/install.sh"
echo "==> THRUM install complete"
