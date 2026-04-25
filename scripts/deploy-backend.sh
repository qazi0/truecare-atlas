#!/usr/bin/env bash
# Deploy the FastAPI backend to Databricks Apps.
# Usage: ./scripts/deploy-backend.sh
set -euo pipefail

PROFILE="siraj-workspace"
APP_NAME="trustmap-india"
BACKEND_DIR="$(cd "$(dirname "$0")/../backend" && pwd)"

echo "==> Checking if app '$APP_NAME' exists..."
if ! databricks apps get "$APP_NAME" --profile "$PROFILE" >/dev/null 2>&1; then
    echo "==> Creating app '$APP_NAME'..."
    databricks apps create --name "$APP_NAME" --profile "$PROFILE"
fi

echo "==> Deploying from $BACKEND_DIR..."
cd "$BACKEND_DIR"
databricks apps deploy "$APP_NAME" --profile "$PROFILE"

echo "==> Waiting for deployment..."
databricks apps get "$APP_NAME" --profile "$PROFILE" | grep -E "url|status"

echo "==> Done. App URL:"
databricks apps get "$APP_NAME" --profile "$PROFILE" | grep "url"
