# THRUM Pterodactyl egg

Import [`egg-thrum.json`](./egg-thrum.json) into your panel (Admin → Eggs → Import).

Pterodactyl runs **one container**. This egg clones THRUM from GitHub and runs **API + Celery worker + Celery beat** together. **Postgres and Redis are not inside the egg** — create them on the panel (or elsewhere) and paste URLs into the server variables.

## Import

1. Admin → Nests → pick a nest → **Import Egg** → upload `egg-thrum.json` (from this folder on GitHub).
2. Create a **PostgreSQL** database the panel can reach (Postgres egg or external).
3. Create a **Redis** instance the panel can reach (Redis egg or external).
4. Create a server from the **THRUM** egg.
5. Set variables (at least `SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`, `ALLOWED_HOSTS`).
6. Allocate a port; open that port (or put a reverse proxy / SSL in front).
7. Install / start. Console should show migrate + gunicorn listening.

Default Git repo: `https://github.com/MohFarzin/Thrum.git` (branch `main`).

## What the egg does

| Step | Behavior |
|------|----------|
| Install | `git clone` (or pull) → `pip install` → `npm run build` |
| Start | optional `git pull` → migrate → Celery worker + beat → Gunicorn on `SERVER_PORT` |
| UI | Built React app served by Django/WhiteNoise (no Nginx in this mode) |

## Preferred alternative

For the full multi-container stack (Nginx + separate services), use **Docker Compose** on the host — see the main README. The egg exists so you can run/test from the panel without host Compose.
