#!/bin/bash
set -euo pipefail
VOL=/var/lib/Jexactyl/volumes/3ce084a6-4035-4b8c-b9c0-e4c72af30a24
CID=3ce084a6-4035-4b8c-b9c0-e4c72af30a24
NEW_PW="$1"
if [[ -z "${NEW_PW}" ]]; then
  echo "usage: $0 <password>" >&2
  exit 1
fi
export NEW_PW
cat > /tmp/thrum-reset-pw.py <<'PY'
import os
from django.contrib.auth import get_user_model
from apps.accounts.models import Profile
U = get_user_model()
pw = os.environ["NEW_PW"]
u = U.objects.filter(username__iexact="omnixstudio").first()
if not u:
    raise SystemExit("USER_NOT_FOUND")
u.set_password(pw)
u.is_staff = True
u.is_superuser = True
u.is_active = True
u.save()
Profile.objects.update_or_create(user=u, defaults={"is_approved": True})
print("RESET_OK", u.username, u.id)
PY
sudo cp /tmp/thrum-reset-pw.py "$VOL/backend/_reset_pw.py"
sudo docker exec -e NEW_PW="$NEW_PW" "$CID" bash -lc '
export DATABASE_URL=postgres://thrum@127.0.0.1:5432/thrum
export DJANGO_SETTINGS_MODULE=thrum.settings.production
export SECRET_KEY="$(cat /home/container/data/secret_key.txt)"
export NEW_PW
cd /home/container/backend
python manage.py shell < /home/container/backend/_reset_pw.py
'
