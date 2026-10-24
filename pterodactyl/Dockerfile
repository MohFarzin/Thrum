# All-in-one THRUM image for Pterodactyl: Postgres + Redis + Python runtime.
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
        libnss-wrapper \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -d /home/container -s /bin/bash container

COPY pterodactyl/entrypoint.sh /entrypoint.sh
RUN chmod 755 /entrypoint.sh

WORKDIR /home/container

ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
