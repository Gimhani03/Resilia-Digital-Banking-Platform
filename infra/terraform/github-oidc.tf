# ---------------------------------------------------------------------------
# GitHub Actions -> Azure authentication, without a stored credential.
#
# A user-assigned managed identity carries federated credentials trusted by
# GitHub's OIDC issuer. At deploy time Actions mints a short-lived token that
# Azure exchanges for an access token scoped to this identity. Nothing
# long-lived is stored in the repository: no service principal password, no
# publish profile, no registry credential. The three values GitHub does hold
# (client id, tenant id, subscription id) are identifiers, not secrets.
#
# The `subject` on each credential is what makes this safe — only workflows on
# the named branch or environment of the named repository can assume it.
# ---------------------------------------------------------------------------

resource "azurerm_user_assigned_identity" "github" {
  name                = "id-${var.project}-github"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tags                = local.tags
}

locals {
  github_owner = split("/", var.github_repository)[0]
  github_repo  = split("/", var.github_repository)[1]

  # Two subject spellings. GitHub is migrating from the name-based `sub` to an
  # ID-qualified one that survives a rename; this repository already emits the
  # ID-qualified form. Azure matches `subject` exactly and supports no
  # wildcards, so both are registered rather than guessed at.
  github_subject_prefixes = {
    named     = "repo:${var.github_repository}"
    immutable = "repo:${local.github_owner}@${var.github_owner_id}/${local.github_repo}@${var.github_repository_id}"
  }

  # Three scopes, because the scope depends on how the *job* is declared, not
  # on the workflow. A job with `environment: production` — the deploy job —
  # gets `environment:production` as its subject scope and never
  # `ref:refs/heads/main`. Registering only the branch scope authenticates the
  # build job and then fails the deploy job.
  github_subject_scopes = {
    main = "ref:refs/heads/main"
    pr   = "pull_request"
    prod = "environment:production"
  }

  github_federated_subjects = {
    for pair in setproduct(keys(local.github_subject_prefixes), keys(local.github_subject_scopes)) :
    "${pair[0]}-${pair[1]}" => "${local.github_subject_prefixes[pair[0]]}:${local.github_subject_scopes[pair[1]]}"
  }
}

resource "azurerm_federated_identity_credential" "github" {
  for_each = local.github_federated_subjects

  name      = "github-${each.key}"
  parent_id = azurerm_user_assigned_identity.github.id
  audience  = ["api://AzureADTokenExchange"]
  issuer    = "https://token.actions.githubusercontent.com"
  subject   = each.value
}

# Deploy rights are scoped to this resource group only, never the subscription.
resource "azurerm_role_assignment" "github_contributor" {
  scope                = azurerm_resource_group.main.id
  role_definition_name = "Contributor"
  principal_id         = azurerm_user_assigned_identity.github.principal_id
}

# Push rights on the registry are granted separately and explicitly.
resource "azurerm_role_assignment" "github_acr_push" {
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPush"
  principal_id         = azurerm_user_assigned_identity.github.principal_id
}

output "github_oidc_client_id" {
  description = "Set as the AZURE_CLIENT_ID repository secret."
  value       = azurerm_user_assigned_identity.github.client_id
}

output "azure_tenant_id" {
  description = "Set as the AZURE_TENANT_ID repository secret."
  value       = data.azurerm_client_config.current.tenant_id
}

output "azure_subscription_id" {
  description = "Set as the AZURE_SUBSCRIPTION_ID repository secret."
  value       = data.azurerm_client_config.current.subscription_id
}
