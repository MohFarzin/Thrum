# THRUM

**If it has a pulse, THRUM hears it.**

Open-source, self-hosted tech heartbeat monitoring — web UI, ingest API, and alerts.

> Phase 1: register/login, create/edit monitors (HTTP/TCP/heartbeat). Live checks = Phase 2. Client agents = Phase 3+.

## All-in-one box — just works

**Everything for the THRUM server is included:** Postgres, Redis, API, workers, and the web UI.  
You do **not** install a database or Redis. You do **not** invent a Secret Key.

| You do | THRUM does |
|--------|------------|
| Import egg / run Compose | Starts the whole stack |
| (Almost nothing else) | **Auto-generates** `SECRET_KEY` on first start |
| Open the UI | Serves the app |

**Client agents** (heartbeats from other machines) = **later**. This phase is server-only.

---

### How to run (Pterodactyl) — easiest for panel users

**1. Once** on the Wings/Docker host (required — Wings must *pull* an image):

```bash
git clone https://github.com/MohFarzin/Thrum.git /tmp/thrum-build
sudo bash /tmp/thrum-build/pterodactyl/host-bootstrap-image.sh /tmp/thrum-build
```

That builds the all-in-one image and pushes it to `127.0.0.1:5000/thrum-pterodactyl:latest` (local registry). Details: [`pterodactyl/README.md`](./pterodactyl/README.md).

**2.** Import [`pterodactyl/egg-thrum.json`](./pterodactyl/egg-thrum.json) → create a **THRUM** server → pick Docker image **local registry** → **Install** → **Start**.  
No Secret Key to fill.

**3.** Open the console on **first start**. You’ll see something like:

```text
==> THRUM generated a SECRET_KEY for you
    File:  /home/container/data/secret_key.txt
    Value: <long-random-string>
```

**4.** Open `http://SERVER_IP:PORT/` and `http://SERVER_IP:PORT/api/health/`.

**Read the key again later**

- Panel **File Manager** → `data/secret_key.txt`
- Or console: `cat /home/container/data/secret_key.txt`

More detail: [`pterodactyl/README.md`](./pterodactyl/README.md).

---

### How to run (Docker Compose)

```bash
cp .env.example .env
# leave SECRET_KEY empty — THRUM generates it

docker compose up --build
```

- UI: http://localhost  
- Health: http://localhost/api/health/  
- First-start key: in the **api** container logs, and in volume file `data/secret_key.txt` (`docker compose exec api cat /app/data/secret_key.txt`)

---

## What is `SECRET_KEY`? (you usually don’t care)

Django uses it to sign sessions/cookies. THRUM **creates a strong random one** the first time the server starts, **prints it once** in the console, and **saves it** to:

| Runtime | File |
|---------|------|
| Pterodactyl egg | `/home/container/data/secret_key.txt` |
| Docker Compose | `/app/data/secret_key.txt` (shared `app_data` volume) |

Optional: set `SECRET_KEY` yourself in the panel or `.env` if you already have one — THRUM will use yours. Leave it blank for auto.

---

## Architecture

```text
Server (this repo):  UI + API + Postgres + Redis + Celery   ← you run this now
Clients (later):     heartbeat agents on other machines
```

## Features (v1 roadmap)

- HTTP / TCP / heartbeat monitors  
- Status history + retention  
- Email + Discord alerts on down/recovery  
- Per-monitor API keys (hashed at rest)  

### Roadmap (not in v1)

Telegram / WhatsApp, Medium/High agent tiers, Quicktunnel, Kastora — README-only for now.

## Creating monitors / Discord / heartbeat curl

After Phases 1–4. See `docs/simple-api.md`.

## Environment

Egg: almost nothing required.  
Compose: copy `.env.example` → `.env` (empty `SECRET_KEY` is OK). See that file for optional SMTP / hosts / retention.

## Dev setup

Compose (above), or UI-only: `cd frontend && npm install && npm run dev`.

## Security notes

- Don’t commit real secrets or `.env`  
- Don’t share `secret_key.txt` publicly  
- API keys hashed at rest (Phase 3); SSRF hardening (Phase 5) — see `docs/security.md`

## Updating / backup

- **Compose:** volumes `postgres_data` + `app_data` (includes `secret_key.txt`)  
- **Egg:** back up `/home/container/data/` (Postgres + Redis + secret)

## Production note

Domain + TLS in front when you’re ready. Quicktunnel later for no public IP.

## License

MIT — see `LICENSE`.
