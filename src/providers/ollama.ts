import { BaseLLMProvider } from './base';
import { ProviderConfig, ProviderCapabilities, RateLimit } from '../types';

const DEFAULT_BASE_URL = 'http://localhost:11434/v1';
const HEALTH_CHECK_MODEL = 'llama3.2';

const CAPABILITIES: ProviderCapabilities = {
  toolUse: true,
  structuredOutput: true,
  vision: true,
  streaming: true,
  maxContext: 128000,
  maxOutput: 4096,
};

const RATE_LIMIT: RateLimit = {
  rpm: 0,
  rpd: 0,
  tpm: 0,
  tpd: 0,
};

export class OllamaProvider extends BaseLLMProvider {
  protected capabilities = CAPABILITIES;
  protected rateLimit = RATE_LIMIT;
  protected healthCheckModel = HEALTH_CHECK_MODEL;

  constructor(config: ProviderConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || DEFAULT_BASE_URL,
    });
  }

  isEnabled(): boolean {
    return true;
  }
}
