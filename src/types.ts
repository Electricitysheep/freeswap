// ============================================================
// FreeSwap - Core Type Definitions
// ============================================================

/** Supported LLM providers */
export type ProviderId =
  | 'groq'
  | 'gemini'
  | 'openrouter'
  | 'cerebras'
  | 'mistral'
  | 'nvidia-nim'
  | 'cloudflare'
  | 'github-models'
  | 'ollama';

/** Provider capability flags */
export interface ProviderCapabilities {
  /** Supports tool/function calling */
  toolUse: boolean;
  /** Supports structured output (JSON mode) */
  structuredOutput: boolean;
  /** Supports vision/image input */
  vision: boolean;
  /** Supports streaming */
  streaming: boolean;
  /** Max context window in tokens */
  maxContext: number;
  /** Max output tokens */
  maxOutput: number;
}

/** Free tier rate limit info */
export interface RateLimit {
  /** Requests per minute */
  rpm: number;
  /** Requests per day */
  rpd: number;
  /** Tokens per minute */
  tpm: number;
  /** Tokens per day */
  tpd: number;
}

/** A single free model entry in the registry */
export interface ModelEntry {
  /** Unique model identifier (e.g., "groq/llama-3.3-70b") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Provider slug */
  provider: ProviderId;
  /** The model name to send in API requests */
  apiModelName: string;
  /** Free tier rate limits */
  rateLimit: RateLimit;
  /** Capabilities */
  capabilities: ProviderCapabilities;
  /** Whether this model is currently verified as free and working */
  status: 'active' | 'degraded' | 'offline' | 'unknown';
  /** Last status check timestamp */
  lastChecked: number | null;
  /** Notes / caveats */
  notes?: string;
  /** Average latency in ms (measured) */
  avgLatencyMs?: number;
}

/** Registry containing all known free models */
export interface ModelRegistry {
  version: string;
  lastUpdated: string;
  models: ModelEntry[];
}

/** Meta-model routing tier */
export type MetaModel = 'free' | 'free-fast' | 'free-smart';

/** Task complexity classification */
export type TaskComplexity = 'simple' | 'standard' | 'complex' | 'critical';

/** Classification result */
export interface TaskClassification {
  complexity: TaskComplexity;
  requiresTools: boolean;
  requiresVision: boolean;
  requiresStructuredOutput: boolean;
  requiresStreaming: boolean;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  hasLongContext: boolean;
}

/** Routing decision */
export interface RoutingDecision {
  /** Selected provider */
  provider: ProviderId;
  /** Selected model */
  model: string;
  /** The meta-model used */
  metaModel: MetaModel;
  /** Full fallback chain (provider/model pairs) */
  fallbackChain: Array<{ provider: ProviderId; model: string }>;
  /** Reason for this decision */
  reason: string;
}

/** Provider configuration from env vars */
export interface ProviderConfig {
  /** Provider identifier */
  id: ProviderId;
  /** API keys (supporting multi-key rotation) */
  apiKeys: string[];
  /** Base URL (defaults to provider standard) */
  baseUrl: string;
  /** Whether this provider is enabled */
  enabled: boolean;
}

/** FreeSwap server configuration */
export interface FreeSwapConfig {
  /** HTTP port */
  port: number;
  /** Bind host */
  host: string;
  /** Master API key for proxy auth */
  masterKey: string;
  /** Default meta-model */
  defaultMetaModel: MetaModel;
  /** Max fallback depth */
  fallbackDepth: number;
  /** Health check interval in ms */
  healthCheckIntervalMs: number;
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /** Provider configs */
  providers: ProviderConfig[];
  /** Path to custom registry file */
  registryPath?: string;
}

/** Health status of a provider */
export interface ProviderHealth {
  providerId: ProviderId;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  /** Timestamp of last successful check */
  lastSuccess: number | null;
  /** Timestamp of last failed check */
  lastFailure: number | null;
  /** Consecutive failures */
  consecutiveFailures: number;
  /** Circuit breaker state */
  circuitState: 'closed' | 'open' | 'half-open';
  /** Average latency */
  avgLatencyMs: number;
  /** Error rate (0-1) over sliding window */
  errorRate: number;
}

/** Proxy request context (enriched by middleware) */
export interface RequestContext {
  /** The original model requested by client */
  requestedModel: string | null;
  /** Resolved meta-model */
  metaModel: MetaModel | null;
  /** Routing decision made by router */
  routingDecision: RoutingDecision | null;
  /** Classification result */
  classification: TaskClassification | null;
  /** Provider that ultimately served the request */
  servingProvider: ProviderId | null;
  /** Serving model name */
  servingModel: string | null;
}

/** Standard API error response */
export interface ApiError {
  error: {
    message: string;
    type: string;
    code: string;
  };
}
