import { AppConfigurationClient } from '@azure/app-configuration';
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';

/**
 * Fetches application configuration from Azure App Configuration and Key Vault.
 *
 * Environment variables consumed:
 *   AZURE_APP_CONFIG_ENDPOINT  - App Configuration endpoint URL
 *   APP_CONFIG_PREFIX          - key prefix (e.g. "queens")
 *   KEY_VAULT_URL              - Key Vault endpoint URL
 */
export async function fetchAppConfig() {
  const appConfigEndpoint = process.env.AZURE_APP_CONFIG_ENDPOINT;
  if (!appConfigEndpoint) {
    throw new Error('AZURE_APP_CONFIG_ENDPOINT environment variable is not set.');
  }

  const prefix = process.env.APP_CONFIG_PREFIX;
  if (!prefix) {
    throw new Error('APP_CONFIG_PREFIX environment variable is not set.');
  }

  const keyVaultUrl = process.env.KEY_VAULT_URL;
  if (!keyVaultUrl) {
    throw new Error('KEY_VAULT_URL environment variable is not set.');
  }

  const credential = new DefaultAzureCredential();
  const appConfigClient = new AppConfigurationClient(appConfigEndpoint, credential);
  const kvClient = new SecretClient(keyVaultUrl, credential);

  // Resolve an App Config Key Vault reference to its actual secret value
  async function resolveKvReference(setting) {
    const { uri } = JSON.parse(setting.value);
    const secretName = new URL(uri).pathname.split('/')[2];
    return (await kvClient.getSecret(secretName)).value;
  }

  // Per-app values (prefixed)
  const [cosmosEndpointSetting] = await Promise.all([
    appConfigClient.getConfigurationSetting({ key: `${prefix}/cosmos_db_endpoint` }),
  ]);

  // Shared Google OAuth KV references (unprefixed, set by infra-bootstrap)
  const [googleClientIdSetting] = await Promise.all([
    appConfigClient.getConfigurationSetting({ key: 'google_oauth_client_id' }),
  ]);

  const googleClientId = await resolveKvReference(googleClientIdSetting);

  // Owner email from Key Vault
  const ownerEmail = (await kvClient.getSecret('eight-queens-owner-email')).value;

  const config = {
    cosmosDbEndpoint: cosmosEndpointSetting.value,
    googleClientId,
    ownerEmail,
  };

  for (const [key, value] of Object.entries(config)) {
    if (!value) {
      throw new Error(`Configuration value "${key}" is missing or empty.`);
    }
  }

  console.log('[appConfig] Application config loaded from App Configuration + Key Vault');
  return config;
}
