resource "random_password" "postgres" {
  length           = 28
  special          = true
  override_special = "!#$%*-_=+"
}

locals {
  postgres_password = coalesce(var.postgres_admin_password, random_password.postgres.result)
}

# ---------------------------------------------------------------------------
# PostgreSQL Flexible Server. Burstable B1ms is the smallest tier that still
# supports the flexible-server feature set; it is sized for a demo workload,
# not for production throughput.
# ---------------------------------------------------------------------------
resource "azurerm_postgresql_flexible_server" "main" {
  name                          = "psql-${var.project}-${local.suffix}"
  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  version                       = "16"
  administrator_login           = var.postgres_admin_user
  administrator_password        = local.postgres_password
  sku_name                      = "B_Standard_B1ms"
  storage_mb                    = 32768
  backup_retention_days         = 7
  geo_redundant_backup_enabled  = false
  public_network_access_enabled = true
  zone                          = "1"
  tags                          = local.tags

  lifecycle {
    ignore_changes = [zone, high_availability[0].standby_availability_zone]
  }
}

resource "azurerm_postgresql_flexible_server_database" "main" {
  name      = "resilia"
  server_id = azurerm_postgresql_flexible_server.main.id
  collation = "en_US.utf8"
  charset   = "utf8"

  lifecycle {
    prevent_destroy = false
  }
}

# Container Apps egresses from the platform's shared outbound range, so the
# server is reachable from Azure services only — never from the open internet
# without an explicit rule.
resource "azurerm_postgresql_flexible_server_firewall_rule" "azure_services" {
  name             = "allow-azure-services"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

locals {
  database_url = format(
    "postgresql://%s:%s@%s:5432/%s?sslmode=require",
    var.postgres_admin_user,
    urlencode(local.postgres_password),
    azurerm_postgresql_flexible_server.main.fqdn,
    azurerm_postgresql_flexible_server_database.main.name,
  )
}

# ---------------------------------------------------------------------------
# Redis — used for OTP challenges, rate-limit counters and session lookups.
# Optional: RedisService degrades to an in-process store when REDIS_URL is
# absent, which keeps the demo alive if this resource is skipped.
# ---------------------------------------------------------------------------
resource "azurerm_redis_cache" "main" {
  count = var.enable_redis ? 1 : 0

  name                          = "redis-${var.project}-${local.suffix}"
  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  capacity                      = 0
  family                        = "C"
  sku_name                      = "Basic"
  minimum_tls_version           = "1.2"
  non_ssl_port_enabled          = false
  public_network_access_enabled = true
  tags                          = local.tags
}

locals {
  redis_url = var.enable_redis ? format(
    "rediss://:%s@%s:6380",
    urlencode(azurerm_redis_cache.main[0].primary_access_key),
    azurerm_redis_cache.main[0].hostname,
  ) : ""
}

# ---------------------------------------------------------------------------
# Shared storage for KYC capture.
#
# LocalObjectStore writes to UPLOAD_DIR on the container filesystem, which pins
# the API to a single replica: a KYC photo captured on replica 1 is invisible
# to the officer queue served by replica 2, and is lost when the replica
# recycles. Mounting an Azure Files share at that path makes the directory
# shared and durable without touching the upload code — the API keeps writing
# to a POSIX path and scaling is no longer blocked.
# ---------------------------------------------------------------------------
resource "azurerm_storage_account" "uploads" {
  name                            = "st${var.project}${local.suffix}"
  resource_group_name             = azurerm_resource_group.main.name
  location                        = azurerm_resource_group.main.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  tags                            = local.tags
}

resource "azurerm_storage_share" "kyc" {
  name               = "kyc-uploads"
  storage_account_id = azurerm_storage_account.uploads.id
  quota              = 50
}

# Registers the share with the Container Apps environment so any app in it can
# mount the volume.
resource "azurerm_container_app_environment_storage" "kyc" {
  name                         = "kyc-uploads"
  container_app_environment_id = azurerm_container_app_environment.main.id
  account_name                 = azurerm_storage_account.uploads.name
  share_name                   = azurerm_storage_share.kyc.name
  access_key                   = azurerm_storage_account.uploads.primary_access_key
  access_mode                  = "ReadWrite"
}
