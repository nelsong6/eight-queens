output "resource_group_name" {
  value       = azurerm_resource_group.app.name
  description = "Name of the resource group"
}

output "static_web_app_name" {
  value       = azurerm_static_web_app.app.name
  description = "Name of the Azure Static Web App"
}

output "static_web_app_hostname" {
  value       = "${local.front_app_dns_name}.${local.infra.dns_zone_name}"
  description = "Custom domain hostname of the Static Web App"
}
