import {
  ProviderId,
  MetaModel,
  ModelRegistry,
  ModelEntry,
  FreeSwapConfig,
  ProviderHealth,
} from '../types';

// ============================================================
// Configurable Constants
// ============================================================

/** How many alternative providers to include in chain (excluding primary) */
export const FALLBACK_CHAIN_MAX_ALTERNATIVES = 5;

// ============================================================
// BaseLLMProvider Interface
// ============================================================

/**
 * Minimal provider interface expected by the router.
 * The full provider implementation lives in src/providers/.
 */
export interface BaseLLMProvider {
  /** Provider identifier */
  providerId: ProviderId;
  /** Current health status */
  health: ProviderHealth;
}

// ============================================================
// FallbackManager
// ============================================================

export class FallbackManager {
  private providers: BaseLLMProvider[];
  private config: FreeSwapConfig;
  private registry: ModelRegistry;
  private triedProviders: Set<ProviderId> = new Set();

  constructor(
    providers: BaseLLMProvider[],
    config: FreeSwapConfig,
    registry: ModelRegistry
  ) {
    this.providers = providers;
    this.config = config;
    this.registry = registry;
  }

  /**
   * Build a fallback chain starting with the primary provider,
   * then adding alternatives from other healthy providers.
   * Respects circuit breaker states and skips already-tried providers.
   */
  buildFallbackChain(
    primary: ProviderId,
    metaModel: MetaModel
  ): Array<{ provider: ProviderId; model: string }> {
    const chain: Array<{ provider: ProviderId; model: string }> = [];
    this.triedProviders.clear();

    const primaryModel = this.findBestModelForProvider(primary, metaModel);
    if (primaryModel) {
      chain.push({ provider: primary, model: primaryModel.apiModelName });
      this.triedProviders.add(primary);
    }

    const alternativeProviders = this.providers
      .filter((p) => p.providerId !== primary)
      .filter((p) => p.health.circuitState !== 'open')
      .filter((p) => !this.triedProviders.has(p.providerId));

    for (const provider of alternativeProviders) {
      if (chain.length >= this.config.fallbackDepth) break;

      const model = this.findBestModelForProvider(provider.providerId, metaModel);
      if (model) {
        chain.push({
          provider: provider.providerId,
          model: model.apiModelName,
        });
        this.triedProviders.add(provider.providerId);
      }
    }

    return chain;
  }

  /**
   * Get the next provider in the fallback chain.
   * Respects the max fallback depth from config.
   */
  getNextProvider(
    currentIndex: number,
    chain: Array<{ provider: ProviderId; model: string }>
  ): { provider: ProviderId; model: string } | null {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= chain.length) {
      return null;
    }
    if (nextIndex >= this.config.fallbackDepth) {
      return null;
    }
    return chain[nextIndex] || null;
  }

  /**
   * Mark a provider as tried so it won't be reused in new chains.
   */
  markProviderTried(providerId: ProviderId): void {
    this.triedProviders.add(providerId);
  }

  /**
   * Check if a provider has already been tried.
   */
  hasProviderBeenTried(providerId: ProviderId): boolean {
    return this.triedProviders.has(providerId);
  }

  /**
   * Reset the tried-provider tracking.
   */
  resetTriedProviders(): void {
    this.triedProviders.clear();
  }

  private findBestModelForProvider(
    providerId: ProviderId,
    metaModel: MetaModel
  ): ModelEntry | undefined {
    const models = this.registry.models.filter(
      (m) => m.provider === providerId && m.status === 'active'
    );

    if (models.length === 0) return undefined;

    switch (metaModel) {
      case 'free-fast':
        return this.pickFastestModel(models);
      case 'free-smart':
        return this.pickSmartestModel(models);
      case 'free':
      default:
        return this.pickBalancedModel(models);
    }
  }

  private pickFastestModel(models: ModelEntry[]): ModelEntry {
    const sorted = [...models].sort((a, b) => {
      const latencyA = a.avgLatencyMs ?? Infinity;
      const latencyB = b.avgLatencyMs ?? Infinity;
      return latencyA - latencyB;
    });
    return sorted[0];
  }

  private pickSmartestModel(models: ModelEntry[]): ModelEntry {
    const sorted = [...models].sort((a, b) => {
      const scoreA = this.scoreModel(a);
      const scoreB = this.scoreModel(b);
      return scoreB - scoreA;
    });
    return sorted[0];
  }

  private pickBalancedModel(models: ModelEntry[]): ModelEntry {
    const sorted = [...models].sort((a, b) => {
      const scoreA = this.scoreModel(a);
      const scoreB = this.scoreModel(b);
      return scoreB - scoreA;
    });
    return sorted[Math.floor(sorted.length / 2)] ?? sorted[0];
  }

  private scoreModel(model: ModelEntry): number {
    const caps = model.capabilities;
    return (
      caps.maxContext / 1000 +
      (caps.toolUse ? 10 : 0) +
      (caps.vision ? 10 : 0) +
      (caps.structuredOutput ? 5 : 0) +
      (caps.streaming ? 2 : 0)
    );
  }
}
