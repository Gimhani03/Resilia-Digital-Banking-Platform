variable "project" {
  description = "Project short name, used as a prefix for every resource."
  type        = string
  default     = "resilia"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "prod"
}

variable "location" {
  description = <<-EOT
    Azure region for all resources.

    This subscription carries the "Allowed resource deployment regions" policy
    (Azure for Students), which permits only: eastasia, malaysiawest, uaenorth,
    indonesiacentral, centralindia. southeastasia is rejected at create time
    with RequestDisallowedByAzure, so it cannot be used here.

    centralindia is chosen as the closest allowed region to Sri Lanka, and it
    supports Container Apps, PostgreSQL Flexible Server B1ms on version 16, and
    Azure Cache for Redis.
  EOT
  type        = string
  default     = "centralindia"

  validation {
    condition = contains(
      ["eastasia", "malaysiawest", "uaenorth", "indonesiacentral", "centralindia"],
      var.location,
    )
    error_message = "Region not permitted by the subscription's allowed-regions policy. Choose one of: eastasia, malaysiawest, uaenorth, indonesiacentral, centralindia."
  }
}

variable "postgres_admin_user" {
  description = "PostgreSQL Flexible Server administrator login."
  type        = string
  default     = "resilia_admin"
}

variable "postgres_admin_password" {
  description = "PostgreSQL administrator password. Generated if left null."
  type        = string
  default     = null
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT signing secret for the API. Generated if left null."
  type        = string
  default     = null
  sensitive   = true
}

variable "demo_mode" {
  description = "Enables the deterministic demo OTP path used by the judging walkthrough."
  type        = bool
  default     = true
}

variable "enable_redis" {
  description = <<-EOT
    Provision Azure Cache for Redis.

    Defaults to false. Azure Cache for Redis is being retired and the API now
    refuses to create new instances ("Azure Cache for Redis is retiring, create
    Azure Managed Redis instance instead"). The replacement, Azure Managed
    Redis, starts well above this deployment's budget.

    With this off, RedisService falls back to its in-process store. That is a
    real degradation — OTP challenges and rate-limit counters become
    replica-local — and it is reported honestly rather than hidden:
    /api/health/ready returns `redis: degraded`, and the service logs the
    fallback at error level. See DEPLOYMENT.md.
  EOT
  type        = bool
  default     = false
}

variable "container_image_tag" {
  description = "Image tag deployed by Terraform on first apply. CI owns the tag thereafter."
  type        = string
  default     = "bootstrap"
}

variable "github_repository" {
  description = "owner/repo used to scope the OIDC federated credential."
  type        = string
  default     = "Gimhani03/Resilia-Digital-Banking-Platform"
}
