import { ProviderId, ModelEntry } from '../types';

const VALID_PROVIDERS: ProviderId[] = [
  'groq',
  'gemini',
  'openrouter',
  'cerebras',
  'mistral',
  'nvidia-nim',
  'cloudflare',
  'github-models',
  'ollama',
];

const VALID_STATUSES: ModelEntry['status'][] = ['active', 'degraded', 'offline', 'unknown'];

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isValidProvider(value: unknown): value is ProviderId {
  return isString(value) && VALID_PROVIDERS.includes(value as ProviderId);
}

function isValidStatus(value: unknown): value is ModelEntry['status'] {
  return isString(value) && VALID_STATUSES.includes(value as ModelEntry['status']);
}

/** Validate a single model entry */
export function validateModelEntry(entry: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (entry === null || typeof entry !== 'object') {
    return { valid: false, errors: ['Model entry must be an object'] };
  }

  const e = entry as Record<string, unknown>;

  if (!isString(e.id) || e.id.length === 0) {
    errors.push('Model entry must have a non-empty string "id"');
  }

  if (!isString(e.name) || e.name.length === 0) {
    errors.push('Model entry must have a non-empty string "name"');
  }

  if (!isValidProvider(e.provider)) {
    errors.push(`Model entry must have a valid "provider" (one of: ${VALID_PROVIDERS.join(', ')})`);
  }

  if (!isString(e.apiModelName)) {
    errors.push('Model entry must have a string "apiModelName"');
  }

  // Validate rateLimit
  if (e.rateLimit === null || typeof e.rateLimit !== 'object') {
    errors.push('Model entry must have an object "rateLimit"');
  } else {
    const rl = e.rateLimit as Record<string, unknown>;
    for (const key of ['rpm', 'rpd', 'tpm', 'tpd'] as const) {
      if (!isNumber(rl[key])) {
        errors.push(`rateLimit.${key} must be a number`);
      }
    }
  }

  // Validate capabilities
  if (e.capabilities === null || typeof e.capabilities !== 'object') {
    errors.push('Model entry must have an object "capabilities"');
  } else {
    const caps = e.capabilities as Record<string, unknown>;
    for (const key of ['toolUse', 'structuredOutput', 'vision', 'streaming'] as const) {
      if (!isBoolean(caps[key])) {
        errors.push(`capabilities.${key} must be a boolean`);
      }
    }
    for (const key of ['maxContext', 'maxOutput'] as const) {
      if (!isNumber(caps[key])) {
        errors.push(`capabilities.${key} must be a number`);
      }
    }
  }

  if (!isValidStatus(e.status)) {
    errors.push(`Model entry must have a valid "status" (one of: ${VALID_STATUSES.join(', ')})`);
  }

  if (e.lastChecked !== null && !isNumber(e.lastChecked)) {
    errors.push('Model entry "lastChecked" must be a number or null');
  }

  if (e.notes !== undefined && !isString(e.notes)) {
    errors.push('Model entry "notes" must be a string if provided');
  }

  if (e.avgLatencyMs !== undefined && !isNumber(e.avgLatencyMs)) {
    errors.push('Model entry "avgLatencyMs" must be a number if provided');
  }

  return { valid: errors.length === 0, errors };
}

/** Validate an entire registry */
export function validateRegistry(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (data === null || typeof data !== 'object') {
    return { valid: false, errors: ['Registry must be an object'] };
  }

  const r = data as Record<string, unknown>;

  if (!isString(r.version) || r.version.length === 0) {
    errors.push('Registry must have a non-empty string "version"');
  }

  if (!isString(r.lastUpdated) || r.lastUpdated.length === 0) {
    errors.push('Registry must have a non-empty string "lastUpdated"');
  }

  if (!Array.isArray(r.models)) {
    errors.push('Registry must have an array "models"');
    return { valid: false, errors };
  }

  const seenIds = new Set<string>();

  for (let i = 0; i < r.models.length; i++) {
    const result = validateModelEntry(r.models[i]);
    if (!result.valid) {
      for (const err of result.errors) {
        errors.push(`models[${i}]: ${err}`);
      }
    }
    const entry = r.models[i] as Record<string, unknown> | null;
    if (entry && isString(entry.id)) {
      if (seenIds.has(entry.id)) {
        errors.push(`models[${i}]: Duplicate model id "${entry.id}"`);
      }
      seenIds.add(entry.id);
    }
  }

  return { valid: errors.length === 0, errors };
}
