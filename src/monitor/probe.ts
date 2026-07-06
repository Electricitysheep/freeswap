// ============================================================
// FreeSwap - Health Probe
// ============================================================

import { ProviderHealth, ProviderId } from '../types';

/**
 * Minimal provider interface required by the health probe.
 * Matches the concrete providers in src/providers/base.ts, which expose
 * getProviderId() and a self-contained healthCheck() that already knows
 * the provider's own health-check model.
 */
export interface BaseLLMProvider {
  getProviderId(): ProviderId;
  healthCheck(): Promise<ProviderHealth>;
}

export interface HealthProbeOptions {
  /** Probe timeout in milliseconds (default: 5000) */
  timeoutMs?: number;
}

const DEFAULT_PROBE_TIMEOUT_MS = 5000;

/**
 * Probes a single LLM provider by delegating to its healthCheck()
 * with a hard timeout.
 */
export class HealthProbe {
  private readonly timeoutMs: number;

  constructor(
    private readonly provider: BaseLLMProvider,
    options: HealthProbeOptions = {}
  ) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  }

  /**
   * Execute a single health probe against the bound provider.
   * @returns ProviderHealth for this probe attempt.
   */
  async probe(): Promise<ProviderHealth> {
    const startTime = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('Probe timeout'));
        }, this.timeoutMs);
      });

      const health = await Promise.race([
        this.provider.healthCheck(),
        timeoutPromise,
      ]);
      return health;
    } catch {
      return {
        providerId: this.provider.getProviderId(),
        status: 'down',
        lastSuccess: null,
        lastFailure: Date.now(),
        consecutiveFailures: 1,
        circuitState: 'closed',
        avgLatencyMs: Date.now() - startTime,
        errorRate: 1,
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
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
      const providerId = providers[index].getProviderId();

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
