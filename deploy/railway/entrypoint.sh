#!/bin/sh
set -eu
node /app/railway-preflight.mjs
exec /app/entrypoint.sh "$@"
