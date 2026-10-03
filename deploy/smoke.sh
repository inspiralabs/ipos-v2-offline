#!/usr/bin/env bash
# Smoke test setelah deploy (dijalankan deploy.sh di host VPS). Exit 0 = lulus.
set -euo pipefail
curl -fsS --max-time 10 -H "Host: offline.inspirapos.biz.id" http://127.0.0.1/ >/dev/null
