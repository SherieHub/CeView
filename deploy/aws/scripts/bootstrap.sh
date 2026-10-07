#!/usr/bin/env bash
# One-time server setup for the Lightsail instance (docs/DEPLOY_AWS.md B12).
# Safe to re-run. Needs `sudo aws configure` done first with the ceview-box key.
#
#   sudo aws s3 cp s3://<ops-bucket>/bootstrap/bootstrap.sh /root/bootstrap.sh
#   sudo bash /root/bootstrap.sh <ops-bucket>
#
# It runs standalone (only this file is downloaded), so it doesn't use lib.sh.
#
# Set DATA_DEVICE=/dev/xxx to choose the data disk when auto-detection can't.
set -euo pipefail

export PATH="/snap/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export HOME=/root
export DEBIAN_FRONTEND=noninteractive

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

[[ $EUID -eq 0 ]] || die "run with sudo"
OPS_BUCKET="${1:-}"
[[ -n $OPS_BUCKET ]] || die "usage: sudo bash bootstrap.sh <ops-bucket>"

command -v aws >/dev/null || die "AWS CLI missing: sudo snap install aws-cli --classic"
REGION="$(aws configure get region || true)"
[[ -n $REGION ]] || die "no default region: run sudo aws configure (region ap-southeast-1)"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)" \
  || die "AWS credentials don't work: run sudo aws configure with the ceview-box key"
REGISTRY="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

# ── 1. Data disk at /data ────────────────────────────────────────────────────
if mountpoint -q /data; then
  log "/data already mounted"
else
  if [[ -n ${DATA_DEVICE:-} ]]; then
    dev="$DATA_DEVICE"
  else
    root_disk="$(lsblk -no PKNAME "$(findmnt -no SOURCE /)")"
    mapfile -t candidates < <(lsblk -dnpo NAME,TYPE | awk '$2 == "disk" {print $1}' | grep -v "^/dev/$root_disk\$" || true)
    (( ${#candidates[@]} == 1 )) || die "expected exactly one attached data disk, found: ${candidates[*]:-none}. Attach ceview-prod-data (B11 step 3) or set DATA_DEVICE."
    dev="${candidates[0]}"
  fi
  if [[ -z $(blkid -o value -s TYPE "$dev" || true) ]]; then
    log "formatting $dev as ext4 (first run)"
    mkfs.ext4 -q -L ceview-data "$dev"
  fi
  uuid="$(blkid -o value -s UUID "$dev")"
  mkdir -p /data
  grep -q "UUID=$uuid" /etc/fstab || echo "UUID=$uuid /data ext4 defaults,nofail 0 2" >>/etc/fstab
  mount /data
  log "mounted $dev at /data"
fi
mkdir -p /data/pgdata /data/hf-cache

# ── 2. Swap ──────────────────────────────────────────────────────────────────
if ! swapon --show=NAME --noheadings | grep -q '^/swapfile$'; then
  [[ -f /swapfile ]] || { fallocate -l 2G /swapfile; chmod 600 /swapfile; mkswap /swapfile >/dev/null; }
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
  log "2GB swap enabled"
fi

# ── 3. Packages: Docker (official repo), ECR helper, jq, security updates ────
if ! command -v docker >/dev/null; then
  log "installing Docker"
  apt-get update -q
  apt-get install -yq ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck source=/dev/null
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" \
    >/etc/apt/sources.list.d/docker.list
fi
apt-get update -q
apt-get install -yq docker-ce docker-ce-cli containerd.io docker-compose-plugin \
  amazon-ecr-credential-helper jq unattended-upgrades
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF

# ── 4. Docker: ECR credentials, awslogs credentials, wait for /data ──────────
mkdir -p /root/.docker
cat >/root/.docker/config.json <<EOF
{ "credHelpers": { "$REGISTRY": "ecr-login" } }
EOF
mkdir -p /etc/systemd/system/docker.service.d
cat >/etc/systemd/system/docker.service.d/ceview.conf <<'EOF'
[Unit]
# Never start containers on the root disk if the data disk failed to mount:
# Postgres would initialise an empty database there.
RequiresMountsFor=/data

[Service]
# The awslogs logging driver runs inside dockerd and needs the box's key.
Environment=HOME=/root
Environment=AWS_SHARED_CREDENTIALS_FILE=/root/.aws/credentials
Environment=AWS_CONFIG_FILE=/root/.aws/config
EOF
systemctl daemon-reload
systemctl enable docker >/dev/null
systemctl restart docker

# ── 5. Release bundle for the current release-sha ───────────────────────────
sha="$(aws ssm get-parameter --name /ceview/prod/release-sha --query Parameter.Value --output text)" \
  || die "no /ceview/prod/release-sha yet: run the first release (B10) before bootstrapping"
release_dir="/opt/ceview/releases/$sha"
mkdir -p /opt/ceview/releases /opt/ceview/state /var/log/ceview
aws s3 sync --only-show-errors "s3://$OPS_BUCKET/releases/$sha/" "$release_dir/"
chmod +x "$release_dir"/scripts/*.sh "$release_dir/scripts/ceview-compose" "$release_dir"/postgres-init/*.sh
install -m 755 "$release_dir/scripts/ceview-compose" /usr/local/bin/ceview-compose

# ── 6. CloudWatch agent (on-premises mode: Lightsail has no instance role) ──
if [[ ! -x /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl ]]; then
  log "installing CloudWatch agent"
  curl -fsSL -o /tmp/amazon-cloudwatch-agent.deb \
    "https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/$(dpkg --print-architecture)/latest/amazon-cloudwatch-agent.deb"
  dpkg -i -E /tmp/amazon-cloudwatch-agent.deb >/dev/null
  rm -f /tmp/amazon-cloudwatch-agent.deb
fi
cat >/opt/aws/amazon-cloudwatch-agent/etc/common-config.toml <<'EOF'
[credentials]
  shared_credential_profile = "default"
  shared_credential_file = "/root/.aws/credentials"
EOF
touch /var/log/ceview/deploy.log /var/log/ceview/backup.log
sed "s/__AWS_REGION__/$REGION/" "$release_dir/cloudwatch/agent.json" \
  >/opt/aws/amazon-cloudwatch-agent/etc/ceview-agent.json
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m onPremise -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/ceview-agent.json >/dev/null
log "CloudWatch agent running"

# ── 7. Log rotation, systemd timers ──────────────────────────────────────────
cat >/etc/logrotate.d/ceview <<'EOF'
/var/log/ceview/*.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
  copytruncate
}
EOF
install -m 644 "$release_dir"/systemd/ceview-*.service "$release_dir"/systemd/ceview-*.timer /etc/systemd/system/
systemctl daemon-reload

# ── 8. First deploy ──────────────────────────────────────────────────────────
log "running the first deploy; this takes 10–15 minutes (image pulls, E5 model download)"
deploy_ok=1
"$release_dir/scripts/deploy.sh" --force || deploy_ok=0

systemctl enable --now ceview-deploy.timer ceview-backup.timer >/dev/null
log "timers enabled: ceview-deploy (every 2 min), ceview-backup (18:00 UTC)"

if (( deploy_ok )); then
  log "bootstrap complete"
else
  die "bootstrap finished but the first deploy failed: see /var/log/ceview/deploy.log and sudo ceview-compose ps"
fi
