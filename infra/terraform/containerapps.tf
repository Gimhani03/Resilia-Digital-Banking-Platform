# ---------------------------------------------------------------------------
# Service topology.
#
# The API ships as one image that loads every Nest module — this keeps the
# in-process dependency graph (PaymentsService -> FraudService -> Identity)
# intact. What differs per deployment is SERVICE_ROLE, which decides *which
# controllers that container mounts*. Each role is an independently deployable,
# independently scalable Container App owning a disjoint slice of the route
# space. See DEPLOYMENT.md for exactly what this is and is not.
# ---------------------------------------------------------------------------

locals {
  api_image = "${azurerm_container_registry.main.login_server}/resilia-api:${var.container_image_tag}"
  web_image = "${azurerm_container_registry.main.login_server}/resilia-web:${var.container_image_tag}"

  # Runtime configuration shared by every API role.
  api_common_env = {
    NODE_ENV     = "production"
    PORT         = "3001"
    DEMO_MODE    = var.demo_mode ? "true" : "false"
    AZURE_REGION = var.location
    # Points at the mounted Azure Files share, not the container filesystem.
    UPLOAD_DIR = "/mnt/uploads"
  }
}

# ---------------------------------------------------------------------------
# API — core role. Owns identity, accounts, audit and notifications, and is
# the single writer of schema migrations and demo seed data.
# ---------------------------------------------------------------------------
resource "azurerm_container_app" "api_core" {
  name                         = "${var.project}-api-core"
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Multiple"
  tags                         = merge(local.tags, { role = "core" })

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }

  registry {
    server   = azurerm_container_registry.main.login_server
    identity = azurerm_user_assigned_identity.app.id
  }

  dynamic "secret" {
    for_each = local.api_secrets
    content {
      name                = secret.key
      identity            = azurerm_user_assigned_identity.app.id
      key_vault_secret_id = secret.value
    }
  }

  ingress {
    external_enabled = false
    target_port      = 3001
    transport        = "auto"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 1
    max_replicas = 5

    container {
      name   = "api"
      image  = local.api_image
      cpu    = 0.5
      memory = "1Gi"

      dynamic "env" {
        for_each = local.api_common_env
        content {
          name  = env.key
          value = env.value
        }
      }

      env {
        name  = "SERVICE_ROLE"
        value = "core"
      }

      # Exactly one service owns `prisma db push` and the idempotent seed.
      env {
        name  = "RUN_MIGRATIONS"
        value = "true"
      }

      dynamic "env" {
        for_each = local.api_secret_env
        content {
          name        = env.key
          secret_name = env.value
        }
      }

      env {
        name  = "APPLICATIONINSIGHTS_CONNECTION_STRING"
        value = azurerm_application_insights.main.connection_string
      }

      liveness_probe {
        transport               = "HTTP"
        port                    = 3001
        path                    = "/api/health"
        initial_delay           = 20
        interval_seconds        = 30
        failure_count_threshold = 5
      }

      readiness_probe {
        transport               = "HTTP"
        port                    = 3001
        path                    = "/api/health"
        interval_seconds        = 10
        failure_count_threshold = 6
      }

      volume_mounts {
        name = "kyc-uploads"
        path = "/mnt/uploads"
      }
    }

    volume {
      name         = "kyc-uploads"
      storage_name = azurerm_container_app_environment_storage.kyc.name
      storage_type = "AzureFile"
    }

    http_scale_rule {
      name                = "http-concurrency"
      concurrent_requests = 50
    }
  }

  lifecycle {
    # CI is the deploy path: it publishes a new revision with a digest-pinned
    # image. Terraform must not roll that back on the next plan.
    #
    # Traffic weights are owned by the pipeline for the same reason. Under
    # `Multiple` revision mode the canary moves weight between revisions whose
    # suffixes Terraform cannot know at plan time, so re-applying must not
    # reset the split — least of all mid-rollout.
    ignore_changes = [
      template[0].container[0].image,
      ingress[0].traffic_weight,
    ]
  }

  depends_on = [azurerm_role_assignment.acr_pull, azurerm_role_assignment.kv_reader]
}

# ---------------------------------------------------------------------------
# API — payments role. Owns payments, fraud, cards, loans and the ops console
# API. Scales more aggressively than core because it carries the transaction
# path, and never runs migrations.
# ---------------------------------------------------------------------------
resource "azurerm_container_app" "api_payments" {
  name                         = "${var.project}-api-payments"
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Multiple"
  tags                         = merge(local.tags, { role = "payments" })

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }

  registry {
    server   = azurerm_container_registry.main.login_server
    identity = azurerm_user_assigned_identity.app.id
  }

  dynamic "secret" {
    for_each = local.api_secrets
    content {
      name                = secret.key
      identity            = azurerm_user_assigned_identity.app.id
      key_vault_secret_id = secret.value
    }
  }

  ingress {
    external_enabled = false
    target_port      = 3001
    transport        = "auto"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 1
    max_replicas = 10

    container {
      name   = "api"
      image  = local.api_image
      cpu    = 0.5
      memory = "1Gi"

      dynamic "env" {
        for_each = local.api_common_env
        content {
          name  = env.key
          value = env.value
        }
      }

      env {
        name  = "SERVICE_ROLE"
        value = "payments"
      }

      env {
        name  = "RUN_MIGRATIONS"
        value = "false"
      }

      dynamic "env" {
        for_each = local.api_secret_env
        content {
          name        = env.key
          secret_name = env.value
        }
      }

      env {
        name  = "APPLICATIONINSIGHTS_CONNECTION_STRING"
        value = azurerm_application_insights.main.connection_string
      }

      liveness_probe {
        transport               = "HTTP"
        port                    = 3001
        path                    = "/api/health"
        initial_delay           = 20
        interval_seconds        = 30
        failure_count_threshold = 5
      }

      readiness_probe {
        transport               = "HTTP"
        port                    = 3001
        path                    = "/api/health"
        interval_seconds        = 10
        failure_count_threshold = 6
      }

      volume_mounts {
        name = "kyc-uploads"
        path = "/mnt/uploads"
      }
    }

    volume {
      name         = "kyc-uploads"
      storage_name = azurerm_container_app_environment_storage.kyc.name
      storage_type = "AzureFile"
    }

    http_scale_rule {
      name                = "http-concurrency"
      concurrent_requests = 30
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].container[0].image,
      ingress[0].traffic_weight,
    ]
  }

  depends_on = [azurerm_role_assignment.acr_pull, azurerm_role_assignment.kv_reader]
}

# ---------------------------------------------------------------------------
# Web — the only externally reachable surface. nginx serves the Vite bundle
# and reverse-proxies /api by route prefix to the matching internal API role,
# which is what lets the SPA keep its same-origin `const API = "/api"`.
# ---------------------------------------------------------------------------
resource "azurerm_container_app" "web" {
  name                         = "${var.project}-web"
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Multiple"
  tags                         = merge(local.tags, { role = "web" })

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }

  registry {
    server   = azurerm_container_registry.main.login_server
    identity = azurerm_user_assigned_identity.app.id
  }

  ingress {
    external_enabled           = true
    target_port                = 8080
    transport                  = "auto"
    allow_insecure_connections = false

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 1
    max_replicas = 5

    container {
      name   = "web"
      image  = local.web_image
      cpu    = 0.25
      memory = "0.5Gi"

      env {
        name  = "API_CORE_HOST"
        value = azurerm_container_app.api_core.ingress[0].fqdn
      }

      env {
        name  = "API_PAYMENTS_HOST"
        value = azurerm_container_app.api_payments.ingress[0].fqdn
      }

      liveness_probe {
        transport               = "HTTP"
        port                    = 8080
        path                    = "/healthz"
        initial_delay           = 5
        interval_seconds        = 30
        failure_count_threshold = 5
      }

      readiness_probe {
        transport               = "HTTP"
        port                    = 8080
        path                    = "/healthz"
        interval_seconds        = 10
        failure_count_threshold = 6
      }
    }

    http_scale_rule {
      name                = "http-concurrency"
      concurrent_requests = 100
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].container[0].image,
      ingress[0].traffic_weight,
    ]
  }

  depends_on = [azurerm_role_assignment.acr_pull]
}

locals {
  # Container-app secret name -> Key Vault secret reference. Terraform never
  # writes the plaintext into the app definition; the platform resolves each
  # reference at start using the user-assigned identity.
  api_secrets = {
    "database-url" = azurerm_key_vault_secret.database_url.versionless_id
    "jwt-secret"   = azurerm_key_vault_secret.jwt_secret.versionless_id
    "redis-url"    = azurerm_key_vault_secret.redis_url.versionless_id
  }

  # Environment variable name -> container-app secret name.
  api_secret_env = {
    DATABASE_URL = "database-url"
    JWT_SECRET   = "jwt-secret"
    REDIS_URL    = "redis-url"
  }
}
