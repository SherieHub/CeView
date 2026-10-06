#!/usr/bin/env bash
# Pull-based release rollout, run every 2 minutes by ceview-deploy.timer.
#
# Reads /ceview/prod/release-sha. When it names a release this server isn't
# running (and hasn't already failed), it syncs that bundle from S3, refreshes
# secrets, switches /opt/ceview/current, pulls the images and waits for health.
# On failure it switches back to the previous release and logs DEPLOY_FAILED,
# which the CloudWatch metric filter turns into an email (DEPLOY_AWS.md B15).
#
#   sudo /opt/ceview/current/scripts/deploy.sh           # what the timer runs
#   sudo /opt/ceview/current/scripts/deploy.sh --force   # redeploy / retry a failed SHA
set -euo pipefail
. "$(dirname "$(readlink -f "$0")")/lib.sh"

HEALTH_TIMEOUT_SECONDS=600
KEEP_RELEASES=10

force=0
[[ ${1:-} == --force ]] && force=1

mkdir -p "$CEVIEW_STATE" "$CEVIEW_ROOT/releases" "$CEVIEW_LOG_DIR"
exec > >(tee -a "$CEVIEW_LOG_DIR/deploy.log") 2>&1

exec 9>/run/ceview-deploy.lock
flock -n 9 || { log "another deploy is running; skipping"; exit 0; }

sha="$(aws ssm get-parameter --region "$AWS_REGION" --name /ceview/prod/release-sha \
  --query Parameter.Value --output text)" || die "could not read /ceview/prod/release-sha"
[[ $sha =~ ^[0-9a-f]{40}$ ]] || die "release-sha is not a commit SHA: '$sha'"

deployed="$(cat "$CEVIEW_STATE/deployed-sha" 2>/dev/null || true)"
failed="$(cat "$CEVIEW_STATE/failed-sha" 2>/dev/null || true)"

if (( ! force )); then
  # Quiet no-ops: this runs every 2 minutes.
  [[ $sha == "$deployed" ]] && exit 0
  [[ $sha == "$failed" ]] && exit 0
fi

log "DEPLOY_START sha=$sha previous=${deployed:-none}"

release_dir="$CEVIEW_ROOT/releases/$sha"
aws s3 sync --region "$AWS_REGION" --only-show-errors --delete \
  "s3://$OPS_BUCKET/releases/$sha/" "$release_dir/" \
  || die "could not download the release bundle for $sha"
[[ -f $release_dir/docker-compose.prod.yml && -f $release_dir/release.env ]] \
  || die "release bundle for $sha is incomplete"
# S3 doesn't keep the executable bit.
chmod +x "$release_dir"/scripts/*.sh "$release_dir/scripts/ceview-compose" "$release_dir"/postgres-init/*.sh
install -m 755 "$release_dir/scripts/ceview-compose" /usr/local/bin/ceview-compose

previous_dir="$(readlink -f "$CEVIEW_ROOT/current" 2>/dev/null || true)"

switch_to() {
  ln -sfn "$1" "$CEVIEW_ROOT/current.new"
  mv -T "$CEVIEW_ROOT/current.new" "$CEVIEW_ROOT/current"
}

container_health() {
  local id
  id="$(ceview-compose ps -q "$1")"
  [[ -n $id ]] || { echo missing; return; }
  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id"
}

spring_up() {
  # caddy's busybox wget reaches spring-boot over the private network, so this
  # works before the public TLS certificate exists.
  ceview-compose exec -T caddy wget -qO- -T 5 http://spring-boot:8080/actuator/health 2>/dev/null \
    | grep -q '"status":"UP"'
}

wait_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS)) svc ok
  while (( SECONDS < deadline )); do
    ok=1
    for svc in postgres fastapi-sbert fastapi-transformer; do
      [[ $(container_health "$svc") == healthy ]] || ok=0
    done
    (( ok )) && spring_up && return 0
    sleep 10
  done
  for svc in postgres fastapi-sbert fastapi-transformer; do
    log "  $svc: $(container_health "$svc")"
  done
  return 1
}

rollout() {
  "$release_dir/scripts/fetch-secrets.sh" || return 1
  switch_to "$release_dir"
  ceview-compose pull --quiet || return 1
  ceview-compose up -d --remove-orphans || return 1
  wait_healthy
}

if rollout; then
  echo "$sha" >"$CEVIEW_STATE/deployed-sha"
  rm -f "$CEVIEW_STATE/failed-sha"
  # Old images and bundles: ECR keeps the last 10 images for rollbacks.
  docker image prune -af --filter "until=24h" >/dev/null || true
  # shellcheck disable=SC2012  # release dirs are commit SHAs
  ls -1dt "$CEVIEW_ROOT"/releases/*/ | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf
  log "DEPLOY_OK sha=$sha"
  exit 0
fi

echo "$sha" >"$CEVIEW_STATE/failed-sha"
log "DEPLOY_FAILED sha=$sha"

if [[ -n $previous_dir && $previous_dir != "$release_dir" ]]; then
  log "rolling back to $(basename "$previous_dir")"
  switch_to "$previous_dir"
  "$previous_dir/scripts/fetch-secrets.sh" || true
  ceview-compose up -d --remove-orphans || true
  log "ROLLED_BACK sha=$(basename "$previous_dir")"
else
  log "no previous release to roll back to; containers left as they are. Fix, then: sudo $release_dir/scripts/deploy.sh --force"
fi
exit 1
