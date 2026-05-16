import dotenv from 'dotenv';
import path from 'path';
import { FreeSwapConfig, ProviderConfig, ProviderId } from './types';

dotenv.config();

const PROVIDER_ENV_MAP: Record<ProviderId, { envKey: string; defaultBaseUrl: string }> = {
  groq: {
    envKey: 'GROQ_API_KEY',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
  },
  gemini: {
    envKey: 'GOOGLE_GEMINI_KEY',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },
  openrouter: {
    envKey: 'OPENROUTER_KEY',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
  },
  cerebras: {
    envKey: 'CEREBRAS_KEY',
    defaultBaseUrl: 'https://api.cerebras.ai/v1',
  },
  mistral: {
    envKey: 'MISTRAL_KEY',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
  },
  'nvidia-nim': {
    envKey: 'NVIDIA_NIM_KEY',
    defaultBaseUrl: 'https://api.nvcf.nvidia.com/v1',
  },
  cloudflare: {
    envKey: 'CLOUDFLARE_KEY',
    defaultBaseUrl: 'https://api.cloudflare.com/client/v4/accounts',
  },
  'github-models': {
    envKey: 'GITHUB_MODELS_KEY',
    defaultBaseUrl: 'https://models.inference.ai.azure.com',
  },
  ollama: {
    envKey: 'OLLAMA_BASE_URL',
    defaultBaseUrl: 'http://localhost:11434',
  },
  kiro: {
    envKey: 'KIRO_API_KEY',
    defaultBaseUrl: 'https://api.kiro.ai/v1',
  },
  'opencode-free': {
    envKey: 'OPENCODE_FREE_KEY',
    defaultBaseUrl: 'https://opencode.ai/zen/v1',
  },
};

const ALL_PROVIDERS: ProviderId[] = [
  'groq', 'gemini', 'openrouter', 'cerebras', 'mistral',
  'nvidia-nim', 'cloudflare', 'github-models', 'ollama',
  'kiro', 'opencode-free',
];

function loadProviderConfigs(): ProviderConfig[] {
  return ALL_PROVIDERS.map((id) => {
    const mapping = PROVIDER_ENV_MAP[id];
    const rawKeys = process.env[mapping.envKey] || '';
    const apiKeys = rawKeys
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    return {
      id,
      apiKeys,
      baseUrl: mapping.defaultBaseUrl,
      enabled: apiKeys.length > 0 || id === 'ollama',
    };
  });
}

export function loadConfig(): FreeSwapConfig {
  const providers = loadProviderConfigs();

  return {
    port: parseInt(process.env.PORT || '8080', 10),
    host: process.env.HOST || '127.0.0.1',
    masterKey: process.env.FREESWAP_MASTER_KEY || 'dev-key',
    defaultMetaModel: parseMetaModel(process.env.DEFAULT_META_MODEL),
    fallbackDepth: parseInt(process.env.DEFAULT_FALLBACK_DEPTH || '3', 10),
    healthCheckIntervalMs: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '300000', 10),
    logLevel: parseLogLevel(process.env.LOG_LEVEL),
    providers,
    registryPath: process.env.REGISTRY_PATH,
  };
}

function parseMetaModel(val?: string): 'free' | 'free-fast' | 'free-smart' {
  if (val === 'free-fast') return 'free-fast';
  if (val === 'free-smart') return 'free-smart';
  return 'free';
}

function parseLogLevel(val?: string): 'debug' | 'info' | 'warn' | 'error' {
  if (val === 'debug' || val === 'warn' || val === 'error') return val;
  return 'info';
}
