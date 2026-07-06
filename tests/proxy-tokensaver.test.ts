// ============================================================
// FreeSwap - TokenSaver must be opt-in
//
// Regression: the proxy silently truncated any message content
// longer than 8000 chars by default — fatal for a drop-in
// OpenAI-compatible proxy carrying long coding-agent contexts.
// ============================================================

import { describe, it, expect, afterEach } from 'vitest';
import type { Server } from 'http';
import { createProxyServer } from '../src/proxy/server';
import { FreeSwapConfig, ProviderHealth } from '../src/types';

function makeConfig(overrides: Partial<FreeSwapConfig> = {}): FreeSwapConfig {
  return {
    port: 0,
    host: '127.0.0.1',
    masterKey: '',
    defaultMetaModel: 'free',
    fallbackDepth: 3,
    healthCheckIntervalMs: 3_600_000,
    logLevel: 'error',
    providers: [],
    ...overrides,
  };
}

function makeRecordingProvider(id: string = 'groq') {
  const received: { messages: any[] }[] = [];
  const health: ProviderHealth = {
    providerId: id as ProviderHealth['providerId'],
    status: 'healthy',
    lastSuccess: null,
    lastFailure: null,
    consecutiveFailures: 0,
    circuitState: 'closed',
    avgLatencyMs: 10,
    errorRate: 0,
  };
  const provider = {
    health,
    getProviderId: () => id,
    isEnabled: () => true,
    async chatCompletion(messages: any[]) {
      received.push({ messages });
      return {
        choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };
    },
    async healthCheck(): Promise<ProviderHealth> {
      return { ...health };
    },
  };
  return { provider, received };
}

async function startServer(app: any): Promise<{ server: Server; url: string }> {
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address() as { port: number };
  return { server, url: `http://127.0.0.1:${addr.port}` };
}

describe('token saver opt-in', () => {
  let cleanup: (() => Promise<void> | void)[] = [];

  afterEach(async () => {
    for (const fn of cleanup) await fn();
    cleanup = [];
  });

  async function boot(config: FreeSwapConfig) {
    const { provider, received } = makeRecordingProvider('groq');
    const app = await createProxyServer(config, { providers: [provider as any] });
    const { server, url } = await startServer(app);
    cleanup.push(() => app.locals.monitor?.stop());
    cleanup.push(() => new Promise<void>((r) => server.close(() => r())));
    return { received, url };
  }

  async function send(url: string, content: string) {
    const res = await fetch(`${url}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'groq/llama-3.3-70b',
        messages: [{ role: 'user', content }],
      }),
    });
    expect(res.status).toBe(200);
  }

  it('passes long messages through untouched by default', async () => {
    const { received, url } = await boot(makeConfig());
    const longContent = 'x'.repeat(9000);

    await send(url, longContent);

    expect(received).toHaveLength(1);
    const delivered = received[0].messages[0].content;
    expect(delivered).toBe(longContent);
    expect(delivered).not.toContain('truncated');
  });

  it('compresses messages only when tokenSaverEnabled is set', async () => {
    const { received, url } = await boot(makeConfig({ tokenSaverEnabled: true }));
    const longContent = 'x'.repeat(9000);

    await send(url, longContent);

    expect(received).toHaveLength(1);
    const delivered = received[0].messages[0].content;
    expect(delivered.length).toBeLessThan(9000);
    expect(delivered).toContain('truncated');
  });
});
