# THRUM

**If it has a pulse, THRUM hears it.**

Self-hosted uptime & heartbeat monitoring — one box, open source.

<p align="center">
  <img src="frontend/public/favicon.svg" alt="THRUM mark" width="72" height="72" />
</p>

Register → add HTTP / TCP / heartbeat monitors → see status. Alerts and remote agents come next.

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

`SECRET_KEY` is generated automatically. See it in the panel console on first boot, or in `data/secret_key.txt`.

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

## What you get

- **All-in-one** or Compose — your choice  
- **Auth** — register / login / logout  
- **Monitors** — HTTP, TCP, heartbeat (CRUD)  
- **Auto secret** — no copying random keys by hand  
- Coming soon: live checks, Discord/email alerts, agent heartbeats  

---

## Architecture

```text
┌─────────────────────────────────────────┐
│  THRUM server                           │
│  React UI · Django API · Celery         │
│  Postgres · Redis                       │
└─────────────────────────────────────────┘
          ▲
          │  heartbeats (later)
   clients / game servers / CI
```

---

## Environment

Egg users: almost nothing to fill in.

Compose: see [`.env.example`](./.env.example). Empty `SECRET_KEY` → auto-generated.

---

## Security

- Never commit `.env` or `secret_key.txt`  
- API keys will be hashed at rest (Phase 3)  
- More in [`docs/security.md`](./docs/security.md)

---

## Backup

| Runtime | What to back up |
|---------|-----------------|
| Compose | volumes `postgres_data`, `app_data` |
| Egg | `/home/container/data/` |

---

## License

MIT — see [`LICENSE`](./LICENSE).
