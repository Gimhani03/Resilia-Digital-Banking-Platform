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

resource "azurerm_federated_identity_credential" "main_branch" {
  name      = "github-main"
  parent_id = azurerm_user_assigned_identity.github.id
  audience  = ["api://AzureADTokenExchange"]
  issuer    = "https://token.actions.githubusercontent.com"
  subject   = "repo:${var.github_repository}:ref:refs/heads/main"
}

resource "azurerm_federated_identity_credential" "pull_request" {
  name      = "github-pr"
  parent_id = azurerm_user_assigned_identity.github.id
  audience  = ["api://AzureADTokenExchange"]
  issuer    = "https://token.actions.githubusercontent.com"
  subject   = "repo:${var.github_repository}:pull_request"
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
