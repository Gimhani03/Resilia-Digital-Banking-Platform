terraform {
  required_version = ">= 1.5.0"

  # Remote state.
  #
  # State was previously a file on whichever laptop last ran `apply`. It holds
  # the generated Postgres password and JWT secret in plaintext, so it could
  # not be committed — which made the infrastructure unmanageable from anywhere
  # else, and unrecoverable if that one machine were lost.
  #
  # It now lives in the storage account this configuration already creates,
  # where Azure encrypts it at rest and every apply takes a blob lease. That
  # lease is the lock: two concurrent applies cannot interleave and corrupt
  # each other, which matters as soon as more than one person can deploy.
  #
  # `use_azuread_auth` means access is the caller's own Entra identity through
  # RBAC, so no storage account key is stored, passed, or rotated. The
  # container is created before this block can be used — see
  # infra/scripts/bootstrap.sh, which is the chicken-and-egg any remote backend
  # has.
  backend "azurerm" {
    resource_group_name  = "rg-resilia-prod"
    storage_account_name = "stresiliac4630"
    container_name       = "tfstate"
    key                  = "prod.terraform.tfstate"
    use_azuread_auth     = true
  }

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.20"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = true
      recover_soft_deleted_key_vaults = true
    }
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }
}

data "azurerm_client_config" "current" {}

resource "random_string" "suffix" {
  length  = 5
  upper   = false
  special = false
}

locals {
  suffix = random_string.suffix.result

  tags = {
    project     = "resilia"
    environment = var.environment
    competition = "duothan-6.0-phase-3"
    managed_by  = "terraform"
  }
}
