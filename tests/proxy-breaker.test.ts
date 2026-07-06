// ============================================================
// FreeSwap - Circuit breaker wiring (proxy request path)
//
// Regression tests: the CircuitBreaker class must actually gate
// live /v1/chat/completions traffic, not just exist as a class.
// ============================================================

import { describe, it, expect, afterEach } from 'vitest';
import type { Server } from 'http';
import { createProxyServer } from '../src/proxy/server';
import { CircuitBreaker } from '../src/monitor/circuit-breaker';
import { FreeSwapConfig, ProviderHealth } from '../src/types';

function makeConfig(): FreeSwapConfig {
  return {
    port: 0,
    host: '127.0.0.1',
    masterKey: '',
    defaultMetaModel: 'free',
    fallbackDepth: 3,
    healthCheckIntervalMs: 3_600_000,
    logLevel: 'error',
    providers: [],
  };
}

function makeFakeProvider(id: string = 'groq') {
  const calls = { chat: 0 };
  let failing = true;
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
    async chatCompletion() {
      calls.chat++;
      if (failing) {
        return { error: { message: 'boom', type: 'provider_error', code: 'internal_error' } };
      }
      return {
        choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };
    },
    async healthCheck(): Promise<ProviderHealth> {
      return { ...health };
    },
    setFailing(v: boolean) {
      failing = v;
    },
  };
  return { provider, calls };
}

async function startServer(app: any): Promise<{ server: Server; url: string }> {
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address() as { port: number };
  return { server, url: `http://127.0.0.1:${addr.port}` };
}

function postChat(url: string) {
  return fetch(`${url}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'groq/llama-3.3-70b',
      messages: [{ role: 'user', content: 'hi' }],
    }),
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('CircuitBreaker unit: close threshold', () => {
  it('closes after exactly successThreshold successes in half-open', () => {
    const cb = new CircuitBreaker('groq', {
      failureThreshold: 1,
      successThreshold: 2,
      halfOpenMaxRequests: 5,
      cooldownMs: 0,
    });
    cb.recordFailure();
    expect(cb.getState()).toBe('open');
    expect(cb.allowRequest()).toBe(true); // cooldown 0 → half-open
    expect(cb.getState()).toBe('half-open');
    cb.recordSuccess();
    cb.recordSuccess();
    expect(cb.getState()).toBe('closed');
  });
});

describe('proxy circuit breaker wiring', () => {
  let cleanup: (() => Promise<void> | void)[] = [];

  afterEach(async () => {
    for (const fn of cleanup) await fn();
    cleanup = [];
  });

  async function bootProxy(breakerOptions = { failureThreshold: 3, successThreshold: 2, cooldownMs: 100 }) {
    const { provider, calls } = makeFakeProvider('groq');
    const app = await createProxyServer(makeConfig(), {
      providers: [provider as any],
      breakerOptions,
    });
    const { server, url } = await startServer(app);
    cleanup.push(() => app.locals.monitor?.stop());
    cleanup.push(() => new Promise<void>((r) => server.close(() => r())));
    // Let the monitor's immediate startup probe settle before traffic.
    await sleep(20);
    return { provider, calls, app, url };
  }

  it('opens the breaker after failureThreshold failures and stops calling the provider', async () => {
    const { provider, calls, app, url } = await bootProxy();

    // 3 failing requests → breaker opens. Each request must hit the
    // provider exactly once (no immediate retry of the failed primary).
    for (let i = 0; i < 3; i++) {
      const res = await postChat(url);
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
    expect(calls.chat).toBe(3);

    const breaker = app.locals.breakers?.get('groq');
    expect(breaker, 'breakers map must be populated and exposed').toBeDefined();
    expect(breaker.getState()).toBe('open');

    // 4th request: breaker open → provider must NOT be called.
    const res = await postChat(url);
    expect(res.status).toBe(503);
    expect(calls.chat).toBe(3);
  });

  it('allows traffic again after cooldown (half-open) and recovers on success', async () => {
    const { provider, calls, app, url } = await bootProxy();

    for (let i = 0; i < 3; i++) await postChat(url);
    expect(app.locals.breakers.get('groq').getState()).toBe('open');

    provider.setFailing(false);
    await sleep(120); // > cooldownMs

    const res = await postChat(url);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.choices[0].message.content).toBe('ok');
    expect(calls.chat).toBe(4);
  });
});
