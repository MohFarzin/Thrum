#!/bin/sh
set -e

DATA_DIR="${THRUM_DATA_DIR:-/app/data}"
SECRET_FILE="${THRUM_SECRET_FILE:-${DATA_DIR}/secret_key.txt}"
mkdir -p "${DATA_DIR}"

# Auto-generate SECRET_KEY when missing / placeholder; persist + print on first create.
export SECRET_KEY="$(python -m thrum.bootstrap_secret "${SECRET_FILE}")"

echo "Waiting for database..."
python - <<'PY'
import os, time
import dj_database_url
import psycopg

url = os.environ.get("DATABASE_URL", "postgres://thrum:thrum@db:5432/thrum")
cfg = dj_database_url.parse(url)
for i in range(60):
    try:
        with psycopg.connect(
            host=cfg.get("HOST"),
            port=cfg.get("PORT") or 5432,
            user=cfg.get("USER"),
            password=cfg.get("PASSWORD"),
            dbname=cfg.get("NAME"),
            connect_timeout=3,
        ) as conn:
            conn.execute("SELECT 1")
        print("Database is ready.")
        break
    except Exception as exc:
        print(f"DB not ready ({exc}); retry {i + 1}/60")
        time.sleep(1)
else:
    raise SystemExit("Database did not become ready in time")
PY

python manage.py migrate --noinput
exec "$@"
