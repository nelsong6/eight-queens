locals {
  _sub = "aee0cbd2-8074-4001-b610-0f8edb4eaa3c"
}

import {
  to = azurerm_resource_group.app
  id = "/subscriptions/${local._sub}/resourceGroups/eight-queens-rg"
}

import {
  to = azurerm_static_web_app.app
  id = "/subscriptions/${local._sub}/resourceGroups/eight-queens-rg/providers/Microsoft.Web/staticSites/eight-queens-app"
}

import {
  to = azurerm_dns_cname_record.frontend
  id = "/subscriptions/${local._sub}/resourceGroups/infra/providers/Microsoft.Network/dnsZones/romaine.life/CNAME/queens"
}

import {
  to = azurerm_static_web_app_custom_domain.frontend
  id = "/subscriptions/${local._sub}/resourceGroups/eight-queens-rg/providers/Microsoft.Web/staticSites/eight-queens-app/customDomains/queens.romaine.life"
}
