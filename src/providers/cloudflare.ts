import { BaseLLMProvider } from './base';
import { ProviderConfig, ProviderCapabilities, RateLimit } from '../types';

const DEFAULT_BASE_URL = 'https://api.cloudflare.com/client/v4/accounts';
const HEALTH_CHECK_MODEL = '@cf/meta/llama-3.1-8b-instruct';

const CAPABILITIES: ProviderCapabilities = {
  toolUse: false,
  structuredOutput: true,
  vision: false,
  streaming: true,
  maxContext: 32000,
  maxOutput: 4096,
};

const RATE_LIMIT: RateLimit = {
  rpm: 300,
  rpd: 10000,
  tpm: 100000,
  tpd: 1000000,
};

export class CloudflareProvider extends BaseLLMProvider {
  protected capabilities = CAPABILITIES;
  protected rateLimit = RATE_LIMIT;
  protected healthCheckModel = HEALTH_CHECK_MODEL;

  constructor(config: ProviderConfig) {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
    let baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    if (accountId) {
      baseUrl = `${baseUrl.replace(/\/$/, '')}/${accountId}/ai/v1`;
    }
    super({
      ...config,
      baseUrl,
    });
  }
}
