resource "azurerm_resource_group" "app" {
  name     = "eight-queens-rg"
  location = var.location
}
