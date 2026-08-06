#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# First-time provisioning, from nothing to a running environment.
#
# Two genuine ordering constraints shape this script, and neither is avoidable:
#
#   1. The remote state backend cannot be created by the state it will hold.
#      The storage account and its `tfstate` container have to exist before
#      `terraform init` can use them, so phase 0 creates them with the CLI and
#      only then initialises the backend.
#
#   2. The Container Apps cannot start until the images exist, and the images
#      cannot be pushed until the registry exists — and the registry is created
#      by the same Terraform run. So the apply happens in stages.
#
# Every subsequent release goes through .github/workflows/deploy.yml. This
# script is only for standing an environment up from cold.
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$REPO_ROOT/infra/terraform"

TAG="${1:-bootstrap}"
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-resilia-prod}"
LOCATION="${LOCATION:-centralindia}"
STATE_ACCOUNT="${STATE_ACCOUNT:-stresiliac4630}"
STATE_CONTAINER="${STATE_CONTAINER:-tfstate}"

echo "==> Phase 0/4 — remote state backend"

# The region allowlist on this subscription is enforced by policy; anything
# outside it fails with RequestDisallowedByAzure on the first real resource.
az group create -n "$RESOURCE_GROUP" -l "$LOCATION" --only-show-errors -o none

if ! az storage account show -n "$STATE_ACCOUNT" -g "$RESOURCE_GROUP" >/dev/null 2>&1; then
  az storage account create -n "$STATE_ACCOUNT" -g "$RESOURCE_GROUP" -l "$LOCATION" \
    --sku Standard_LRS --kind StorageV2 \
    --min-tls-version TLS1_2 --allow-blob-public-access false \
    --only-show-errors -o none
fi

# Control-plane rights over the storage account do not grant access to the
# blobs inside it. Without this the backend returns 403
# AuthorizationPermissionMismatch, and the assignment takes a few minutes to
# propagate to the data plane.
CALLER_OID=$(az ad signed-in-user show --query id -o tsv)
STATE_SCOPE=$(az storage account show -n "$STATE_ACCOUNT" -g "$RESOURCE_GROUP" --query id -o tsv)
az role assignment create \
  --assignee-object-id "$CALLER_OID" --assignee-principal-type User \
  --role "Storage Blob Data Contributor" --scope "$STATE_SCOPE" \
  --only-show-errors -o none 2>/dev/null || true

az storage container create \
  --name "$STATE_CONTAINER" --account-name "$STATE_ACCOUNT" \
  --auth-mode login --only-show-errors -o none

echo "    state container ready: $STATE_ACCOUNT/$STATE_CONTAINER"

cd "$TF_DIR"

echo "==> Phase 1/4 — resource group and container registry"
terraform init -input=false
terraform apply -input=false -auto-approve \
  -target=azurerm_resource_group.main \
  -target=azurerm_container_registry.main

REGISTRY=$(terraform output -raw acr_name)
echo "    registry: $REGISTRY"

echo "==> Phase 2/4 — building images"

# Built locally and pushed, not with `az acr build`. ACR Tasks — the
# server-side build service — are rejected on this subscription class with
# TasksOperationsNotAllowed, so the build has to happen somewhere we control.
# `az acr login` still exchanges the Azure token for a short-lived registry
# token, so no registry password is stored anywhere.
cd "$REPO_ROOT"
az acr login -n "$REGISTRY"

docker build -f infra/docker/api.Dockerfile \
  -t "$REGISTRY.azurecr.io/resilia-api:${TAG}" \
  -t "$REGISTRY.azurecr.io/resilia-api:latest" .
docker build -f infra/docker/web.Dockerfile \
  -t "$REGISTRY.azurecr.io/resilia-web:${TAG}" \
  -t "$REGISTRY.azurecr.io/resilia-web:latest" .

docker push --all-tags "$REGISTRY.azurecr.io/resilia-api"
docker push --all-tags "$REGISTRY.azurecr.io/resilia-web"
echo "    both images pushed at tag ${TAG}"

echo "==> Phase 3/4 — full infrastructure (Postgres takes ~10 minutes)"
cd "$TF_DIR"
terraform apply -input=false -auto-approve -var="container_image_tag=${TAG}"

APP_URL=$(terraform output -raw app_url)

echo "==> Phase 4/4 — verifying the edge answers"
for _ in $(seq 1 30); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "${APP_URL}/healthz" || true)
  [ "$CODE" = "200" ] && break
  sleep 10
done
[ "$CODE" = "200" ] || { echo "edge never became ready (last status $CODE)"; exit 1; }

cat <<EOF

---------------------------------------------------------------------------
Provisioned.

  Live URL : ${APP_URL}
  Registry : ${REGISTRY}
  State    : ${STATE_ACCOUNT}/${STATE_CONTAINER}/prod.terraform.tfstate

Wire GitHub -> Azure (these are identifiers, not secrets):

  gh secret set AZURE_CLIENT_ID       -b "\$(terraform output -raw github_oidc_client_id)"
  gh secret set AZURE_TENANT_ID       -b "\$(terraform output -raw azure_tenant_id)"
  gh secret set AZURE_SUBSCRIPTION_ID -b "\$(terraform output -raw azure_subscription_id)"

Set these in a gitignored terraform.tfvars — they identify real people and this
repository is public:

  ops_alert_email         = "oncall@example.com"
  state_reader_object_ids = ["\$(az ad signed-in-user show --query id -o tsv)"]

From here on, every release goes through the pipeline: push to main.
---------------------------------------------------------------------------
EOF
