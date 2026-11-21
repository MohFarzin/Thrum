#!/bin/bash
set -euo pipefail
VOL=/var/lib/Jexactyl/volumes/3ce084a6-4035-4b8c-b9c0-e4c72af30a24
CID=3ce084a6-4035-4b8c-b9c0-e4c72af30a24
cat > /tmp/thrum-demote.py <<'PY'
from django.contrib.auth import get_user_model
from apps.accounts.models import Profile
U = get_user_model()
keep = "omnixstudio"
for u in U.objects.exclude(username__iexact=keep):
    if u.is_staff or u.is_superuser:
        u.is_staff = False
        u.is_superuser = False
        u.save(update_fields=["is_staff", "is_superuser"])
        Profile.objects.update_or_create(user=u, defaults={"is_approved": True})
        print("DEMOTED_TO_MEMBER", u.username, u.id)
u = U.objects.filter(username__iexact=keep).first()
if u:
    u.is_staff = True
    u.is_superuser = True
    u.is_active = True
    u.save()
    Profile.objects.update_or_create(user=u, defaults={"is_approved": True})
    print("ADMIN", u.username, u.id)
PY
sudo cp /tmp/thrum-demote.py "$VOL/backend/_demote.py"
sudo docker exec "$CID" bash -lc '
export DATABASE_URL=postgres://thrum@127.0.0.1:5432/thrum
export DJANGO_SETTINGS_MODULE=thrum.settings.production
export SECRET_KEY="$(cat /home/container/data/secret_key.txt)"
cd /home/container/backend
python manage.py shell < /home/container/backend/_demote.py
'
