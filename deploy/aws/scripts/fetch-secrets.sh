#!/usr/bin/env bash
# Renders every SSM SecureString under /ceview/prod/ into /opt/ceview/.env
# (root-only), which ceview-compose passes to `docker compose --env-file`.
# Run by deploy.sh on every release; run it by hand after changing a secret:
#   sudo /opt/ceview/current/scripts/fetch-secrets.sh && sudo ceview-compose up -d
set -euo pipefail
. "$(dirname "$(readlink -f "$0")")/lib.sh"

REQUIRED=(POSTGRES_PASSWORD DB_APP_PASSWORD JWT_SECRET CEVIEW_ATTRIBUTION_IP_HASH_SALT)
target="$CEVIEW_ROOT/.env"

json="$(aws ssm get-parameters-by-path --region "$AWS_REGION" \
  --path /ceview/prod/ --with-decryption --output json)" \
  || die "could not read /ceview/prod/ from Parameter Store"

# Values are written single-quoted, which compose treats literally (no $
# interpolation, no escapes), so a value can't contain a quote or line break.
bad="$(jq -r --arg q "'" '.Parameters[] | select((.Value | contains($q)) or (.Value | test("[\\n\\r]"))) | .Name' <<<"$json")"
[[ -z $bad ]] || die "these parameters contain a single quote or line break: $bad"

tmp="$(mktemp "$CEVIEW_ROOT/.env.XXXXXX")"
chmod 600 "$tmp"
trap 'rm -f "$tmp"' EXIT

jq -r --arg q "'" '.Parameters[]
  | (.Name | split("/") | last) as $k
  | select($k != "release-sha")
  | "\($k)=\($q)\(.Value)\($q)"' <<<"$json" | sort >"$tmp"

if grep -vqE "^[A-Z0-9_]+='" "$tmp"; then
  die "parameter names under /ceview/prod/ must be UPPER_SNAKE_CASE: $(grep -vE "^[A-Z0-9_]+='" "$tmp" | cut -d= -f1 | tr '\n' ' ')"
fi

for name in "${REQUIRED[@]}"; do
  grep -q "^$name=" "$tmp" || die "required parameter /ceview/prod/$name is missing"
done

mv "$tmp" "$target"
trap - EXIT
log "secrets refreshed: $(wc -l <"$target") values in $target"
