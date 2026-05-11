import { BaseLLMProvider } from './base';
import { ProviderConfig, ProviderCapabilities, RateLimit } from '../types';

const DEFAULT_BASE_URL = 'https://models.inference.ai.azure.com';
const HEALTH_CHECK_MODEL = 'gpt-4o-mini';

const CAPABILITIES: ProviderCapabilities = {
  toolUse: true,
  structuredOutput: true,
  vision: true,
  streaming: true,
  maxContext: 128000,
  maxOutput: 4096,
};

const RATE_LIMIT: RateLimit = {
  rpm: 15,
  rpd: 150,
  tpm: 100000,
  tpd: 1000000,
};

export class GitHubModelsProvider extends BaseLLMProvider {
  protected capabilities = CAPABILITIES;
  protected rateLimit = RATE_LIMIT;
  protected healthCheckModel = HEALTH_CHECK_MODEL;

  constructor(config: ProviderConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || DEFAULT_BASE_URL,
    });
  }
}
