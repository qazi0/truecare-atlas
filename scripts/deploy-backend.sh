#!/usr/bin/env bash
# Deploy the FastAPI backend to Databricks Apps.
# Usage: ./scripts/deploy-backend.sh
set -euo pipefail

PROFILE="sj-wksp"
APP_NAME="trustmap-india"
BACKEND_DIR="$(cd "$(dirname "$0")/../backend" && pwd)"
WORKSPACE_SOURCE_PATH="/Workspace/Users/fullbridgerectifier@gmail.com/trustmap-backend"

echo "==> Checking if app '$APP_NAME' exists..."
if ! databricks apps get "$APP_NAME" --profile "$PROFILE" >/dev/null 2>&1; then
    echo "==> Creating app '$APP_NAME'..."
    databricks apps create --name "$APP_NAME" --profile "$PROFILE"
fi

echo "==> Syncing backend source to $WORKSPACE_SOURCE_PATH..."
databricks sync "$BACKEND_DIR" "$WORKSPACE_SOURCE_PATH" \
    --profile "$PROFILE" \
    --full \
    --exclude ".venv/**" \
    --exclude "__pycache__/**" \
    --exclude "**/__pycache__/**" \
    --exclude "*.pyc" \
    --exclude "mlruns/**" \
    --exclude "mlflow.db"

echo "==> Deploying from $WORKSPACE_SOURCE_PATH..."
databricks apps deploy "$APP_NAME" --profile "$PROFILE"

echo "==> Waiting for deployment..."
databricks apps get "$APP_NAME" --profile "$PROFILE" | grep -E "url|status"

echo "==> Done. App URL:"
databricks apps get "$APP_NAME" --profile "$PROFILE" | grep "url"
