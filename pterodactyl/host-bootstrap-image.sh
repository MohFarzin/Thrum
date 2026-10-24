#!/bin/bash
# Run on the Wings/Docker host as root.
# Builds the all-in-one image and pushes to a local registry so Wings can pull it.
set -euo pipefail

VOL="${1:-}"
if [[ -z "${VOL}" ]]; then
  echo "Usage: $0 /path/to/Thrum/repo-or-server-volume" >&2
  exit 1
fi
if [[ ! -f "${VOL}/pterodactyl/Dockerfile" ]]; then
  echo "Dockerfile not found under ${VOL}/pterodactyl" >&2
  exit 1
fi

IMAGE_LOCAL="thrum-pterodactyl:latest"
IMAGE_REG="127.0.0.1:5000/thrum-pterodactyl:latest"

cd "${VOL}"

if ! docker ps --format '{{.Names}}' | grep -qx thrum-registry; then
  docker rm -f thrum-registry 2>/dev/null || true
  docker run -d --name thrum-registry --restart=always -p 127.0.0.1:5000:5000 registry:2
fi

mkdir -p /etc/docker
python3 - <<'PY'
import json
from pathlib import Path
p = Path("/etc/docker/daemon.json")
data = json.loads(p.read_text()) if p.exists() and p.read_text().strip() else {}
regs = set(data.get("insecure-registries") or [])
regs.add("127.0.0.1:5000")
data["insecure-registries"] = sorted(regs)
p.write_text(json.dumps(data, indent=2) + "\n")
print("daemon.json:", data)
PY

systemctl reload docker 2>/dev/null || systemctl restart docker
sleep 3
docker start thrum-registry 2>/dev/null || true

echo "==> Building ${IMAGE_LOCAL}"
docker build -t "${IMAGE_LOCAL}" -t "${IMAGE_REG}" -f pterodactyl/Dockerfile .

echo "==> Pushing ${IMAGE_REG}"
docker push "${IMAGE_REG}"

echo "BOOTSTRAP_OK"
echo "Set the panel Docker image to: ${IMAGE_REG}"
