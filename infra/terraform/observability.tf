# ---------------------------------------------------------------------------
# Operational visibility: Log Analytics collects container stdout/stderr and
# the Container Apps system log stream; Application Insights receives traces
# and live metrics from the API via the OpenTelemetry agent built into the
# Container Apps environment.
# ---------------------------------------------------------------------------
resource "azurerm_log_analytics_workspace" "main" {
  name                = "log-${var.project}-${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.tags
}

resource "azurerm_application_insights" "main" {
  name                = "appi-${var.project}-${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "Node.JS"
  tags                = local.tags
}

resource "azurerm_container_app_environment" "main" {
  name                       = "cae-${var.project}-${var.environment}"
  resource_group_name        = azurerm_resource_group.main.name
  location                   = azurerm_resource_group.main.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  tags                       = local.tags
}

# ---------------------------------------------------------------------------
# Alerting: availability of the public surface is the single signal that most
# closely tracks "is the demo up".
# ---------------------------------------------------------------------------
# An action group with no receiver is a rule that fires into nothing. The
# address is supplied through a gitignored tfvars file rather than committed,
# so a public repository never carries a personal inbox — set `ops_alert_email`
# to enable delivery.
resource "azurerm_monitor_action_group" "ops" {
  name                = "ag-${var.project}-ops"
  resource_group_name = azurerm_resource_group.main.name
  short_name          = "resiliaops"
  tags                = local.tags

  dynamic "email_receiver" {
    for_each = var.ops_alert_email == "" ? [] : [var.ops_alert_email]
    content {
      name                    = "ops-oncall"
      email_address           = email_receiver.value
      use_common_alert_schema = true
    }
  }
}

resource "azurerm_monitor_metric_alert" "api_failures" {
  name                = "alert-${var.project}-api-5xx"
  resource_group_name = azurerm_resource_group.main.name
  scopes              = [azurerm_application_insights.main.id]
  description         = "Fires when the API reports failed requests over a 5-minute window."
  frequency           = "PT1M"
  window_size         = "PT5M"
  severity            = 2

  criteria {
    metric_namespace = "microsoft.insights/components"
    metric_name      = "requests/failed"
    aggregation      = "Count"
    operator         = "GreaterThan"
    threshold        = 5
  }

  action {
    action_group_id = azurerm_monitor_action_group.ops.id
  }

  tags = local.tags
}

# ---------------------------------------------------------------------------
# Synthetic availability monitoring.
#
# Every other signal in this stack is reported by the platform about itself: if
# ingress is broken, or the managed certificate lapses, the instrumentation
# inside the container has no way to say so. This probes the public URL from
# outside Azure entirely, on a fixed interval, and is the only check that can
# still fail when the application believes it is healthy.
#
# It also asserts the TLS certificate has more than seven days left, which is
# the failure nobody notices until the morning it happens.
# ---------------------------------------------------------------------------
resource "azurerm_application_insights_standard_web_test" "edge" {
  count = var.enable_availability_test ? 1 : 0

  name                    = "webtest-${var.project}-edge"
  resource_group_name     = azurerm_resource_group.main.name
  location                = var.availability_test_location
  application_insights_id = azurerm_application_insights.main.id
  description             = "Probes the public edge from outside Azure."
  enabled                 = true
  frequency               = 300
  timeout                 = 30
  retry_enabled           = true
  geo_locations           = var.availability_test_geo_locations
  tags                    = local.tags

  request {
    url = "https://${azurerm_container_app.web.ingress[0].fqdn}/healthz"
  }

  validation_rules {
    expected_status_code        = 200
    ssl_check_enabled           = true
    ssl_cert_remaining_lifetime = 7
  }
}

resource "azurerm_monitor_metric_alert" "edge_availability" {
  count = var.enable_availability_test ? 1 : 0

  name                = "alert-${var.project}-edge-down"
  resource_group_name = azurerm_resource_group.main.name
  scopes = [
    azurerm_application_insights_standard_web_test.edge[0].id,
    azurerm_application_insights.main.id,
  ]
  description = "Fires when the public edge fails its synthetic probe."
  frequency   = "PT1M"
  window_size = "PT5M"
  severity    = 1

  application_insights_web_test_location_availability_criteria {
    web_test_id           = azurerm_application_insights_standard_web_test.edge[0].id
    component_id          = azurerm_application_insights.main.id
    failed_location_count = 1
  }

  action {
    action_group_id = azurerm_monitor_action_group.ops.id
  }

  tags = local.tags
}
