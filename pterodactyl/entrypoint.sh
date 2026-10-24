#!/bin/bash
set -e
cd /home/container || true
export HOME=/home/container

# Wings/Windows edits often leave CRLF; strip before exec (in-image + volume).
for f in /home/container/pterodactyl/start.sh /home/container/pterodactyl/nss-wrap.sh; do
  if [[ -f "${f}" ]] && grep -q $'\r' "${f}" 2>/dev/null; then
    tr -d '\r' <"${f}" >"${f}.lf" && mv "${f}.lf" "${f}"
    chmod +x "${f}" 2>/dev/null || true
  fi
done

STARTUP_CMD="${STARTUP:-bash /home/container/pterodactyl/start.sh}"
if [[ "${STARTUP_CMD}" == *"{{"* ]]; then
  for var in $(compgen -e); do
    STARTUP_CMD="${STARTUP_CMD//\{\{${var}\}\}/${!var}}"
  done
fi

echo "==> THRUM entrypoint uid=$(id -u)"
exec bash -lc "${STARTUP_CMD}"
