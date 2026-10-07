#!/usr/bin/env bash
# Nightly pg_dump to s3://<ops>/backups/pg/, run by ceview-backup.timer at
# 18:00 UTC (02:00 PHT). The bucket's lifecycle rule deletes dumps after 30 days.
# Restore steps: docs/DEPLOY_AWS.md B16.
set -euo pipefail
. "$(dirname "$(readlink -f "$0")")/lib.sh"

mkdir -p "$CEVIEW_LOG_DIR"
exec > >(tee -a "$CEVIEW_LOG_DIR/backup.log") 2>&1

# Stage on the encrypted data disk, so a failed dump never reaches S3 half-written.
stage_dir=/data/backup-tmp
mkdir -p "$stage_dir"
chmod 700 "$stage_dir"
name="$(date -u +%Y-%m-%dT%H%MZ).dump"
dump="$stage_dir/$name"
trap 'rm -f "$dump"' EXIT

if ! ceview-compose exec -T postgres pg_dump -U ceview -d ceview -Fc >"$dump"; then
  log "BACKUP_FAILED pg_dump"
  exit 1
fi

if ! aws s3 cp --region "$AWS_REGION" --only-show-errors --sse AES256 \
  "$dump" "s3://$OPS_BUCKET/backups/pg/$name"; then
  log "BACKUP_FAILED upload"
  exit 1
fi

log "BACKUP_OK s3://$OPS_BUCKET/backups/pg/$name ($(du -h "$dump" | cut -f1))"
