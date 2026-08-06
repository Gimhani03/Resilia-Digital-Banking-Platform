# ---------------------------------------------------------------------------
# Data-plane access to the remote state container.
#
# The backend in providers.tf uses `use_azuread_auth`, so reading and writing
# state is authorised by Entra RBAC rather than a storage account key. Control
# plane rights over the storage account — Owner, Contributor — deliberately do
# not grant data plane access to the blobs inside it, which is why an operator
# who can see the account in the portal still gets 403
# AuthorizationPermissionMismatch from `terraform init`.
#
# Granting it here keeps the rule discoverable and reviewable instead of living
# in one person's shell history. The container itself is created by
# infra/scripts/bootstrap.sh: a backend cannot be provisioned by the state it
# is going to hold, which is the chicken-and-egg every remote backend has.
# ---------------------------------------------------------------------------

variable "state_reader_object_ids" {
  description = <<-EOT
    Entra object ids permitted to read and write Terraform state.

    Supplied through a gitignored tfvars file — these identify real people, and
    this repository is public.
  EOT
  type        = list(string)
  default     = []
}

resource "azurerm_role_assignment" "state_blob_access" {
  for_each = toset(var.state_reader_object_ids)

  scope                = azurerm_storage_account.uploads.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = each.value
}
