#!/bin/bash
# All-in-one start: embedded Postgres + Redis + Celery + Gunicorn.
# Re-exec without CRLF if the volume file was edited on Windows.
if grep -q $'\r' "$0" 2>/dev/null; then
  _lf="${0}.lf"
  tr -d '\r' <"$0" >"${_lf}"
  chmod +x "${_lf}"
  exec bash "${_lf}" "$@"
fi
set -euo pipefail

banner() {
  echo ""
  echo "  =========================================="
  echo "             THRUM  ·  heartbeat"
  echo "  =========================================="
  echo ""
}

step() { echo "  > $*"; }
ok()   { echo "    OK  $*"; }
warn() { echo "    !!  $*" >&2; }

cd /home/container
export HOME=/home/container
export PATH="/home/container/.local/bin:${PATH}"
export PYTHONPATH="/home/container/backend:${PYTHONPATH:-}"
export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-thrum.settings.production}"
export PYTHONUNBUFFERED=1

banner

# shellcheck disable=SC1091
source /home/container/pterodactyl/nss-wrap.sh

DATA_DIR="/home/container/data"
PGDATA="${DATA_DIR}/postgres"
REDIS_DIR="${DATA_DIR}/redis"
SECRET_FILE="${DATA_DIR}/secret_key.txt"
mkdir -p "${PGDATA}" "${REDIS_DIR}"

step "Secret key"
export SECRET_KEY="$(
  cd /home/container/backend
  python -m thrum.bootstrap_secret "${SECRET_FILE}"
)"
ok "ready (${SECRET_FILE})"

if [[ -z "${PG_BIN:-}" ]]; then
  PG_BIN="$(dirname "$(find /usr/lib/postgresql -type f -name initdb 2>/dev/null | head -n 1)")"
fi
if [[ -z "${PG_BIN}" || ! -x "${PG_BIN}/initdb" ]]; then
  warn "Postgres binaries missing — rebuild thrum-pterodactyl image"
  exit 1
fi
export PATH="${PG_BIN}:${PATH}"

export DATABASE_URL="${DATABASE_URL:-postgres://thrum@127.0.0.1:5432/thrum}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379/0}"

if [[ -d .git ]] && [[ "${AUTO_UPDATE:-0}" == "1" ]] && [[ "${THRUM_UPDATED:-0}" != "1" ]]; then
  step "Updating from git"
  BRANCH="${BRANCH:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)}"
  # Egg volumes get dirty from hotfixes — reset to origin, keep data + built UI, then re-exec.
  if git fetch origin "${BRANCH}" \
    && git clean -fd -e data -e frontend/dist -e .local \
    && git reset --hard "origin/${BRANCH}"; then
    ok "synced to origin/${BRANCH} — restarting start.sh"
    export THRUM_UPDATED=1
    exec bash /home/container/pterodactyl/start.sh
  else
    warn "git update skipped"
  fi
fi

if [[ ! -d frontend/dist ]]; then
  warn "frontend/dist missing — Reinstall the server from the panel"
  exit 1
fi

# Stale locks after kill/restart (PID may now belong to redis/etc.)
clear_stale_pg_lock() {
  local pidfile="${PGDATA}/postmaster.pid"
  local socklock="${DATA_DIR}/.s.PGSQL.5432.lock"
  local sock="${DATA_DIR}/.s.PGSQL.5432"

  if [[ -f "${pidfile}" ]]; then
    local oldpid
    oldpid="$(head -1 "${pidfile}" 2>/dev/null || true)"
    if [[ -n "${oldpid}" ]] && kill -0 "${oldpid}" 2>/dev/null; then
      if [[ -r "/proc/${oldpid}/cmdline" ]] && tr '\0' ' ' <"/proc/${oldpid}/cmdline" | grep -q postgres; then
        step "Stopping leftover Postgres (pid ${oldpid})"
        pg_ctl -D "${PGDATA}" -m fast stop >/dev/null 2>&1 || kill "${oldpid}" 2>/dev/null || true
        sleep 1
      else
        warn "stale Postgres pid lock — clearing"
        rm -f "${pidfile}"
      fi
    else
      warn "stale Postgres pid lock — clearing"
      rm -f "${pidfile}"
    fi
  fi

  # Socket lock left after hard kill
  if [[ -f "${socklock}" ]]; then
    local spid
    spid="$(head -1 "${socklock}" 2>/dev/null || true)"
    if [[ -z "${spid}" ]] || ! kill -0 "${spid}" 2>/dev/null \
      || ! { [[ -r "/proc/${spid}/cmdline" ]] && tr '\0' ' ' <"/proc/${spid}/cmdline" | grep -q postgres; }; then
      warn "stale Postgres socket lock — clearing"
      rm -f "${socklock}" "${sock}"
    fi
  fi
}

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

step "Redis"
redis-server \
  --bind 127.0.0.1 \
  --port 6379 \
  --dir "${REDIS_DIR}" \
  --daemonize no \
  --save "" \
  --appendonly no \
  --loglevel warning &
REDIS_PID=$!
sleep 1
ok "listening on 127.0.0.1:6379"

step "Postgres"
if [[ ! -f "${PGDATA}/PG_VERSION" ]]; then
  echo "    ... first boot, initializing data dir"
  initdb -D "${PGDATA}" --username=thrum --auth-local=trust --auth-host=trust --encoding=UTF8 --locale=C
  {
    echo "listen_addresses = '127.0.0.1'"
    echo "port = 5432"
    echo "unix_socket_directories = '${DATA_DIR}'"
  } >> "${PGDATA}/postgresql.conf"
fi

clear_stale_pg_lock

postgres -D "${PGDATA}" -h 127.0.0.1 -p 5432 -k "${DATA_DIR}" &
PG_PID=$!

for i in $(seq 1 60); do
  if pg_isready -h 127.0.0.1 -p 5432 -U thrum >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
pg_isready -h 127.0.0.1 -p 5432 -U thrum >/dev/null
createdb -h 127.0.0.1 -p 5432 -U thrum thrum 2>/dev/null || true
ok "listening on 127.0.0.1:5432"

cd /home/container/backend

step "Database migrate"
python manage.py migrate --noinput
ok "schema current"

CONCURRENCY="${CELERY_CONCURRENCY:-1}"
step "Celery worker (concurrency=${CONCURRENCY})"
celery -A thrum worker --loglevel=WARNING --concurrency="${CONCURRENCY}" &
WORKER_PID=$!
ok "worker pid ${WORKER_PID}"

step "Celery beat"
celery -A thrum beat --loglevel=WARNING &
BEAT_PID=$!
ok "beat pid ${BEAT_PID}"

PORT="${SERVER_PORT:-8080}"
WORKERS="${GUNICORN_WORKERS:-1}"
TIMEOUT="${GUNICORN_TIMEOUT:-120}"

echo ""
echo "  ------------------------------------------"
echo "  Ready"
echo "    UI / API  ->  http://0.0.0.0:${PORT}/"
echo "    Health    ->  http://0.0.0.0:${PORT}/api/health/"
echo "    Secret    ->  ${SECRET_FILE}"
echo "  ------------------------------------------"
echo "  Tip: use http:// (not https) on the allocation port."
echo ""

THREADS="${GUNICORN_THREADS:-1}"
exec gunicorn thrum.wsgi:application \
  --bind "0.0.0.0:${PORT}" \
  --workers "${WORKERS}" \
  --threads "${THREADS}" \
  --timeout "${TIMEOUT}" \
  --graceful-timeout 30 \
  --access-logfile - \
  --error-logfile - \
  --capture-output
