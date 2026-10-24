#!/bin/bash
# Wings mounts /etc/passwd read-only; Postgres initdb needs the current UID resolvable.
# Use nss_wrapper with a writable fake passwd/group under the server data dir.
UID_NOW="$(id -u)"
GID_NOW="$(id -g)"
NSS_DIR="${HOME:-/home/container}/data/nss"
mkdir -p "${NSS_DIR}"
PASSWD_FILE="${NSS_DIR}/passwd"
GROUP_FILE="${NSS_DIR}/group"

# Keep system entries + our UID (ignore failures reading real files).
(cat /etc/passwd 2>/dev/null || true
 echo "container:x:${UID_NOW}:${GID_NOW}:THRUM:/home/container:/bin/bash") > "${PASSWD_FILE}"
(cat /etc/group 2>/dev/null || true
 echo "container:x:${GID_NOW}:") > "${GROUP_FILE}"

# Find libnss_wrapper.so
WRAPPER=""
for c in \
  /usr/lib/*/libnss_wrapper.so \
  /usr/lib/libnss_wrapper.so \
  /usr/lib/aarch64-linux-gnu/libnss_wrapper.so \
  /usr/lib/x86_64-linux-gnu/libnss_wrapper.so
do
  if [ -f "$c" ]; then WRAPPER="$c"; break; fi
done
if [ -z "${WRAPPER}" ]; then
  echo "libnss_wrapper.so not found" >&2
  exit 1
fi

export LD_PRELOAD="${WRAPPER}${LD_PRELOAD:+:$LD_PRELOAD}"
export NSS_WRAPPER_PASSWD="${PASSWD_FILE}"
export NSS_WRAPPER_GROUP="${GROUP_FILE}"
export USER=container
export HOME=/home/container
