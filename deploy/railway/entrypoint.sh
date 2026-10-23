#!/bin/sh
set -eu
node /app/railway-preflight.mjs
node /app/railway-wait-for-services.mjs
exec /app/entrypoint.sh "$@"
