import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns default config with no env vars set', () => {
    delete process.env.PORT;
    delete process.env.FREESWAP_MASTER_KEY;
    const config = loadConfig();
    expect(config.port).toBe(8080);
    expect(config.host).toBe('127.0.0.1');
    expect(config.defaultMetaModel).toBe('free');
    expect(config.fallbackDepth).toBe(3);
  });

  it('reads PORT from env', () => {
    process.env.PORT = '3000';
    const config = loadConfig();
    expect(config.port).toBe(3000);
  });

  it('reads LOG_LEVEL from env', () => {
    process.env.LOG_LEVEL = 'debug';
    const config = loadConfig();
    expect(config.logLevel).toBe('debug');
  });

  it('reads DEFAULT_META_MODEL from env', () => {
    process.env.DEFAULT_META_MODEL = 'free-fast';
    const config = loadConfig();
    expect(config.defaultMetaModel).toBe('free-fast');
  });

  it('disables providers without API keys', () => {
    delete process.env.GROQ_API_KEY;
    delete process.env.GOOGLE_GEMINI_KEY;
    const config = loadConfig();
    const groq = config.providers.find((p) => p.id === 'groq');
    expect(groq?.enabled).toBe(false);
  });

  it('enables ollama even without env var', () => {
    const config = loadConfig();
    const ollama = config.providers.find((p) => p.id === 'ollama');
    expect(ollama?.enabled).toBe(true);
  });
});
