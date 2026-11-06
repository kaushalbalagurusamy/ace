#!/usr/bin/env bash
# Push to the GitHub mirror, trigger a Render deploy through the API, poll until live or failed, then curl /healthz.
# The key is read from .env into this process only and is never printed.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
: "${RENDER_API_KEY:?RENDER_API_KEY missing from .env}"
SVC=srv-dbmbob3m8hqs73f9pbpg
URL=https://ace-x92s.onrender.com
api() { curl -sS -H "Authorization: Bearer $RENDER_API_KEY" -H 'Content-Type: application/json' "$@"; }
git push github HEAD:main
git push origin HEAD:main || echo "warning: could not push origin main (judges land there)"
ID=$(api -X POST "https://api.render.com/v1/services/$SVC/deploys" -d '{}' | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("id") or d.get("deploy",{}).get("id",""))')
[ -n "$ID" ] || { echo "deploy trigger failed"; exit 1; }
echo "deploy $ID triggered"
for i in $(seq 1 60); do
  S=$(api "https://api.render.com/v1/services/$SVC/deploys/$ID" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("status",""))')
  echo "[$i] $S"
  case "$S" in live) break;; build_failed|update_failed|canceled|deactivated) echo "deploy $S"; exit 1;; esac
  sleep 10
done
[ "$S" = live ] || { echo "timed out waiting for live"; exit 1; }
curl -sS -m 20 -o /dev/null -w "healthz %{http_code}\n" "$URL/healthz"
