#!/usr/bin/env bash
# Usage: API=http://localhost:8000 TOKEN=<jwt> TABLE_A=1 TABLE_B=2 bash backend/scripts/test-table-merge.sh
set -euo pipefail
API="${API:-http://localhost:8000}"
: "${TOKEN:?Set TOKEN to a PHUC_VU or QUAN_LY bearer token}"
: "${TABLE_A:?Set TABLE_A to first active table id}"
: "${TABLE_B:?Set TABLE_B to second active table id}"
tmp="$(mktemp)"
code="$(curl -sS -o "$tmp" -w '%{http_code}' -X POST "$API/api/gop-ban" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"ban_ids\":[${TABLE_A},${TABLE_B}]}")"
cat "$tmp"; echo
if [[ "$code" != "200" ]]; then
  echo "Merge failed with HTTP $code. Check same area, active service sessions and no invoice." >&2
  rm -f "$tmp"; exit 1
fi
SESSION_ID="$(python -c 'import json,sys; print(json.load(open(sys.argv[1]))["phien_chinh_id"])' "$tmp")"
rm -f "$tmp"
echo "Merged session id: $SESSION_ID"
echo "Undo after verifying, before payment:"
echo "curl -i -X POST '$API/api/gop-ban/$SESSION_ID/huy' -H 'Authorization: Bearer $TOKEN'"
