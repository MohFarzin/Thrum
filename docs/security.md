# Security

THRUM is meant to be public open source. Keep **secrets out of git**; leave the code readable.

## Do not commit

| Keep local only | Why |
|-----------------|-----|
| `.gitignore` | Local ignore rules (copy from `docs/gitignore.example`) |
| `.env` | Real passwords, hosts, keys |
| `data/secret_key.txt` | Django `SECRET_KEY` |
| `thrum-plan.txt` | Local build brief |
| `.cursor/` | Local agent notes |
| `*.ppk` / private keys | SSH / panel access |

Setup: `cp docs/gitignore.example .gitignore` then `cp .env.example .env`. Empty `SECRET_KEY` auto-generates on first start.

## Built-in protections

- Monitor API keys hashed at rest; full key shown once on create/rotate  
- Alert SMTP passwords and Discord webhooks masked in the API (`********`)  
- Public share pages omit monitor `target` (no internal host leak)  
- Object-level ownership on monitors and channels  
- Login / heartbeat rate limits  
- HTTP checks: scheme allowlist + SSRF mitigations where practical  
- No logging of API keys, webhook URLs, or SMTP passwords  

## Production checklist

- `DEBUG=False`  
- Set `ALLOWED_HOSTS` / `CSRF_TRUSTED_ORIGINS` / `THRUM_PUBLIC_BASE_URL` for your host  
- Use HTTPS when you terminate TLS (cookies follow `SESSION_COOKIE_SECURE`)  
