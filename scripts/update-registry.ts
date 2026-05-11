import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

const REGISTRY_PATH = join(__dirname, '../models/registry.yaml');

interface SourceProvider {
  name: string;
  models: Array<{
    id: string;
    name: string;
    apiModel: string;
    rpm: number;
    rpd: number;
    tpm: number;
    tpd: number;
    toolUse: boolean;
    vision: boolean;
    streaming: boolean;
    maxContext: number;
    maxOutput: number;
  }>;
}

const KNOWLEDGE_SOURCES: SourceProvider[] = [
  {
    name: 'groq',
    models: [
      { id: 'groq/llama-3.3-70b', name: 'Llama 3.3 70B', apiModel: 'llama-3.3-70b-versatile', rpm: 30, rpd: 1000, tpm: 6000, tpd: 500000, toolUse: true, vision: false, streaming: true, maxContext: 128000, maxOutput: 32768 },
      { id: 'groq/llama-4-scout', name: 'Llama 4 Scout 17B', apiModel: 'meta-llama/llama-4-scout-17b-16e-instruct', rpm: 30, rpd: 1000, tpm: 6000, tpd: 500000, toolUse: true, vision: false, streaming: true, maxContext: 128000, maxOutput: 32768 },
      { id: 'groq/qwen3-32b', name: 'Qwen3 32B', apiModel: 'qwen-3-32b', rpm: 30, rpd: 1000, tpm: 6000, tpd: 500000, toolUse: true, vision: false, streaming: true, maxContext: 32000, maxOutput: 8192 },
    ],
  },
  {
    name: 'gemini',
    models: [
      { id: 'gemini/flash-2.5', name: 'Gemini 2.5 Flash', apiModel: 'gemini-2.5-flash', rpm: 10, rpd: 1500, tpm: 250000, tpd: 1000000, toolUse: true, vision: true, streaming: true, maxContext: 1048576, maxOutput: 8192 },
      { id: 'gemini/pro-2.5', name: 'Gemini 2.5 Pro', apiModel: 'gemini-2.5-pro', rpm: 5, rpd: 50, tpm: 100000, tpd: 500000, toolUse: true, vision: true, streaming: true, maxContext: 1048576, maxOutput: 8192 },
    ],
  },
  {
    name: 'openrouter',
    models: [
      { id: 'openrouter/free', name: 'OpenRouter Free Router', apiModel: 'openrouter/free', rpm: 20, rpd: 50, tpm: 100000, tpd: 500000, toolUse: true, vision: true, streaming: true, maxContext: 200000, maxOutput: 65536 },
    ],
  },
  {
    name: 'cerebras',
    models: [
      { id: 'cerebras/llama-3.3-70b', name: 'Llama 3.3 70B (Cerebras)', apiModel: 'llama-3.3-70b', rpm: 30, rpd: 14400, tpm: 60000, tpd: 1000000, toolUse: true, vision: false, streaming: true, maxContext: 128000, maxOutput: 8192 },
      { id: 'cerebras/gpt-oss-120b', name: 'GPT-OSS 120B', apiModel: 'gpt-oss-120b', rpm: 30, rpd: 14400, tpm: 60000, tpd: 1000000, toolUse: false, vision: false, streaming: true, maxContext: 128000, maxOutput: 8192 },
    ],
  },
  {
    name: 'mistral',
    models: [
      { id: 'mistral/small', name: 'Mistral Small 3.1', apiModel: 'mistral-small-3.1-latest', rpm: 2, rpd: 3000, tpm: 10000, tpd: 1000000000, toolUse: true, vision: false, streaming: true, maxContext: 128000, maxOutput: 32768 },
      { id: 'mistral/codestral', name: 'Codestral', apiModel: 'codestral-latest', rpm: 2, rpd: 3000, tpm: 10000, tpd: 500000000, toolUse: true, vision: false, streaming: true, maxContext: 256000, maxOutput: 65536 },
    ],
  },
  {
    name: 'nvidia-nim',
    models: [
      { id: 'nvidia-nim/llama-3.3-70b', name: 'Llama 3.3 70B (NVIDIA)', apiModel: 'meta/llama-3.3-70b-instruct', rpm: 40, rpd: 1000, tpm: 100000, tpd: 1000000, toolUse: true, vision: false, streaming: true, maxContext: 128000, maxOutput: 4096 },
      { id: 'nvidia-nim/deepseek-r1', name: 'DeepSeek R1 (NVIDIA)', apiModel: 'deepseek-ai/deepseek-r1', rpm: 40, rpd: 1000, tpm: 100000, tpd: 1000000, toolUse: false, vision: false, streaming: true, maxContext: 128000, maxOutput: 8192 },
    ],
  },
  {
    name: 'cloudflare',
    models: [
      { id: 'cloudflare/llama-3.3-70b', name: 'Llama 3.3 70B (Cloudflare)', apiModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', rpm: 20, rpd: 300, tpm: 50000, tpd: 10000000, toolUse: false, vision: false, streaming: true, maxContext: 128000, maxOutput: 4096 },
    ],
  },
  {
    name: 'github-models',
    models: [
      { id: 'github-models/gpt-4o-mini', name: 'GPT-4o Mini', apiModel: 'gpt-4o-mini', rpm: 15, rpd: 150, tpm: 100000, tpd: 500000, toolUse: true, vision: true, streaming: true, maxContext: 128000, maxOutput: 16384 },
      { id: 'github-models/llama-3.3-70b', name: 'Llama 3.3 70B (GitHub)', apiModel: 'llama-3.3-70b-instruct', rpm: 15, rpd: 150, tpm: 100000, tpd: 500000, toolUse: true, vision: false, streaming: true, maxContext: 128000, maxOutput: 4096 },
    ],
  },
  {
    name: 'ollama',
    models: [
      { id: 'ollama/local', name: 'Ollama Local', apiModel: '', rpm: 9999, rpd: 99999, tpm: 999999, tpd: 99999999, toolUse: true, vision: false, streaming: true, maxContext: 128000, maxOutput: 4096 },
    ],
  },
];

function buildRegistry() {
  const models: any[] = [];

  for (const src of KNOWLEDGE_SOURCES) {
    for (const m of src.models) {
      models.push({
        id: m.id,
        name: m.name,
        provider: src.name,
        apiModelName: m.apiModel,
        rateLimit: { rpm: m.rpm, rpd: m.rpd, tpm: m.tpm, tpd: m.tpd },
        capabilities: {
          toolUse: m.toolUse,
          structuredOutput: m.toolUse,
          vision: m.vision,
          streaming: m.streaming,
          maxContext: m.maxContext,
          maxOutput: m.maxOutput,
        },
        status: 'active',
        lastChecked: null,
        avgLatencyMs: undefined,
      });
    }
  }

  const registry = {
    version: '1.0',
    lastUpdated: new Date().toISOString().slice(0, 10),
    metaModels: {
      free: {
        description: 'Max availability — rotates across all available providers',
        chains: [['groq', 'gemini', 'openrouter', 'cerebras', 'mistral', 'nvidia-nim', 'cloudflare', 'github-models']],
      },
      'free-fast': {
        description: 'Lowest latency — fastest providers first',
        chains: [['groq', 'cerebras', 'gemini', 'nvidia-nim'], ['openrouter', 'mistral', 'cloudflare', 'github-models']],
      },
      'free-smart': {
        description: 'Best reasoning — most capable providers first',
        chains: [['gemini', 'nvidia-nim', 'groq', 'openrouter'], ['cerebras', 'mistral', 'github-models', 'cloudflare']],
      },
    },
    models,
  };

  const yamlStr = yaml.dump(registry, { lineWidth: 120, noRefs: true, sortKeys: true });
  writeFileSync(REGISTRY_PATH, `# FreeSwap Model Registry\n# Auto-generated from knowledge sources\n# Last updated: ${new Date().toISOString()}\n---\n${yamlStr}`);
  console.log(`\n  ✓ Registry updated: ${models.length} models written to ${REGISTRY_PATH}\n`);
}

buildRegistry();
