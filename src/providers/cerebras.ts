import { BaseLLMProvider } from './base';
import { ProviderConfig, ProviderCapabilities, RateLimit } from '../types';

const DEFAULT_BASE_URL = 'https://api.cerebras.ai/v1';
const HEALTH_CHECK_MODEL = 'llama-3.3-70b';

const CAPABILITIES: ProviderCapabilities = {
  toolUse: false,
  structuredOutput: true,
  vision: false,
  streaming: true,
  maxContext: 128000,
  maxOutput: 4096,
};

const RATE_LIMIT: RateLimit = {
  rpm: 30,
  rpd: 10000,
  tpm: 60000,
  tpd: 1000000,
};

export class CerebrasProvider extends BaseLLMProvider {
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
