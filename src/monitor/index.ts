// ============================================================
// FreeSwap - Health Monitor Orchestrator
// ============================================================

import { ProviderHealth, ProviderId, FreeSwapConfig } from '../types';
import { CircuitBreaker } from './circuit-breaker';
import { BaseLLMProvider, HealthProbe } from './probe';
import winston from 'winston';

export type HealthChangeCallback = (
  providerId: ProviderId,
  oldState: ProviderHealth['status'] | null,
  newState: ProviderHealth['status']
) => void;

/**
 * Orchestrates periodic health checks across all configured providers,
 * maintains an in-memory health map, and manages circuit-breaker state.
 *
 * Designed to run in the background without blocking the main request flow.
 */
export class HealthMonitor {
  private healthMap = new Map<ProviderId, ProviderHealth>();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly callbacks: HealthChangeCallback[] = [];
  private readonly logger: winston.Logger;

  constructor(
    private readonly providers: BaseLLMProvider[],
    private readonly config: FreeSwapConfig,
    private readonly circuitBreakerMap: Map<ProviderId, CircuitBreaker>
  ) {
    this.logger = winston.createLogger({
      level: config.logLevel,
      defaultMeta: { service: 'health-monitor' },
      transports: [new winston.transports.Console()],
    });
  }

  /** Start periodic background health checks. */
  start(): void {
    if (this.intervalId) {
      return;
    }

    this.logger.info('Health monitor started');

    // Run an immediate check so callers have data right away.
    this.runHealthCheck().catch((err) => {
      this.logger.error('Initial health check failed', { error: err });
    });

    this.intervalId = setInterval(() => {
      this.runHealthCheck().catch((err) => {
        this.logger.error('Periodic health check failed', { error: err });
      });
    }, this.config.healthCheckIntervalMs);
  }

  /** Stop background health checks and clear resources. */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info('Health monitor stopped');
    }
  }

  /** Retrieve the latest known health for a specific provider. */
  getProviderHealth(providerId: ProviderId): ProviderHealth {
    return (
      this.healthMap.get(providerId) ?? this.createDefaultHealth(providerId)
    );
  }

  /** Retrieve a snapshot of all provider health states. */
  getAllHealth(): Map<ProviderId, ProviderHealth> {
    return new Map(this.healthMap);
  }

  /**
   * Synchronous check: is the provider currently usable?
   * A provider is usable when its health is not 'down' AND
   * its circuit breaker allows the request.
   */
  isProviderUsable(providerId: ProviderId): boolean {
    const health = this.getProviderHealth(providerId);
    const cb = this.circuitBreakerMap.get(providerId);
    const circuitAllows = cb ? cb.allowRequest() : true;
    return health.status !== 'down' && circuitAllows;
  }

  /** Subscribe to health-state change events. */
  onHealthChange(callback: HealthChangeCallback): void {
    this.callbacks.push(callback);
  }

  /** Remove a previously registered health-state callback. */
  offHealthChange(callback: HealthChangeCallback): void {
    const idx = this.callbacks.indexOf(callback);
    if (idx !== -1) {
      this.callbacks.splice(idx, 1);
    }
  }

  /** Execute one full probe cycle and update internal state. */
  private async runHealthCheck(): Promise<void> {
    const results = await HealthProbe.probeAll(this.providers);

    for (const [providerId, freshHealth] of results) {
      const cb = this.circuitBreakerMap.get(providerId);
      const previous = this.healthMap.get(providerId);

      const merged = this.mergeHealth(previous, freshHealth, cb);
      this.healthMap.set(providerId, merged);

      if (previous && previous.status !== merged.status) {
        this.emitHealthChange(providerId, previous.status, merged.status);
      } else if (!previous) {
        this.emitHealthChange(providerId, null, merged.status);
      }
    }
  }

  /**
   * Merge a fresh probe result with prior state and circuit-breaker data.
   */
  private mergeHealth(
    previous: ProviderHealth | undefined,
    fresh: ProviderHealth,
    cb: CircuitBreaker | undefined
  ): ProviderHealth {
    const now = Date.now();
    const merged: ProviderHealth = { ...fresh };

    // Update circuit-breaker based on probe outcome.
    if (cb) {
      if (fresh.status === 'down') {
        cb.recordFailure();
      } else {
        cb.recordSuccess();
      }
      merged.circuitState = cb.getState();
    }

    if (previous) {
      // Consecutive failures accumulate; reset on success.
      merged.consecutiveFailures =
        fresh.status === 'down'
          ? previous.consecutiveFailures + 1
          : 0;

      // Rolling average latency.
      merged.avgLatencyMs =
        previous.avgLatencyMs === 0
          ? fresh.avgLatencyMs
          : (previous.avgLatencyMs + fresh.avgLatencyMs) / 2;

      // Preserve timestamps when the current probe did not update them.
      if (fresh.status !== 'down') {
        merged.lastFailure = previous.lastFailure;
      } else {
        merged.lastSuccess = previous.lastSuccess;
      }

      // Simple error-rate estimate: fraction of failures in recent probes.
      const windowSize = 10;
      const prevErrors = previous.errorRate * windowSize;
      const newErrors = fresh.status === 'down' ? 1 : 0;
      merged.errorRate = (prevErrors + newErrors) / (windowSize + 1);
    }

    return merged;
  }

  private emitHealthChange(
    providerId: ProviderId,
    oldState: ProviderHealth['status'] | null,
    newState: ProviderHealth['status']
  ): void {
    this.logger.info('Provider health changed', {
      providerId,
      oldState,
      newState,
    });

    for (const cb of this.callbacks) {
      try {
        cb(providerId, oldState, newState);
      } catch (err) {
        this.logger.error('Health change callback threw', { error: err });
      }
    }
  }

  private createDefaultHealth(providerId: ProviderId): ProviderHealth {
    return {
      providerId,
      status: 'unknown',
      lastSuccess: null,
      lastFailure: null,
      consecutiveFailures: 0,
      circuitState: 'closed',
      avgLatencyMs: 0,
      errorRate: 0,
    };
  }
}

// Re-exports for convenience.
export { CircuitBreaker } from './circuit-breaker';
export { HealthProbe, BaseLLMProvider } from './probe';
