#!/bin/bash
set -euo pipefail
CID=3ce084a6-4035-4b8c-b9c0-e4c72af30a24
VOL=/var/lib/Jexactyl/volumes/3ce084a6-4035-4b8c-b9c0-e4c72af30a24
cat > /tmp/thrum-verify-circuits.py <<'PY'
from django.contrib.auth import get_user_model
from apps.monitors.models import Circuit, Monitor
U = get_user_model()
print("circuits", Circuit.objects.count())
print("has_circuit_fk", hasattr(Monitor, "circuit"))
u = U.objects.filter(username__iexact="omnixstudio").first()
if u:
    c, created = Circuit.objects.get_or_create(
        owner=u, name="Demo circuit", defaults={"description": "seeded"}
    )
    print("demo", c.id, "created", created)
PY
sudo cp /tmp/thrum-verify-circuits.py "$VOL/backend/_verify_circuits.py"
sudo docker exec "$CID" bash -lc '
export DATABASE_URL=postgres://thrum@127.0.0.1:5432/thrum
export DJANGO_SETTINGS_MODULE=thrum.settings.production
export SECRET_KEY="$(cat /home/container/data/secret_key.txt)"
cd /home/container/backend
python manage.py shell < /home/container/backend/_verify_circuits.py
'
