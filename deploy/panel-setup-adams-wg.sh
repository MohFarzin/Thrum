#!/bin/bash
set -euo pipefail
CID=3ce084a6-4035-4b8c-b9c0-e4c72af30a24
VOL=/var/lib/Jexactyl/volumes/$CID
export WG_TOKEN="${WG_TOKEN:?WG_TOKEN required}"
cat > /tmp/thrum-setup-adams.py <<'PY'
import os
from django.contrib.auth import get_user_model
from apps.monitors.keys import assign_new_key
from apps.monitors.models import Circuit, CircuitMembership, Monitor

U = get_user_model()
owner = U.objects.filter(username__iexact="omnixstudio").first()
if not owner:
    raise SystemExit("OWNER_MISSING")

token = os.environ["WG_TOKEN"].strip()
auth = f"Bearer {token}"
tunnel_url = "http://139.185.60.182:9109/health"

circuit, _ = Circuit.objects.get_or_create(
    owner=owner,
    name="Adams",
    defaults={"description": "War67 WireGuard — tunnel + main + link"},
)
circuit.description = "War67 WireGuard — tunnel + main + link (3 pulses)"
circuit.save(update_fields=["description", "updated_at"])

# 1) Tunnel agent reachable (HTTP pull) — NOT link_ok
tunnel, created_t = Monitor.objects.get_or_create(
    owner=owner,
    name="tunnel-health",
    type=Monitor.Type.HTTP,
    defaults={
        "target": tunnel_url,
        "interval_seconds": 60,
        "timeout_seconds": 10,
        "expected_status_code": 200,
        "http_authorization": auth,
        "http_assert_link_ok": False,
        "is_enabled": True,
    },
)
tunnel.target = tunnel_url
tunnel.interval_seconds = 60
tunnel.timeout_seconds = 10
tunnel.expected_status_code = 200
tunnel.http_authorization = auth
tunnel.http_assert_link_ok = False
tunnel.is_enabled = True
tunnel.save()

# 2) Main machine alive (push heartbeat)
main, created_m = Monitor.objects.get_or_create(
    owner=owner,
    name="main-heartbeat",
    type=Monitor.Type.HEARTBEAT,
    defaults={
        "target": "",
        "interval_seconds": 30,
        "heartbeat_grace_seconds": 60,
        "is_enabled": True,
    },
)
main.interval_seconds = 30
main.heartbeat_grace_seconds = 60
main.is_enabled = True
raw_main = None
if not main.api_key_hash or created_m:
    raw_main = assign_new_key(main)
main.save()

# 3) Connection tunnel↔main (HTTP pull asserts link_ok + handshake age)
link, created_l = Monitor.objects.get_or_create(
    owner=owner,
    name="wg-link",
    type=Monitor.Type.HTTP,
    defaults={
        "target": tunnel_url,
        "interval_seconds": 60,
        "timeout_seconds": 10,
        "expected_status_code": 200,
        "http_authorization": auth,
        "http_assert_link_ok": True,
        "is_enabled": True,
    },
)
link.target = tunnel_url
link.interval_seconds = 60
link.timeout_seconds = 10
link.expected_status_code = 200
link.http_authorization = auth
link.http_assert_link_ok = True
link.is_enabled = True
link.save()

for m in (tunnel, main, link):
    CircuitMembership.objects.get_or_create(circuit=circuit, monitor=m)

print("CIRCUIT", circuit.id, circuit.name)
print("TUNNEL", tunnel.id, "created" if created_t else "updated")
print("MAIN", main.id, "created" if created_m else "updated")
print("LINK", link.id, "created" if created_l else "updated")
print("INGEST_URL", f"https://thrum.omnixstudio.xyz/api/v1/heartbeat/{main.id}/")
if raw_main:
    print("THRUM_API_KEY", raw_main)
else:
    print("THRUM_API_KEY", "(unchanged — use previous key or rotate in UI)")
    print("KEY_PREFIX", main.api_key_prefix)
PY
sudo cp /tmp/thrum-setup-adams.py "$VOL/backend/_setup_adams.py"
sudo docker exec -e WG_TOKEN="$WG_TOKEN" "$CID" bash -lc '
export DATABASE_URL=postgres://thrum@127.0.0.1:5432/thrum
export DJANGO_SETTINGS_MODULE=thrum.settings.production
export SECRET_KEY="$(cat /home/container/data/secret_key.txt)"
export WG_TOKEN
cd /home/container/backend
python manage.py migrate monitors 0009_http_auth_link_ok --noinput
python manage.py shell < /home/container/backend/_setup_adams.py
'
