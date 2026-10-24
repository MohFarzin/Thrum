#!/bin/bash
set -e
cd /home/container || true
export HOME=/home/container

STARTUP_CMD="${STARTUP:-bash /home/container/pterodactyl/start.sh}"
if [[ "${STARTUP_CMD}" == *"{{"* ]]; then
  for var in $(compgen -e); do
    STARTUP_CMD="${STARTUP_CMD//\{\{${var}\}\}/${!var}}"
  done
fi

echo "==> THRUM entrypoint uid=$(id -u)"
exec bash -lc "${STARTUP_CMD}"
