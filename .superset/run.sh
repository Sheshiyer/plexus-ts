#!/bin/sh
# UNIQUE Hands run — plexus · desktop
set -eu
WS="${SUPERSET_WORKSPACE_PATH:-.}"
cd "$WS"
echo "superset-run: plexus · desktop"
exec npm run dev
