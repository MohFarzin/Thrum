#!/bin/bash
set -euo pipefail
VOL=/var/lib/Jexactyl/volumes/3ce084a6-4035-4b8c-b9c0-e4c72af30a24
CID=3ce084a6-4035-4b8c-b9c0-e4c72af30a24
sudo cp /tmp/thrum-promote2.py "$VOL/backend/_promote2.py"
sudo docker exec "$CID" bash -lc '
export DATABASE_URL=postgres://thrum@127.0.0.1:5432/thrum
export DJANGO_SETTINGS_MODULE=thrum.settings.production
export SECRET_KEY="$(cat /home/container/data/secret_key.txt)"
cd /home/container/backend
python manage.py shell < /home/container/backend/_promote2.py
'
