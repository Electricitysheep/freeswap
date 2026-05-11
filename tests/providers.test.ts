import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GroqProvider } from '../src/providers/groq';
import { ProviderConfig } from '../src/types';

// Mock the OpenAI client to avoid actual API calls
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({ choices: [] }),
        },
      },
    })),
  };
});

function makeConfig(apiKeys: string[]): ProviderConfig {
  return { id: 'groq', apiKeys, baseUrl: 'https://api.groq.com/openai/v1', enabled: apiKeys.length > 0 };
}

describe('BaseLLMProvider key rotation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rotates through multiple keys', () => {
    const provider = new GroqProvider(makeConfig(['key1', 'key2', 'key3']));
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      seen.add(provider.getCurrentKey());
    }
    expect(seen.has('key1')).toBe(true);
    expect(seen.has('key2')).toBe(true);
    expect(seen.has('key3')).toBe(true);
  });

  it('returns all configured keys', () => {
    const provider = new GroqProvider(makeConfig(['key-a', 'key-b']));
    const keys = provider.getApiKeys();
    expect(keys).toEqual(['key-a', 'key-b']);
  });

  it('returns correct provider id', () => {
    const provider = new GroqProvider(makeConfig(['key']));
    expect(provider.getProviderId()).toBe('groq');
  });

  it('detects enabled state', () => {
    const provider = new GroqProvider(makeConfig(['real-key']));
    expect(provider.isEnabled()).toBe(true);
  });

  it('is disabled when no keys', () => {
    const provider = new GroqProvider(makeConfig([]));
    expect(provider.isEnabled()).toBe(false);
  });

  it('returns base url', () => {
    const provider = new GroqProvider(makeConfig(['key']));
    expect(provider.getBaseUrl()).toContain('groq.com');
  });

  it('peekCurrentKey does not advance the index', () => {
    const provider = new GroqProvider(makeConfig(['key1', 'key2']));
    const peek1 = provider.peekCurrentKey();
    const peek2 = provider.peekCurrentKey();
    expect(peek1).toBe(peek2);
  });
});
