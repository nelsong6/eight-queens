# ============================================================================
# Azure Key Vault (data source)
# ============================================================================
# Reads secrets from the shared Key Vault created by the bootstrap script.
# The vault name is passed via the Spacelift global context (TF_VAR_key_vault_name).

data "azurerm_key_vault" "main" {
  name                = var.key_vault_name
  resource_group_name = local.infra.resource_group_name
}
