resource "azurerm_resource_group" "main" {
  name     = "rg-${var.project}-${var.environment}"
  location = var.location
  tags     = local.tags
}

# ---------------------------------------------------------------------------
# Container Registry — single source of truth for every deployed image.
# CI authenticates to this registry via OIDC and runs `az acr build`, so no
# registry password is ever stored in GitHub.
# ---------------------------------------------------------------------------
resource "azurerm_container_registry" "main" {
  name                = "cr${var.project}${local.suffix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = false
  tags                = local.tags
}

# ---------------------------------------------------------------------------
# Workload identity. Every container app authenticates as this identity to
# pull images and to resolve Key Vault secret references. No connection
# strings or registry credentials live in the container spec.
# ---------------------------------------------------------------------------
resource "azurerm_user_assigned_identity" "app" {
  name                = "id-${var.project}-${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tags                = local.tags
}

resource "azurerm_role_assignment" "acr_pull" {
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}
