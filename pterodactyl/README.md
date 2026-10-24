# THRUM Pterodactyl egg (all-in-one)

**One box. Auto Secret Key. No separate Postgres or Redis.**

1. Build image once on Wings (below)  
2. Import [`egg-thrum.json`](./egg-thrum.json)  
3. Create server → Install → Start  
4. Read `SECRET_KEY` from console (first start) or `data/secret_key.txt`

## One-time on the Wings/Docker host (required)

Wings **must pull** an image. A local-only tag like `thrum-pterodactyl:latest` fails with `pull access denied`. Run this **once** on the node (as root/sudo):

```bash
# From a clone OR from an already-installed server volume that has pterodactyl/Dockerfile:
sudo bash pterodactyl/host-bootstrap-image.sh /path/to/Thrum
# Example after panel install:
# sudo bash /var/lib/Jexactyl/volumes/<uuid>/pterodactyl/host-bootstrap-image.sh /var/lib/Jexactyl/volumes/<uuid>
```

That script:

1. Starts a local registry on `127.0.0.1:5000`
2. Builds the all-in-one image
3. Pushes `127.0.0.1:5000/thrum-pterodactyl:latest`

In the panel, set the server Docker image to **`127.0.0.1:5000/thrum-pterodactyl:latest`** (included in the egg image list).

## Panel steps

1. Admin → Eggs → **Import** → `egg-thrum.json`  
2. Create **THRUM** server (defaults OK)  
3. Allocate a port → **Install** → **Start**  
4. Console → look for `THRUM generated a SECRET_KEY`  
5. Browse `http://IP:PORT/` and `/api/health/`

### Find the secret again

- Files → `data/secret_key.txt`  
- Console: `cat /home/container/data/secret_key.txt`

## Inside the container

Postgres + Redis + Celery + Gunicorn + React UI. Data under `/home/container/data/`.

## vs Compose

Egg = one container for panel users. Compose = multi-service preferred host install. Same product.
