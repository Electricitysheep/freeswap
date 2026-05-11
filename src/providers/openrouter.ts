import { BaseLLMProvider } from './base';
import { ProviderConfig, ProviderCapabilities, RateLimit } from '../types';

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const HEALTH_CHECK_MODEL = 'openrouter/free';

const CAPABILITIES: ProviderCapabilities = {
  toolUse: true,
  structuredOutput: true,
  vision: true,
  streaming: true,
  maxContext: 128000,
  maxOutput: 4096,
};

const RATE_LIMIT: RateLimit = {
  rpm: 20,
  rpd: 200,
  tpm: 20000,
  tpd: 100000,
};

export class OpenRouterProvider extends BaseLLMProvider {
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
