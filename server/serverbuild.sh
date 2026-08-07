#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARCHIVE="$HOME/Downloads/emailsummary.tar.gz"
TARGETSERVER="jayeesha@183.82.0.28"

case "${1:-}" in
    dev)
        echo "Uploading to dev server..."
        TARGETDIR="/var/www/aitemplate.dosystemsinc.com/server"
        ;;
    test)
        echo "Uploading to test server..."
        TARGETDIR="/var/www/aitemplate.dosystemsinc.com/server"
        ;;
    live)
        echo "Uploading to live server..."
        TARGETDIR="/var/www/aitemplate.dosystemsinc.com/server"
        ;;
    *)
        echo "Usage: $0 {dev|test|live}"
        exit 1
        ;;
esac

cd "$PROJECT_ROOT/server"
npm run build

tar -czf "$ARCHIVE" \
    --exclude 'node_modules' \
    --exclude 'coverage' \
    --exclude 'logs' \
    --exclude 'uploads' \
    .

scp "$ARCHIVE" "$TARGETSERVER:~/"
ssh "$TARGETSERVER" "sudo -S mkdir -p '$TARGETDIR' && sudo -S tar -xzf ~/emailsummary.tar.gz -C '$TARGETDIR' && sudo -S chmod -R 777 '$TARGETDIR'"

echo "Successfully uploaded to server"
