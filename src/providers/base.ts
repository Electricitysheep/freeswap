import OpenAI from 'openai';
import {
  ProviderConfig,
  ProviderHealth,
  RateLimit,
  ProviderCapabilities,
  ProviderId,
  ApiError,
} from '../types';

export interface CompletionOptions {
  model: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  tools?: OpenAI.ChatCompletionTool[];
  response_format?: OpenAI.ChatCompletionCreateParams['response_format'];
  [key: string]: unknown;
}

export abstract class BaseLLMProvider {
  protected client: OpenAI;
  protected config: ProviderConfig;
  protected keyIndex = 0;
  protected abstract capabilities: ProviderCapabilities;
  protected abstract rateLimit: RateLimit;
  protected health: ProviderHealth;
  protected abstract healthCheckModel: string;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.health = {
      providerId: config.id,
      status: 'unknown',
      lastSuccess: null,
      lastFailure: null,
      consecutiveFailures: 0,
      circuitState: 'closed',
      avgLatencyMs: 0,
      errorRate: 0,
    };
    this.client = this.createClient();
  }

  protected createClient(): OpenAI {
    return new OpenAI({
      baseURL: this.config.baseUrl,
      apiKey: this.getCurrentKey(),
      timeout: 30000,
      maxRetries: 0,
    });
  }

  protected refreshClient(): void {
    this.client = this.createClient();
  }

  getCurrentKey(): string {
    if (this.config.apiKeys.length === 0) {
      return '';
    }
    const key = this.config.apiKeys[this.keyIndex];
    this.keyIndex = (this.keyIndex + 1) % this.config.apiKeys.length;
    return key;
  }

  peekCurrentKey(): string {
    if (this.config.apiKeys.length === 0) {
      return '';
    }
    return this.config.apiKeys[this.keyIndex];
  }

  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  getApiKeys(): string[] {
    return [...this.config.apiKeys];
  }

  getRateLimit(): RateLimit {
    return this.rateLimit;
  }

  supportsFeature(feature: keyof ProviderCapabilities): boolean {
    return !!this.capabilities[feature];
  }

  getCapabilities(): ProviderCapabilities {
    return { ...this.capabilities };
  }

  getProviderId(): ProviderId {
    return this.config.id;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  async chatCompletion(
    messages: OpenAI.ChatCompletionMessageParam[],
    options: CompletionOptions
  ): Promise<OpenAI.ChatCompletion | ApiError> {
    this.refreshClient();
    const start = Date.now();
    try {
      const response = await this.client.chat.completions.create({
        model: options.model,
        messages,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
        top_p: options.top_p,
        frequency_penalty: options.frequency_penalty,
        presence_penalty: options.presence_penalty,
        stop: options.stop,
        tools: options.tools,
        response_format: options.response_format,
      });
      this.recordSuccess(Date.now() - start);
      return response;
    } catch (error: unknown) {
      this.recordFailure();
      return this.handleError(error);
    }
  }

  async *streamChatCompletion(
    messages: OpenAI.ChatCompletionMessageParam[],
    options: CompletionOptions
  ): AsyncIterable<OpenAI.ChatCompletionChunk | ApiError> {
    this.refreshClient();
    try {
      const stream = await this.client.chat.completions.create({
        model: options.model,
        messages,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
        top_p: options.top_p,
        frequency_penalty: options.frequency_penalty,
        presence_penalty: options.presence_penalty,
        stop: options.stop,
        tools: options.tools,
        response_format: options.response_format,
        stream: true,
      });
      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error: unknown) {
      yield this.handleError(error);
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    this.refreshClient();
    const start = Date.now();
    try {
      await this.client.chat.completions.create({
        model: this.healthCheckModel,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      });
      this.recordSuccess(Date.now() - start);
    } catch (error: unknown) {
      const err = error as {
        status?: number;
        message?: string;
        code?: string;
        headers?: Record<string, string>;
      };
      if (err.status === 404) {
        this.recordSuccess(Date.now() - start);
      } else if (err.status === 429) {
        this.recordSuccess(Date.now() - start);
        this.health.status = 'degraded';
      } else if (err.status === 401 || err.status === 403) {
        this.recordFailure();
        this.health.status = 'down';
      } else {
        this.recordFailure();
      }
    }
    return this.health;
  }

  protected recordSuccess(latencyMs: number): void {
    this.health.lastSuccess = Date.now();
    this.health.consecutiveFailures = 0;
    this.health.circuitState = 'closed';
    this.health.avgLatencyMs =
      this.health.avgLatencyMs === 0
        ? latencyMs
        : Math.round(this.health.avgLatencyMs * 0.8 + latencyMs * 0.2);
    this.health.errorRate = Math.max(0, this.health.errorRate - 0.1);
    if (this.health.status !== 'degraded') {
      this.health.status = 'healthy';
    }
  }

  protected recordFailure(): void {
    this.health.lastFailure = Date.now();
    this.health.consecutiveFailures++;
    if (this.health.consecutiveFailures >= 5) {
      this.health.circuitState = 'open';
      this.health.status = 'down';
    } else if (this.health.consecutiveFailures >= 2) {
      this.health.circuitState = 'half-open';
      this.health.status = 'degraded';
    } else {
      this.health.status = 'degraded';
    }
    this.health.errorRate = Math.min(1, this.health.errorRate + 0.2);
  }

  protected handleError(error: unknown): ApiError {
    const err = error as {
      status?: number;
      message?: string;
      code?: string;
      headers?: Record<string, string>;
      type?: string;
    };
    const status = err.status ?? 500;
    let code = 'internal_error';
    let message = err.message ?? 'Unknown error';

    if (status === 429) {
      code = 'rate_limit_exceeded';
      const retryAfter = err.headers?.['retry-after'];
      message = `Rate limit exceeded. Retry after ${retryAfter ?? 'unknown'} seconds.`;
    } else if (status === 401 || status === 403) {
      code = 'authentication_error';
      message = 'Authentication failed. Check your API key.';
    } else if (status === 408) {
      code = 'timeout';
      message = 'Request timed out.';
    } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
      code = 'timeout';
      message = 'Connection timed out.';
    } else if (err.code === 'ECONNREFUSED') {
      code = 'connection_refused';
      message = 'Connection refused. Service may be unavailable.';
    }

    return {
      error: {
        message,
        type: (err as { type?: string }).type ?? 'provider_error',
        code,
      },
    };
  }
}
