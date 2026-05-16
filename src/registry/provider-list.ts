import { ProviderId } from '../types';

/** Metadata for display and documentation of a provider */
export interface ProviderMeta {
  /** Human-readable provider name */
  name: string;
  /** Short description of the provider */
  description: string;
  /** Base API URL */
  baseUrl: string;
  /** URL to sign up for an API key */
  signupUrl: string;
  /** URL to provider documentation */
  docsUrl: string;
}

/** Built-in metadata for all supported providers */
export const PROVIDER_META: Record<ProviderId, ProviderMeta> = {
  groq: {
    name: 'Groq',
    description: 'Ultra-fast inference with custom LPU hardware. Best for low-latency applications.',
    baseUrl: 'https://api.groq.com/openai/v1',
    signupUrl: 'https://console.groq.com/signup',
    docsUrl: 'https://console.groq.com/docs',
  },
  gemini: {
    name: 'Google Gemini',
    description: "Google's multimodal AI with generous free tier. Best for long context and vision tasks.",
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    signupUrl: 'https://aistudio.google.com/app/apikey',
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
  },
  openrouter: {
    name: 'OpenRouter',
    description: 'Unified API for 200+ models including a broad free tier. Best for model variety.',
    baseUrl: 'https://openrouter.ai/api/v1',
    signupUrl: 'https://openrouter.ai/signup',
    docsUrl: 'https://openrouter.ai/docs',
  },
  cerebras: {
    name: 'Cerebras',
    description: 'High-speed inference on Wafer Scale Engine. Best for high daily token quotas.',
    baseUrl: 'https://api.cerebras.ai/v1',
    signupUrl: 'https://cloud.cerebras.ai/signup',
    docsUrl: 'https://inference-docs.cerebras.ai/',
  },
  mistral: {
    name: 'Mistral AI',
    description: 'European LLM provider with strong code models and high monthly quotas.',
    baseUrl: 'https://api.mistral.ai/v1',
    signupUrl: 'https://console.mistral.ai/',
    docsUrl: 'https://docs.mistral.ai/',
  },
  'nvidia-nim': {
    name: 'NVIDIA NIM',
    description: 'Enterprise-grade inference microservices with free credits.',
    baseUrl: 'https://api.nvcf.nvidia.com/v1',
    signupUrl: 'https://build.nvidia.com/explore/discover',
    docsUrl: 'https://docs.nvidia.com/nim/',
  },
  cloudflare: {
    name: 'Cloudflare Workers AI',
    description: 'Edge-deployed inference on Cloudflare global network.',
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts',
    signupUrl: 'https://dash.cloudflare.com/sign-up',
    docsUrl: 'https://developers.cloudflare.com/workers-ai/',
  },
  'github-models': {
    name: 'GitHub Models',
    description: 'Free model inference via GitHub account. Good for testing and prototyping.',
    baseUrl: 'https://models.inference.ai.azure.com',
    signupUrl: 'https://github.com/marketplace/models',
    docsUrl: 'https://docs.github.com/en/github-models',
  },
  ollama: {
    name: 'Ollama',
    description: 'Local inference — no rate limits, no costs, full privacy',
    baseUrl: 'http://localhost:11434',
    signupUrl: 'https://ollama.ai',
    docsUrl: 'https://ollama.ai',
  },
  kiro: {
    name: 'Kiro AI',
    description: 'Free unlimited Claude 4.5 + GLM-5 + MiniMax via OAuth',
    baseUrl: 'https://api.kiro.ai/v1',
    signupUrl: 'https://kiro.ai',
    docsUrl: 'https://kiro.ai',
  },
  'opencode-free': {
    name: 'OpenCode Free',
    description: 'No-auth passthrough proxy, auto-fetches free models',
    baseUrl: 'https://opencode.ai/zen/v1',
    signupUrl: 'https://opencode.ai',
    docsUrl: 'https://opencode.ai',
  },
};

/** Ordered list of all supported provider IDs */
export const ALL_PROVIDERS: ProviderId[] = [
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
