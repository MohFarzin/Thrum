# THRUM Pterodactyl egg (all-in-one)

**One server. One container. No separate Postgres or Redis.**

Import [`egg-thrum.json`](./egg-thrum.json), create a THRUM server, set `SECRET_KEY`, start. Embedded PostgreSQL + Redis + API + Celery all run inside that container.

## One-time: build the image on the Wings node

Pterodactyl cannot use Docker Compose inside an egg. This image packs Postgres + Redis + Python into the runtime the egg uses.

SSH to the **Wings / node** machine (Docker host):

```bash
git clone https://github.com/MohFarzin/Thrum.git /tmp/thrum-build
cd /tmp/thrum-build
docker build -t thrum-pterodactyl:latest -f pterodactyl/Dockerfile .
rm -rf /tmp/thrum-build
```

The egg expects the image name `thrum-pterodactyl:latest` (local to that node).

## Panel steps

1. Admin → Eggs → **Import** → `pterodactyl/egg-thrum.json`
2. Create a server from egg **THRUM**
3. Set **Secret Key** (32+ random characters). Optional: `ALLOWED_HOSTS`, `THRUM_PUBLIC_BASE_URL`
4. Allocate a port → **Install** → **Start**
5. Open `http://SERVER_IP:PORT/` and `http://SERVER_IP:PORT/api/health/`

No `DATABASE_URL`. No `REDIS_URL`. Data lives under `/home/container/data/` in the server files.

## What runs inside

| Process | Role |
|---------|------|
| Postgres | Embedded, `127.0.0.1:5432` |
| Redis | Embedded, `127.0.0.1:6379` |
| Celery worker + beat | Background jobs |
| Gunicorn | HTTP API + React UI (WhiteNoise) |

Install clones GitHub and builds the frontend; start boots the embedded stack.

## vs Docker Compose

| | Pterodactyl egg | Host Compose |
|--|-----------------|--------------|
| Effort | Import egg + build image once | `docker compose up` |
| Containers | **One** all-in-one | Separate db/redis/api/worker/beat/proxy |
| Best for | Panel users / quick test | Preferred production self-host |

Compose remains the documented preferred production layout. The egg exists so panel users get “create server → start” without wiring databases.
