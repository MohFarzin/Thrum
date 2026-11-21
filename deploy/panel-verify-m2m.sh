#!/bin/bash
set -euo pipefail
CID=3ce084a6-4035-4b8c-b9c0-e4c72af30a24
VOL=/var/lib/Jexactyl/volumes/3ce084a6-4035-4b8c-b9c0-e4c72af30a24
cat > /tmp/thrum-verify-m2m.py <<'PY'
from apps.monitors.models import Circuit, CircuitMembership, Monitor
from apps.alerts.models import AlertChannel
print("memberships", CircuitMembership.objects.count())
print("has_circuits_m2m", hasattr(Monitor, "circuits"))
print("alert_has_circuit", hasattr(AlertChannel, "circuit"))
# ensure old FK gone
print("has_old_fk", hasattr(Monitor, "circuit") and not hasattr(Monitor.circuit, "through"))
c = Circuit.objects.first()
if c:
    print("sample_circuit", c.name, "members", c.monitors.count())
PY
sudo cp /tmp/thrum-verify-m2m.py "$VOL/backend/_verify_m2m.py"
sudo docker exec "$CID" bash -lc '
export DATABASE_URL=postgres://thrum@127.0.0.1:5432/thrum
export DJANGO_SETTINGS_MODULE=thrum.settings.production
export SECRET_KEY="$(cat /home/container/data/secret_key.txt)"
cd /home/container/backend
python manage.py shell < /home/container/backend/_verify_m2m.py
'
