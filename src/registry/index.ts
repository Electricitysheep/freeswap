import { readFile, access } from 'fs/promises';
import { join } from 'path';
import yaml from 'js-yaml';
import {
  ModelEntry,
  ModelRegistry,
  ProviderId,
  ProviderCapabilities,
  MetaModel,
} from '../types';
import { validateRegistry } from './validator';

/** Internal registry enriched with meta-model chains parsed from YAML */
interface EnrichedRegistry extends ModelRegistry {
  metaModels?: Record<
    string,
    {
      description: string;
      chains: ProviderId[][];
    }
  >;
}

/** Error thrown for registry-related failures */
export class RegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistryError';
  }
}

/** Criteria for finding the best matching model */
export interface ModelCriteria {
  /** Require specific provider */
  provider?: ProviderId;
  /** Require tool use capability */
  requiresTools?: boolean;
  /** Require vision capability */
  requiresVision?: boolean;
  /** Require streaming capability */
  requiresStreaming?: boolean;
  /** Require structured output capability */
  requiresStructuredOutput?: boolean;
  /** Minimum context window in tokens */
  minContextWindow?: number;
  /** Maximum acceptable average latency in ms */
  maxLatencyMs?: number;
  /** Ordered list of preferred providers */
  preferredProviders?: ProviderId[];
  /** Meta-model to use for provider chain ordering */
  metaModel?: MetaModel;
}

const DEFAULT_REGISTRY_PATHS = [
  join(process.cwd(), 'models', 'registry.yaml'),
  join(__dirname, '..', '..', 'models', 'registry.yaml'),
];

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function parseRateLimit(val: unknown): { rpm: number; rpd: number; tpm: number; tpd: number } {
  if (val === null || typeof val !== 'object') {
    return { rpm: 0, rpd: 0, tpm: 0, tpd: 0 };
  }
  const r = val as Record<string, unknown>;
  return {
    rpm: typeof r.rpm === 'number' && !Number.isNaN(r.rpm) ? r.rpm : 0,
    rpd: typeof r.rpd === 'number' && !Number.isNaN(r.rpd) ? r.rpd : 0,
    tpm: typeof r.tpm === 'number' && !Number.isNaN(r.tpm) ? r.tpm : 0,
    tpd: typeof r.tpd === 'number' && !Number.isNaN(r.tpd) ? r.tpd : 0,
  };
}

function parseCapabilities(val: unknown): ProviderCapabilities {
  if (val === null || typeof val !== 'object') {
    return {
      toolUse: false,
      structuredOutput: false,
      vision: false,
      streaming: false,
      maxContext: 0,
      maxOutput: 0,
    };
  }
  const c = val as Record<string, unknown>;
  return {
    toolUse: typeof c.toolUse === 'boolean' ? c.toolUse : false,
    structuredOutput: typeof c.structuredOutput === 'boolean' ? c.structuredOutput : false,
    vision: typeof c.vision === 'boolean' ? c.vision : false,
    streaming: typeof c.streaming === 'boolean' ? c.streaming : false,
    maxContext: typeof c.maxContext === 'number' && !Number.isNaN(c.maxContext) ? c.maxContext : 0,
    maxOutput: typeof c.maxOutput === 'number' && !Number.isNaN(c.maxOutput) ? c.maxOutput : 0,
  };
}

function normalizeModelEntry(m: unknown): ModelEntry {
  if (m === null || typeof m !== 'object') {
    throw new RegistryError('Model entry is not an object');
  }
  const entry = m as Record<string, unknown>;
  return {
    id: String(entry.id ?? ''),
    name: String(entry.name ?? entry.id ?? ''),
    provider: String(entry.provider ?? '') as ProviderId,
    apiModelName: String(entry.apiModelName ?? entry.id ?? ''),
    rateLimit: parseRateLimit(entry.rateLimit),
    capabilities: parseCapabilities(entry.capabilities),
    status: String(entry.status ?? 'unknown') as ModelEntry['status'],
    lastChecked: entry.lastChecked === null || entry.lastChecked === undefined
      ? null
      : Number(entry.lastChecked),
    notes: entry.notes !== undefined ? String(entry.notes) : undefined,
    avgLatencyMs: entry.avgLatencyMs !== undefined && entry.avgLatencyMs !== null
      ? Number(entry.avgLatencyMs)
      : undefined,
  };
}

function parseMetaModels(data: unknown): EnrichedRegistry['metaModels'] {
  if (data === null || typeof data !== 'object') {
    return undefined;
  }
  const raw = (data as Record<string, unknown>).metaModels;
  if (raw === null || typeof raw !== 'object') {
    return undefined;
  }

  const result: EnrichedRegistry['metaModels'] = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === null || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>;
    const chains: ProviderId[][] = [];
    if (Array.isArray(v.chains)) {
      for (const chain of v.chains) {
        if (Array.isArray(chain)) {
          chains.push(chain.filter((c): c is ProviderId => typeof c === 'string'));
        }
      }
    }
    result[key] = {
      description: String(v.description ?? ''),
      chains,
    };
  }
  return result;
}

/**
 * Load and validate a YAML model registry.
 *
 * @param filePath - Optional explicit path to registry YAML. If omitted, searches
 *   built-in locations (project-root/models/registry.yaml and relative to __dirname).
 * @returns Promise resolving to the validated registry.
 *
 * Handles missing or empty registries gracefully by returning an empty registry
 * rather than throwing. If the file exists but is malformed, throws RegistryError
 * with a descriptive message.
 */
export async function loadRegistry(filePath?: string): Promise<ModelRegistry> {
  let path: string | undefined = filePath;

  if (!path) {
    for (const candidate of DEFAULT_REGISTRY_PATHS) {
      if (await fileExists(candidate)) {
        path = candidate;
        break;
      }
    }
  }

  // No registry file found — return empty registry gracefully
  if (!path || !(await fileExists(path))) {
    return {
      version: '0.0.0',
      lastUpdated: new Date().toISOString(),
      models: [],
    };
  }

  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (err) {
    throw new RegistryError(
      `Failed to read registry file at "${path}": ${err instanceof Error ? err.message : String(err)}`
    );
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    throw new RegistryError(
      `Failed to parse registry YAML at "${path}": ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new RegistryError(`Registry at "${path}" is not a valid YAML object`);
  }

  const data = parsed as Record<string, unknown>;

  const models: ModelEntry[] = [];
  if (Array.isArray(data.models)) {
    for (let i = 0; i < data.models.length; i++) {
      try {
        models.push(normalizeModelEntry(data.models[i]));
      } catch (err) {
        throw new RegistryError(
          `Failed to parse model at index ${i}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  const registry: EnrichedRegistry = {
    version: String(data.version ?? '1.0'),
    lastUpdated: String(data.lastUpdated ?? new Date().toISOString()),
    models,
    metaModels: parseMetaModels(parsed),
  };

  const validation = validateRegistry(registry);
  if (!validation.valid) {
    throw new RegistryError(
      `Registry validation failed: ${validation.errors.join('; ')}`
    );
  }

  return registry;
}

/**
 * Create a registry from an already-parsed object (e.g., a bundled JSON import).
 * This is useful for CLI tooling where the YAML has been pre-bundled as JSON.
 */
export function createRegistry(data: unknown): ModelRegistry {
  if (data === null || typeof data !== 'object') {
    throw new RegistryError('Registry data must be an object');
  }

  const d = data as Record<string, unknown>;

  const models: ModelEntry[] = [];
  if (Array.isArray(d.models)) {
    for (let i = 0; i < d.models.length; i++) {
      try {
        models.push(normalizeModelEntry(d.models[i]));
      } catch (err) {
        throw new RegistryError(
          `Failed to parse model at index ${i}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  const registry: EnrichedRegistry = {
    version: String(d.version ?? '1.0'),
    lastUpdated: String(d.lastUpdated ?? new Date().toISOString()),
    models,
    metaModels: parseMetaModels(data),
  };

  const validation = validateRegistry(registry);
  if (!validation.valid) {
    throw new RegistryError(
      `Registry validation failed: ${validation.errors.join('; ')}`
    );
  }

  return registry;
}

/** Return all models for a specific provider. */
export function getModelsByProvider(
  registry: ModelRegistry,
  provider: ProviderId
): ModelEntry[] {
  return registry.models.filter((m) => m.provider === provider);
}

/** Return models that satisfy the given capability requirements. */
export function getModelsByCapability(
  registry: ModelRegistry,
  caps: Partial<ProviderCapabilities>
): ModelEntry[] {
  return registry.models.filter((m) => {
    if (caps.toolUse !== undefined && m.capabilities.toolUse !== caps.toolUse) return false;
    if (caps.structuredOutput !== undefined && m.capabilities.structuredOutput !== caps.structuredOutput)
      return false;
    if (caps.vision !== undefined && m.capabilities.vision !== caps.vision) return false;
    if (caps.streaming !== undefined && m.capabilities.streaming !== caps.streaming) return false;
    if (caps.maxContext !== undefined && m.capabilities.maxContext < caps.maxContext) return false;
    if (caps.maxOutput !== undefined && m.capabilities.maxOutput < caps.maxOutput) return false;
    return true;
  });
}

function getMetaModelChains(
  registry: ModelRegistry,
  meta: MetaModel
): ProviderId[][] {
  const enriched = registry as EnrichedRegistry;
  if (enriched.metaModels?.[meta]?.chains) {
    return enriched.metaModels[meta].chains;
  }

  // Fallback defaults when metaModels are not present (e.g. bundled JSON import)
  if (meta === 'free-fast') {
    return [
      ['groq', 'cerebras', 'gemini', 'nvidia-nim'],
      ['openrouter', 'mistral', 'cloudflare', 'github-models'],
    ];
  }
  if (meta === 'free-smart') {
    return [
      ['gemini', 'nvidia-nim', 'groq', 'openrouter'],
      ['cerebras', 'mistral', 'github-models', 'cloudflare'],
    ];
  }
  return [
    [
      'groq',
      'gemini',
      'openrouter',
      'cerebras',
      'mistral',
      'nvidia-nim',
      'cloudflare',
      'github-models',
    ],
  ];
}

/**
 * Return models ordered by a meta-model's provider chains.
 * Providers listed earlier in the chain are returned first.
 * Models from providers not in any chain are appended at the end.
 */
export function getModelsByMetaModel(
  registry: ModelRegistry,
  meta: MetaModel
): ModelEntry[] {
  const chains = getMetaModelChains(registry, meta);
  const providerPriority = new Map<ProviderId, number>();

  let rank = 0;
  for (const chain of chains) {
    for (const provider of chain) {
      if (!providerPriority.has(provider)) {
        providerPriority.set(provider, rank++);
      }
    }
  }

  const active = registry.models;
  const ordered: ModelEntry[] = [];
  const added = new Set<string>();

  // Add models in chain order
  for (const chain of chains) {
    for (const provider of chain) {
      for (const m of active) {
        if (m.provider === provider && !added.has(m.id)) {
          ordered.push(m);
          added.add(m.id);
        }
      }
    }
  }

  // Append any remaining models not in chains
  for (const m of active) {
    if (!added.has(m.id)) {
      ordered.push(m);
      added.add(m.id);
    }
  }

  return ordered;
}

function scoreModel(m: ModelEntry): number {
  let score = 0;
  if (m.status === 'active') score += 100;
  else if (m.status === 'degraded') score += 50;

  if (m.capabilities.toolUse) score += 10;
  if (m.capabilities.vision) score += 10;
  if (m.capabilities.structuredOutput) score += 8;
  if (m.capabilities.streaming) score += 5;

  // Larger context is better
  score += Math.min(m.capabilities.maxContext / 10000, 20);

  // Lower latency is better
  if (m.avgLatencyMs !== undefined && m.avgLatencyMs > 0) {
    score += Math.max(0, 20 - m.avgLatencyMs / 50);
  } else {
    score += 10; // unknown latency gets middle score
  }

  return score;
}

/**
 * Find the best matching model for the given criteria.
 * Returns `null` if no model matches.
 */
export function findBestModel(
  registry: ModelRegistry,
  criteria: ModelCriteria
): ModelEntry | null {
  let candidates = registry.models.filter((m) => {
    if (criteria.provider !== undefined && m.provider !== criteria.provider) return false;
    if (criteria.requiresTools && !m.capabilities.toolUse) return false;
    if (criteria.requiresVision && !m.capabilities.vision) return false;
    if (criteria.requiresStreaming && !m.capabilities.streaming) return false;
    if (criteria.requiresStructuredOutput && !m.capabilities.structuredOutput) return false;
    if (
      criteria.minContextWindow !== undefined &&
      m.capabilities.maxContext < criteria.minContextWindow
    )
      return false;
    if (
      criteria.maxLatencyMs !== undefined &&
      m.avgLatencyMs !== undefined &&
      m.avgLatencyMs > criteria.maxLatencyMs
    )
      return false;
    return true;
  });

  if (candidates.length === 0) return null;

  // If meta-model is specified, order candidates by the meta-model chain
  if (criteria.metaModel !== undefined) {
    const ordered = getModelsByMetaModel(registry, criteria.metaModel);
    const orderMap = new Map<string, number>();
    ordered.forEach((m, idx) => orderMap.set(m.id, idx));

    candidates = candidates.slice().sort((a, b) => {
      const aOrder = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bOrder = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    });
  }

  // Apply preferred providers boost
  if (criteria.preferredProviders !== undefined && criteria.preferredProviders.length > 0) {
    const prefMap = new Map<ProviderId, number>();
    criteria.preferredProviders.forEach((p, idx) => prefMap.set(p, idx));

    candidates = candidates.slice().sort((a, b) => {
      const aPref = prefMap.get(a.provider) ?? Number.MAX_SAFE_INTEGER;
      const bPref = prefMap.get(b.provider) ?? Number.MAX_SAFE_INTEGER;
      if (aPref !== bPref) return aPref - bPref;
      return scoreModel(b) - scoreModel(a);
    });
  } else {
    candidates = candidates.slice().sort((a, b) => scoreModel(b) - scoreModel(a));
  }

  return candidates[0] ?? null;
}
