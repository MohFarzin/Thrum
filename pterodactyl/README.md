# THRUM Pterodactyl egg (all-in-one)

**One box. Auto Secret Key. No separate Postgres or Redis.**

1. Build image once on Wings (below)  
2. Import [`egg-thrum.json`](./egg-thrum.json)  
3. Create server → Install → Start  
4. Read `SECRET_KEY` from console (first start) or `data/secret_key.txt`

## One-time image build (Wings node)

```bash
git clone https://github.com/MohFarzin/Thrum.git /tmp/thrum-build
cd /tmp/thrum-build
docker build -t thrum-pterodactyl:latest -f pterodactyl/Dockerfile .
rm -rf /tmp/thrum-build
```

Egg image name: `thrum-pterodactyl:latest`.

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
