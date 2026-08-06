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
  description = "Azure region for all resources."
  type        = string
  default     = "southeastasia"
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
  description = "Provision Azure Cache for Redis. The API degrades to an in-process store when false."
  type        = bool
  default     = true
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
