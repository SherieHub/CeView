#!/usr/bin/env bash
# One-time data setup after the first healthy deploy (docs/DEPLOY_AWS.md B13).
# Safe to run again.
#   1. Imports the uniqueness reference-corpus vectors, unless already present.
#   2. Deletes the 9 demo operators and their data (sql/delete-demo-data.sql).
#   sudo /opt/ceview/current/scripts/init-data.sh
set -euo pipefail
. "$(dirname "$(readlink -f "$0")")/lib.sh"

psql_ceview() {
  ceview-compose exec -T postgres psql -v ON_ERROR_STOP=1 -U ceview -d ceview "$@"
}

psql_ceview -tAc "SELECT 1 FROM flyway_schema_history LIMIT 1" >/dev/null 2>&1 \
  || die "Flyway hasn't run yet. Wait until spring-boot is healthy (sudo ceview-compose ps)."

existing="$(psql_ceview -tAc "
  SELECT COUNT(*) FROM tbl_business_embedding e
  JOIN tbl_business_profile p USING (business_profile_id)
  WHERE p.is_reference")"

if (( existing > 0 )); then
  log "reference corpus already imported ($existing vectors); skipping"
else
  log "importing reference corpus vectors"
  psql_ceview -q <"$BUNDLE_DIR/sql/uniqueness-corpus.sql"
fi

log "deleting demo operators and their data"
psql_ceview <"$BUNDLE_DIR/sql/delete-demo-data.sql"

log "check: embeddings by model version (expect exactly one row, count 64)"
psql_ceview -c "SELECT embedding_model_version, COUNT(*) FROM tbl_business_embedding GROUP BY 1;"
log "check: remaining demo operators (expect 0)"
psql_ceview -tAc "SELECT COUNT(*) FROM tbl_msme_operator WHERE email LIKE '%@ceview.local'"
