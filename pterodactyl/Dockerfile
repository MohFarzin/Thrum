# All-in-one THRUM image for Pterodactyl: Postgres + Redis + Python runtime.
# Build on the Wings node (or any Docker host), then point the egg at this tag:
#   docker build -t thrum-pterodactyl:latest -f pterodactyl/Dockerfile .
FROM python:3.12-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    USER=container \
    HOME=/home/container \
    LANG=C.UTF-8

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql \
        postgresql-contrib \
        redis-server \
        git \
        curl \
        ca-certificates \
        tini \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -d /home/container -s /bin/bash container

COPY --chmod=755 pterodactyl/entrypoint.sh /entrypoint.sh

USER container
WORKDIR /home/container

ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
