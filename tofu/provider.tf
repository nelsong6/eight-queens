# required_providers is sourced at runtime using a hook in spacelift from infra-bootstrap.

provider "azurerm" {
  features {}
  use_oidc = true
}

provider "azapi" {
  use_oidc = true
}
