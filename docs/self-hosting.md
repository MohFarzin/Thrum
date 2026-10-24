# Self-hosting

Full self-hosting guide lands in Phase 6.

## Quick start — Docker Compose (preferred)

1. Copy `.env.example` to `.env` and set `SECRET_KEY`.
2. Run `docker compose up --build`.
3. Open http://localhost — THRUM UI shell.
4. Health: http://localhost/api/health/

## Quick start — Pterodactyl (all-in-one)

No separate Postgres/Redis. See `pterodactyl/README.md`: build `thrum-pterodactyl:latest` once on Wings, import `egg-thrum.json`, create server, set `SECRET_KEY`, start.
