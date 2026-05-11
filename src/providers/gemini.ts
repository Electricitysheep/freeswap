import { BaseLLMProvider } from './base';
import { ProviderConfig, ProviderCapabilities, RateLimit } from '../types';

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
const HEALTH_CHECK_MODEL = 'gemini-2.5-flash';

const CAPABILITIES: ProviderCapabilities = {
  toolUse: true,
  structuredOutput: true,
  vision: true,
  streaming: true,
  maxContext: 1000000,
  maxOutput: 8192,
};

const RATE_LIMIT: RateLimit = {
  rpm: 60,
  rpd: 1500,
  tpm: 1000000,
  tpd: 10000000,
};

export class GeminiProvider extends BaseLLMProvider {
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
