#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# First-time provisioning.
#
# There is a genuine ordering constraint here: the Container Apps cannot start
# until the images exist, and the images cannot be built until the registry
# exists — and the registry is created by the same Terraform run. So the apply
# happens in two phases:
#
#   phase 1  registry + resource group only          (~1 min)
#   phase 2  build both images into that registry    (~6 min)
#   phase 3  everything else, apps included          (~10 min, Postgres is the
#                                                     long pole)
#
# Every subsequent release goes through .github/workflows/deploy.yml. This
# script is only for standing the environment up from nothing.
# ---------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/../terraform"

TAG="${1:-bootstrap}"

echo "==> Phase 1/3 — resource group and container registry"
terraform init -input=false
terraform apply -input=false -auto-approve \
  -target=azurerm_resource_group.main \
  -target=azurerm_container_registry.main

REGISTRY=$(terraform output -raw acr_name)
echo "    registry: $REGISTRY"

echo "==> Phase 2/3 — building images (server-side, no local Docker needed)"
cd ../..

az acr build --registry "$REGISTRY" \
  --image "resilia-api:${TAG}" --image "resilia-api:latest" \
  --file infra/docker/api.Dockerfile . &
API_BUILD=$!

az acr build --registry "$REGISTRY" \
  --image "resilia-web:${TAG}" --image "resilia-web:latest" \
  --file infra/docker/web.Dockerfile . &
WEB_BUILD=$!

wait $API_BUILD || { echo "API image build failed"; exit 1; }
wait $WEB_BUILD || { echo "web image build failed"; exit 1; }
echo "    both images pushed at tag ${TAG}"

echo "==> Phase 3/3 — full infrastructure (Postgres takes ~10 minutes)"
cd infra/terraform
terraform apply -input=false -auto-approve -var="container_image_tag=${TAG}"

APP_URL=$(terraform output -raw app_url)

cat <<EOF

---------------------------------------------------------------------------
Provisioned.

  Live URL : ${APP_URL}
  Registry : ${REGISTRY}

Wire GitHub -> Azure (these are identifiers, not secrets):

  gh secret set AZURE_CLIENT_ID       -b "\$(terraform output -raw github_oidc_client_id)"
  gh secret set AZURE_TENANT_ID       -b "\$(terraform output -raw azure_tenant_id)"
  gh secret set AZURE_SUBSCRIPTION_ID -b "\$(terraform output -raw azure_subscription_id)"

From here on, every release goes through the pipeline: push to main.
---------------------------------------------------------------------------
EOF
