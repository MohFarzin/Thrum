#!/bin/bash
# Pterodactyl startup: gunicorn + celery worker + celery beat (one container).
set -euo pipefail

cd /home/container
export HOME=/home/container
export PATH="/home/container/.local/bin:${PATH}"
export PYTHONPATH="/home/container/backend:${PYTHONPATH:-}"
export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-thrum.settings.production}"
export PYTHONUNBUFFERED=1

if [[ -d .git ]] && [[ "${AUTO_UPDATE:-0}" == "1" ]]; then
  echo "==> git pull"
  git pull --ff-only || echo "git pull failed; continuing with existing files"
fi

if [[ ! -d frontend/dist ]]; then
  echo "frontend/dist missing — reinstall the server (egg install builds the UI)" >&2
  exit 1
fi

cd /home/container/backend

echo "==> migrate"
python manage.py migrate --noinput

WORKER_PID=""
BEAT_PID=""
cleanup() {
  [[ -n "${WORKER_PID}" ]] && kill "${WORKER_PID}" 2>/dev/null || true
  [[ -n "${BEAT_PID}" ]] && kill "${BEAT_PID}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

CONCURRENCY="${CELERY_CONCURRENCY:-1}"
echo "==> celery worker (concurrency=${CONCURRENCY})"
celery -A thrum worker --loglevel=INFO --concurrency="${CONCURRENCY}" &
WORKER_PID=$!

echo "==> celery beat"
celery -A thrum beat --loglevel=INFO &
BEAT_PID=$!

PORT="${SERVER_PORT:-8080}"
echo "==> gunicorn on 0.0.0.0:${PORT}"
exec gunicorn thrum.wsgi:application \
  --bind "0.0.0.0:${PORT}" \
  --workers "${GUNICORN_WORKERS:-2}" \
  --timeout 60
