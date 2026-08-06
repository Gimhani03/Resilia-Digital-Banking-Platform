output "app_url" {
  description = "Public HTTPS URL of the RESILIA demo surface."
  value       = "https://${azurerm_container_app.web.ingress[0].fqdn}"
}

output "acr_login_server" {
  description = "Container registry CI builds into."
  value       = azurerm_container_registry.main.login_server
}

output "acr_name" {
  description = "Container registry short name, for `az acr build`."
  value       = azurerm_container_registry.main.name
}

output "resource_group" {
  value = azurerm_resource_group.main.name
}

output "api_core_fqdn" {
  description = "Internal ingress host for the core API role."
  value       = azurerm_container_app.api_core.ingress[0].fqdn
}

output "api_payments_fqdn" {
  description = "Internal ingress host for the payments API role."
  value       = azurerm_container_app.api_payments.ingress[0].fqdn
}

output "key_vault_name" {
  value = azurerm_key_vault.main.name
}

output "application_insights_name" {
  value = azurerm_application_insights.main.name
}

output "postgres_fqdn" {
  value = azurerm_postgresql_flexible_server.main.fqdn
}

output "managed_identity_client_id" {
  value = azurerm_user_assigned_identity.app.client_id
}
