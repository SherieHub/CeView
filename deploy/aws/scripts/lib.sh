#!/usr/bin/env bash
# Shared setup for the server scripts. Source it; don't run it.
# shellcheck disable=SC2034  # the CEVIEW_* variables are used by the sourcing scripts

# systemd starts units with a minimal PATH and no HOME. The AWS CLI comes from
# snap (docs/DEPLOY_AWS.md B12) and reads root's credentials from $HOME/.aws.
export PATH="/snap/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export HOME="${HOME:-/root}"

CEVIEW_ROOT=/opt/ceview
CEVIEW_STATE="$CEVIEW_ROOT/state"
CEVIEW_LOG_DIR=/var/log/ceview

# The bundle this script was shipped in: scripts/.. resolved through symlinks.
BUNDLE_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"

set -a
# shellcheck source=../deploy.env
. "$BUNDLE_DIR/deploy.env"
set +a

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

die() {
  log "ERROR: $*"
  exit 1
}

[[ $EUID -eq 0 ]] || die "run as root (sudo)"
