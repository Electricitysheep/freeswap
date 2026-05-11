import { BaseLLMProvider } from './base';
import { ProviderConfig, ProviderCapabilities, RateLimit } from '../types';

const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const HEALTH_CHECK_MODEL = 'meta/llama-3.3-70b-instruct';

const CAPABILITIES: ProviderCapabilities = {
  toolUse: false,
  structuredOutput: true,
  vision: false,
  streaming: true,
  maxContext: 128000,
  maxOutput: 4096,
};

const RATE_LIMIT: RateLimit = {
  rpm: 20,
  rpd: 1000,
  tpm: 100000,
  tpd: 1000000,
};

export class NvidiaNimProvider extends BaseLLMProvider {
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
