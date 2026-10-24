#!/bin/bash
# All-in-one start: embedded Postgres + Redis + Celery + Gunicorn.
# No external DATABASE_URL / REDIS_URL required.
set -euo pipefail

cd /home/container
export HOME=/home/container
export PATH="/home/container/.local/bin:${PATH}"
export PYTHONPATH="/home/container/backend:${PYTHONPATH:-}"
export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-thrum.settings.production}"
export PYTHONUNBUFFERED=1

# shellcheck disable=SC1091
source /home/container/pterodactyl/nss-wrap.sh

DATA_DIR="/home/container/data"
PGDATA="${DATA_DIR}/postgres"
REDIS_DIR="${DATA_DIR}/redis"
SECRET_FILE="${DATA_DIR}/secret_key.txt"
mkdir -p "${PGDATA}" "${REDIS_DIR}"

# Auto SECRET_KEY — noob-friendly: generated on first start, saved to a file + printed once.
export SECRET_KEY="$(
  cd /home/container/backend
  python -m thrum.bootstrap_secret "${SECRET_FILE}"
)"

# Locate Debian Postgres binaries (version varies by image).
if [[ -z "${PG_BIN:-}" ]]; then
  PG_BIN="$(dirname "$(find /usr/lib/postgresql -type f -name initdb 2>/dev/null | head -n 1)")"
fi
if [[ -z "${PG_BIN}" || ! -x "${PG_BIN}/initdb" ]]; then
  echo "Postgres binaries not found. Use the thrum-pterodactyl Docker image." >&2
  exit 1
fi
export PATH="${PG_BIN}:${PATH}"

# Embedded URLs — always local to this container.
export DATABASE_URL="${DATABASE_URL:-postgres://thrum@127.0.0.1:5432/thrum}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379/0}"

if [[ -d .git ]] && [[ "${AUTO_UPDATE:-0}" == "1" ]]; then
  echo "==> git pull"
  git pull --ff-only || echo "git pull failed; continuing with existing files"
fi

if [[ ! -d frontend/dist ]]; then
  echo "frontend/dist missing — reinstall the server (egg install builds the UI)" >&2
  exit 1
fi

PG_PID=""
REDIS_PID=""
WORKER_PID=""
BEAT_PID=""
cleanup() {
  [[ -n "${WORKER_PID}" ]] && kill "${WORKER_PID}" 2>/dev/null || true
  [[ -n "${BEAT_PID}" ]] && kill "${BEAT_PID}" 2>/dev/null || true
  [[ -n "${REDIS_PID}" ]] && kill "${REDIS_PID}" 2>/dev/null || true
  if [[ -n "${PG_PID}" ]]; then
    pg_ctl -D "${PGDATA}" -m fast stop >/dev/null 2>&1 || kill "${PG_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "==> Redis (embedded)"
redis-server \
  --bind 127.0.0.1 \
  --port 6379 \
  --dir "${REDIS_DIR}" \
  --daemonize no \
  --save "" \
  --appendonly no &
REDIS_PID=$!
sleep 1

echo "==> Postgres (embedded)"
if [[ ! -f "${PGDATA}/PG_VERSION" ]]; then
  echo "Initializing Postgres data directory…"
  initdb -D "${PGDATA}" --username=thrum --auth-local=trust --auth-host=trust --encoding=UTF8 --locale=C
  {
    echo "listen_addresses = '127.0.0.1'"
    echo "port = 5432"
    echo "unix_socket_directories = '${DATA_DIR}'"
  } >> "${PGDATA}/postgresql.conf"
fi

postgres -D "${PGDATA}" -h 127.0.0.1 -p 5432 -k "${DATA_DIR}" &
PG_PID=$!

echo "Waiting for Postgres…"
for i in $(seq 1 60); do
  if pg_isready -h 127.0.0.1 -p 5432 -U thrum >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
pg_isready -h 127.0.0.1 -p 5432 -U thrum

# Create DB on first boot (ignore if it already exists).
createdb -h 127.0.0.1 -p 5432 -U thrum thrum 2>/dev/null || true

cd /home/container/backend

echo "==> migrate"
python manage.py migrate --noinput

CONCURRENCY="${CELERY_CONCURRENCY:-1}"
echo "==> celery worker (concurrency=${CONCURRENCY})"
celery -A thrum worker --loglevel=INFO --concurrency="${CONCURRENCY}" &
WORKER_PID=$!

echo "==> celery beat"
celery -A thrum beat --loglevel=INFO &
BEAT_PID=$!

PORT="${SERVER_PORT:-8080}"
echo "==> gunicorn on 0.0.0.0:${PORT}"
echo "THRUM all-in-one ready (Postgres + Redis + API inside this container)."
exec gunicorn thrum.wsgi:application \
  --bind "0.0.0.0:${PORT}" \
  --workers "${GUNICORN_WORKERS:-2}" \
  --timeout 60
