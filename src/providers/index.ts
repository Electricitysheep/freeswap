import { ProviderId, ProviderConfig } from '../types';
import { BaseLLMProvider } from './base';
import { GroqProvider } from './groq';
import { GeminiProvider } from './gemini';
import { OpenRouterProvider } from './openrouter';
import { CerebrasProvider } from './cerebras';
import { MistralProvider } from './mistral';
import { NvidiaNimProvider } from './nvidia-nim';
import { CloudflareProvider } from './cloudflare';
import { GitHubModelsProvider } from './github-models';
import { OllamaProvider } from './ollama';
import { KiroProvider } from './kiro';
import { OpenCodeFreeProvider } from './opencode-free';

export { BaseLLMProvider, CompletionOptions } from './base';
export { GroqProvider } from './groq';
export { GeminiProvider } from './gemini';
export { OpenRouterProvider } from './openrouter';
export { CerebrasProvider } from './cerebras';
export { MistralProvider } from './mistral';
export { NvidiaNimProvider } from './nvidia-nim';
export { CloudflareProvider } from './cloudflare';
export { GitHubModelsProvider } from './github-models';
export { OllamaProvider } from './ollama';
export { KiroProvider } from './kiro';
export { OpenCodeFreeProvider } from './opencode-free';

export class ProviderFactory {
  private providers = new Map<ProviderId, BaseLLMProvider>();

  createProvider(id: ProviderId, config: ProviderConfig): BaseLLMProvider {
    let provider: BaseLLMProvider;

    switch (id) {
      case 'groq':
        provider = new GroqProvider(config);
        break;
      case 'gemini':
        provider = new GeminiProvider(config);
        break;
      case 'openrouter':
        provider = new OpenRouterProvider(config);
        break;
      case 'cerebras':
        provider = new CerebrasProvider(config);
        break;
      case 'mistral':
        provider = new MistralProvider(config);
        break;
      case 'nvidia-nim':
        provider = new NvidiaNimProvider(config);
        break;
      case 'cloudflare':
        provider = new CloudflareProvider(config);
        break;
      case 'github-models':
        provider = new GitHubModelsProvider(config);
        break;
      case 'ollama':
        provider = new OllamaProvider(config);
        break;
      case 'kiro':
        provider = new KiroProvider(config);
        break;
      case 'opencode-free':
        provider = new OpenCodeFreeProvider(config);
        break;
      default:
        throw new Error(`Unknown provider: ${id}`);
    }

    this.providers.set(id, provider);
    return provider;
  }

  getProvider(id: ProviderId): BaseLLMProvider | undefined {
    return this.providers.get(id);
  }

  getAllEnabled(): BaseLLMProvider[] {
    return Array.from(this.providers.values()).filter((p) => p.isEnabled());
  }

  getAll(): BaseLLMProvider[] {
    return Array.from(this.providers.values());
  }

  removeProvider(id: ProviderId): boolean {
    return this.providers.delete(id);
  }

  clear(): void {
    this.providers.clear();
  }
}

export function createProvider(
  id: ProviderId,
  config: ProviderConfig
): BaseLLMProvider {
  const factory = new ProviderFactory();
  return factory.createProvider(id, config);
}
