#!/bin/sh
set -eu
# Alphanumeric generated secrets cannot inject Redis configuration directives.
case "${REDIS_PASSWORD:-}" in
  ''|*[!a-zA-Z0-9]*) echo 'REDIS_PASSWORD must be generated alphanumeric text.' >&2; exit 1 ;;
esac
if [ "${#REDIS_PASSWORD}" -lt 32 ]; then
  echo 'REDIS_PASSWORD must contain at least 32 characters.' >&2
  exit 1
fi
umask 077
cat > /tmp/crm-redis.conf <<EOF
bind 0.0.0.0 ::
protected-mode yes
port 6379
dir /data
appendonly yes
appendfsync everysec
maxmemory-policy noeviction
requirepass $REDIS_PASSWORD
EOF
chown redis:redis /tmp/crm-redis.conf
exec /usr/local/bin/docker-entrypoint.sh "$@"
