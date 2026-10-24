# Self-hosting

Full self-hosting guide lands in Phase 6.

## Quick start — Docker Compose (preferred)

1. Copy `.env.example` to `.env` (leave `SECRET_KEY` empty — auto-generated).
2. Run `docker compose up --build`.
3. Open http://localhost — THRUM UI shell.
4. Health: http://localhost/api/health/
5. Secret: api logs on first start, or `docker compose exec api cat /app/data/secret_key.txt`

## Quick start — Pterodactyl (all-in-one)

No separate Postgres/Redis. No manual Secret Key. See `pterodactyl/README.md`: build image once, import egg, create server, start. Key is in the console and `data/secret_key.txt`.
