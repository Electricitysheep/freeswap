import {
  ProviderId,
  MetaModel,
  ModelRegistry,
  ModelEntry,
  FreeSwapConfig,
  TaskClassification,
  RoutingDecision,
  ProviderCapabilities,
} from '../types';
import { TaskClassifier, estimateTokens } from './classifier';
import { FallbackManager, BaseLLMProvider } from './fallback';

export { BaseLLMProvider } from './fallback';
export { TaskClassifier, estimateTokens } from './classifier';
export { FallbackManager } from './fallback';

// ============================================================
// Configurable Constants
// ============================================================

/** Log prefix for router decisions */
export const ROUTER_LOG_PREFIX = '[FreeSwapRouter]';

// ============================================================
// FreeSwapRouter
// ============================================================

export class FreeSwapRouter {
  private registry: ModelRegistry;
  private providers: BaseLLMProvider[];
  private config: FreeSwapConfig;
  private classifier: TaskClassifier;
  private fallbackManager: FallbackManager;

  constructor(
    registry: ModelRegistry,
    providers: BaseLLMProvider[],
    config: FreeSwapConfig
  ) {
    this.registry = registry;
    this.providers = providers;
    this.config = config;
    this.classifier = new TaskClassifier();
    this.fallbackManager = new FallbackManager(providers, config, registry);
  }

  /**
   * Resolve a raw model string to a MetaModel tier, or null if it's a specific model ID.
   */
  resolveMetaModel(raw: string): MetaModel | null {
    if (raw === 'free' || raw === 'free-fast' || raw === 'free-smart') {
      return raw;
    }
    return null;
  }

  /**
   * Main routing entry point.
   * Classifies the request, picks the best model, and builds a fallback chain.
   */
  async route(request: {
    model?: string;
    messages: any[];
    tools?: any[];
    stream?: boolean;
  }): Promise<RoutingDecision> {
    const rawModel = request.model || this.config.defaultMetaModel;
    const metaModel = this.resolveMetaModel(rawModel);

    // Specific model ID requested → route directly without classification
    if (metaModel === null && rawModel) {
      const modelEntry = this.registry.models.find((m) => m.id === rawModel);
      if (modelEntry) {
        const fallbackChain = this.fallbackManager.buildFallbackChain(
          modelEntry.provider,
          this.config.defaultMetaModel
        );
        return {
          provider: modelEntry.provider,
          model: modelEntry.apiModelName,
          metaModel: this.config.defaultMetaModel,
          fallbackChain,
          reason: `Direct route to requested model: ${rawModel}`,
        };
      }
    }

    // Meta-model or default → classify and pick best model
    const prompt = this.extractPromptText(request.messages);
    const classification = this.classifier.classify(prompt, {
      tools: request.tools,
      messages: request.messages,
    });

    // Override streaming flag from the request body
    classification.requiresStreaming = !!request.stream;

    const metaModelToUse = metaModel || this.config.defaultMetaModel;
    const bestModel = this.pickBestModel(classification, metaModelToUse);

    if (!bestModel) {
      throw new Error(
        `${ROUTER_LOG_PREFIX} No suitable model found for request. ` +
          `Meta-model: ${metaModelToUse}, complexity: ${classification.complexity}`
      );
    }

    const fallbackChain = this.fallbackManager.buildFallbackChain(
      bestModel.provider,
      metaModelToUse
    );

    const reason = this.buildReason(classification, bestModel, metaModelToUse);

    if (this.config.logLevel === 'debug') {
      console.debug(`${ROUTER_LOG_PREFIX} ${reason}`);
    }

    return {
      provider: bestModel.provider,
      model: bestModel.apiModelName,
      metaModel: metaModelToUse,
      fallbackChain,
      reason,
    };
  }

  /**
   * Pick the best model for a given classification and meta-model tier.
   * Filters by required capabilities, then selects based on the meta-model strategy.
   */
  pickBestModel(
    classification: TaskClassification,
    metaModel: MetaModel = 'free'
  ): ModelEntry | undefined {
    let candidates = this.registry.models.filter((m) => m.status === 'active');

    if (candidates.length === 0) {
      return undefined;
    }

    // Capability filtering
    if (classification.requiresTools) {
      candidates = candidates.filter((m) => m.capabilities.toolUse);
    }
    if (classification.requiresVision) {
      candidates = candidates.filter((m) => m.capabilities.vision);
    }
    if (classification.requiresStreaming) {
      candidates = candidates.filter((m) => m.capabilities.streaming);
    }
    if (classification.hasLongContext) {
      candidates = candidates.filter(
        (m) => m.capabilities.maxContext >= classification.estimatedInputTokens
      );
    }

    if (candidates.length === 0) {
      return undefined;
    }

    // Meta-model tier selection
    switch (metaModel) {
      case 'free-fast':
        return this.selectFastestModel(candidates);
      case 'free-smart':
        return this.selectSmartestModel(candidates);
      case 'free':
      default:
        return this.selectBalancedModel(candidates, classification);
    }
  }

  private selectFastestModel(candidates: ModelEntry[]): ModelEntry {
    const sorted = [...candidates].sort((a, b) => {
      const latencyA = a.avgLatencyMs ?? Infinity;
      const latencyB = b.avgLatencyMs ?? Infinity;
      return latencyA - latencyB;
    });
    return sorted[0];
  }

  private selectSmartestModel(candidates: ModelEntry[]): ModelEntry {
    const sorted = [...candidates].sort((a, b) => {
      const scoreA = this.scoreCapability(a.capabilities);
      const scoreB = this.scoreCapability(b.capabilities);
      return scoreB - scoreA;
    });
    return sorted[0];
  }

  private selectBalancedModel(
    candidates: ModelEntry[],
    classification: TaskClassification
  ): ModelEntry {
    if (classification.complexity === 'simple') {
      return this.selectFastestModel(candidates);
    }
    if (
      classification.complexity === 'complex' ||
      classification.complexity === 'critical'
    ) {
      return this.selectSmartestModel(candidates);
    }
    // Standard → middle of the pack by capability
    const sorted = [...candidates].sort((a, b) => {
      const scoreA = this.scoreCapability(a.capabilities);
      const scoreB = this.scoreCapability(b.capabilities);
      return scoreB - scoreA;
    });
    return sorted[Math.floor(sorted.length / 2)] ?? sorted[0];
  }

  private scoreCapability(caps: ProviderCapabilities): number {
    return (
      caps.maxContext / 1000 +
      (caps.toolUse ? 10 : 0) +
      (caps.vision ? 10 : 0) +
      (caps.structuredOutput ? 5 : 0) +
      (caps.streaming ? 2 : 0)
    );
  }

  private extractPromptText(messages: any[]): string {
    if (!Array.isArray(messages) || messages.length === 0) {
      return '';
    }
    return messages
      .map((m) => {
        if (typeof m?.content === 'string') {
          return m.content;
        }
        if (Array.isArray(m?.content)) {
          return m.content
            .filter((c: any) => c?.type === 'text')
            .map((c: any) => c.text)
            .join(' ');
        }
        return '';
      })
      .join('\n');
  }

  private buildReason(
    classification: TaskClassification,
    model: ModelEntry,
    metaModel: MetaModel
  ): string {
    const parts: string[] = [];
    parts.push(`Meta-model: ${metaModel}`);
    parts.push(`Complexity: ${classification.complexity}`);
    parts.push(`Input tokens: ~${classification.estimatedInputTokens}`);
    if (classification.requiresTools) parts.push('Requires tools');
    if (classification.requiresVision) parts.push('Requires vision');
    if (classification.requiresStreaming) parts.push('Requires streaming');
    if (classification.requiresStructuredOutput) parts.push('Requires structured output');
    parts.push(`Selected: ${model.id}`);
    return parts.join(' | ');
  }
}
