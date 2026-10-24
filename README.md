# THRUM

**If it has a pulse, THRUM hears it.**

Self-hosted uptime & heartbeat monitoring — one box, open source.

<p align="center">
  <img src="frontend/public/logo.svg" alt="THRUM mark" width="72" height="72" />
</p>

Register → add HTTP / TCP / heartbeat monitors → get Discord or email when the beat skips.

---

## Quick start

### Option A — Pterodactyl (all-in-one)

Everything runs **inside one container** (Postgres + Redis + API + Celery + UI). No separate database egg.

| Step | Action |
|:----:|--------|
| 1 | On the **Wings host**, once: `sudo bash pterodactyl/host-bootstrap-image.sh /path/to/Thrum` |
| 2 | Import [`pterodactyl/egg-thrum.json`](./pterodactyl/egg-thrum.json) |
| 3 | Create server → image **`127.0.0.1:5000/thrum-pterodactyl:latest`** → Install → Start |
| 4 | Open **`http://YOUR_IP:PORT/`** (use **http**, not https, unless you add TLS) |

`SECRET_KEY` is generated automatically (console + `data/secret_key.txt`).

Keep **Auto Update = 0** while hot-patching the volume; turn it on only when GitHub matches what you want installed.

Full notes: [`pterodactyl/README.md`](./pterodactyl/README.md).

### Option B — Docker Compose

```bash
cp .env.example .env          # leave SECRET_KEY empty
docker compose up --build
```

| | URL |
|--|-----|
| UI | http://localhost |
| Health | http://localhost/api/health/ |
| Secret file | `docker compose exec api cat /app/data/secret_key.txt` |

---

## What you get (v1)

- Auth — register / login / logout (session cookies)
- Monitors — HTTP, TCP, heartbeat CRUD
- Live checks — Celery probes HTTP/TCP; history bars (green / orange soft-fail / red)
- Heartbeat agents — `POST /api/v1/heartbeat/<id>/` with API key (shown once)
- Alerts — Discord webhook + email (SMTP on channel or env); once on down, once on recovery
- Auto `SECRET_KEY` — no copying random keys by hand

### Heartbeat from any client (Windows CMD one line)

```bat
curl -X POST "http://YOUR_HOST:PORT/api/v1/heartbeat/MONITOR_UUID/" -H "Authorization: Bearer YOUR_API_KEY" -H "Content-Type: application/json" -d "{\"status\":\"ok\"}"
```

Keep sending at least every **interval + grace** seconds, or the watchdog will mark the monitor down (2 misses → alert).

### Discord alert

UI → **Alerts** → Discord webhook URL → **Send test**. Set `THRUM_PUBLIC_BASE_URL` to your public UI origin (used in alert links).

---

## Architecture

```text
┌─────────────────────────────────────────┐
│  THRUM server                           │
│  React UI · Django API · Celery         │
│  Postgres · Redis                       │
└─────────────────────────────────────────┘
          ▲
          │  heartbeats (outbound HTTPS from clients)
   game servers / VPS / CI / home PC
```

---

## Environment

See [`.env.example`](./.env.example). Important knobs:

| Variable | Purpose |
|----------|---------|
| `SECRET_KEY` | Empty → auto-generate |
| `THRUM_PUBLIC_BASE_URL` | Links inside alerts |
| `THRUM_FAILURES_BEFORE_DOWN` | Default `2` |
| `EMAIL_*` | Optional server-wide SMTP (or set SMTP on the email channel) |

---

## Security

- API keys hashed at rest; full key shown once on create/rotate  
- Never commit `.env` or `secret_key.txt`  
- Login / heartbeat rate limits  
- More in [`docs/security.md`](./docs/security.md)

---

## Backup

| Runtime | What to back up |
|---------|-----------------|
| Compose | volumes `postgres_data`, `app_data` |
| Egg | `/home/container/data/` |

---

## Roadmap (not in v1)

Telegram / WhatsApp alerts, Medium/High agent tiers, public status pages, Quicktunnel, Kastora, billing SaaS.

---

## License

MIT — see [`LICENSE`](./LICENSE).
