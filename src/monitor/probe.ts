// ============================================================
// FreeSwap - Health Probe
// ============================================================

import { ProviderHealth, ProviderId } from '../types';

/**
 * Minimal provider interface required by the health probe.
 * Concrete providers must implement at least this shape.
 */
export interface BaseLLMProvider {
  readonly id: ProviderId;
  chat(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
  }): Promise<{ content: string }>;
}

export interface HealthProbeOptions {
  /** Probe timeout in milliseconds (default: 5000) */
  timeoutMs?: number;
  /** Override the default test prompt */
  testPrompt?: string;
  /** Override the model name sent in the probe request */
  testModel?: string;
}

const DEFAULT_PROBE_TIMEOUT_MS = 5000;
const DEFAULT_TEST_PROMPT = "Say 'ok'";
const DEFAULT_TEST_MODEL = 'default';

/** Latency threshold (ms) above which a provider is considered degraded. */
const DEGRADED_LATENCY_MS = 2000;

/**
 * Probes a single LLM provider by sending a minimal chat request
 * and measuring round-trip latency.
 */
export class HealthProbe {
  private readonly timeoutMs: number;
  private readonly testPrompt: string;
  private readonly testModel: string;

  constructor(
    private readonly provider: BaseLLMProvider,
    options: HealthProbeOptions = {}
  ) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
    this.testPrompt = options.testPrompt ?? DEFAULT_TEST_PROMPT;
    this.testModel = options.testModel ?? DEFAULT_TEST_MODEL;
  }

  /**
   * Execute a single health probe against the bound provider.
   * @returns ProviderHealth for this probe attempt.
   */
  async probe(): Promise<ProviderHealth> {
    const startTime = Date.now();
    let status: ProviderHealth['status'] = 'unknown';
    let latencyMs = 0;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Probe timeout'));
        }, this.timeoutMs);
      });

      const chatPromise = this.provider.chat({
        model: this.testModel,
        messages: [{ role: 'user', content: this.testPrompt }],
      });

      await Promise.race([chatPromise, timeoutPromise]);
      latencyMs = Date.now() - startTime;
      status = latencyMs > DEGRADED_LATENCY_MS ? 'degraded' : 'healthy';
    } catch {
      latencyMs = Date.now() - startTime;
      status = 'down';
    }

    const now = Date.now();

    return {
      providerId: this.provider.id,
      status,
      lastSuccess: status !== 'down' ? now : null,
      lastFailure: status === 'down' ? now : null,
      consecutiveFailures: status === 'down' ? 1 : 0,
      circuitState: 'closed',
      avgLatencyMs: latencyMs,
      errorRate: status === 'down' ? 1 : 0,
    };
  }

  /**
   * Probe multiple providers in parallel.
   * @returns Map of providerId → ProviderHealth.
   */
  static async probeAll(
    providers: BaseLLMProvider[],
    options?: HealthProbeOptions
  ): Promise<Map<ProviderId, ProviderHealth>> {
    const probes = providers.map((provider) => {
      const probe = new HealthProbe(provider, options);
      return probe.probe();
    });

    const results = await Promise.allSettled(probes);
    const map = new Map<ProviderId, ProviderHealth>();

    results.forEach((result, index) => {
      const providerId = providers[index].id;

      if (result.status === 'fulfilled') {
        map.set(providerId, result.value);
      } else {
        const now = Date.now();
        map.set(providerId, {
          providerId,
          status: 'down',
          lastSuccess: null,
          lastFailure: now,
          consecutiveFailures: 1,
          circuitState: 'closed',
          avgLatencyMs: 0,
          errorRate: 1,
        });
      }
    });

    return map;
  }
}
