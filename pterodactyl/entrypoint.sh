#!/bin/bash
# Pterodactyl yolk-style entrypoint: run the panel STARTUP command.
set -e
cd /home/container

# Wings may pass {{VAR}} placeholders; expand any leftover brace vars from the env.
STARTUP_CMD="${STARTUP}"
if [[ "${STARTUP_CMD}" == *"{{"* ]]; then
  for var in $(compgen -e); do
    STARTUP_CMD="${STARTUP_CMD//\{\{${var}\}\}/${!var}}"
  done
fi

exec bash -lc "${STARTUP_CMD}"
