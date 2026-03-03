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

output "cosmos_db_name" {
  value       = local.infra.cosmos_db_account_name
  description = "Cosmos DB account name"
}

output "cosmos_db_database_name" {
  value       = azurerm_cosmosdb_sql_database.app.name
  description = "Cosmos DB database name"
}

output "cosmos_db_container_name" {
  value       = azurerm_cosmosdb_sql_container.runs.name
  description = "Cosmos DB container name for run data"
}

output "backend_api_url" {
  value       = "https://${local.back_app_dns_name}.${local.infra.dns_zone_name}"
  description = "The URL of the backend Container App API"
}

output "container_app_name" {
  value       = azurerm_container_app.api["queens-api"].name
  description = "Name of the backend Container App"
}

output "container_app_default_fqdn" {
  value       = azurerm_container_app.api["queens-api"].ingress[0].fqdn
  description = "Default Azure-assigned FQDN for the backend Container App"
}

output "app_config_prefix" {
  value       = local.front_app_dns_name
  description = "App Configuration key prefix, derived from the frontend DNS name"
}
