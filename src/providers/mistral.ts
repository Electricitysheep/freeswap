import { BaseLLMProvider } from './base';
import { ProviderConfig, ProviderCapabilities, RateLimit } from '../types';

const DEFAULT_BASE_URL = 'https://api.mistral.ai/v1';
const HEALTH_CHECK_MODEL = 'mistral-small-3.1-latest';

const CAPABILITIES: ProviderCapabilities = {
  toolUse: true,
  structuredOutput: true,
  vision: false,
  streaming: true,
  maxContext: 32000,
  maxOutput: 4096,
};

const RATE_LIMIT: RateLimit = {
  rpm: 1,
  rpd: 500,
  tpm: 500000,
  tpd: 1000000,
};

export class MistralProvider extends BaseLLMProvider {
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
