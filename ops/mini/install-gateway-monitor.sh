#!/bin/zsh
set -euo pipefail

LABEL="ai.activemirror.gateway-monitor"
REPO_DIR="${ACTIVE_MIRROR_SITE_REPO:-/Users/mirror-admin/repos/active-mirror-site}"
PLIST_SOURCE="$REPO_DIR/ops/mini/$LABEL.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"

if [[ ! -f "$PLIST_SOURCE" ]]; then
  echo "missing plist: $PLIST_SOURCE" >&2
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.mirrordna/logs"
cp "$PLIST_SOURCE" "$PLIST_DEST"

launchctl bootout "$DOMAIN" "$PLIST_DEST" >/dev/null 2>&1 || true
launchctl bootstrap "$DOMAIN" "$PLIST_DEST"
launchctl enable "$DOMAIN/$LABEL"
launchctl kickstart -k "$DOMAIN/$LABEL"

launchctl print "$DOMAIN/$LABEL" | sed -n '1,80p'
