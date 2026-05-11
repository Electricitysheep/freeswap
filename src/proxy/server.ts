import express from 'express';
import cors from 'cors';
import path from 'path';
import { FreeSwapConfig } from '../types';
import { loadRegistry } from '../registry';
import { ProviderFactory } from '../providers';
import { FreeSwapRouter } from '../router';
import { HealthMonitor } from '../monitor';

export async function createProxyServer(config: FreeSwapConfig) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  const registry = await loadRegistry(config.registryPath);
  const factory = new ProviderFactory();
  for (const pcfg of config.providers) {
    if (pcfg.enabled) factory.createProvider(pcfg.id, pcfg);
  }
  const providers = factory.getAll();
  const router = new FreeSwapRouter(registry, providers as any, config);
  const monitor = new HealthMonitor(providers as any, config, new Map());
  monitor.start();

  app.get('/', (_req: any, res: any) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
  });

  app.get('/v1/models', (_req: any, res: any) => {
    const models = registry.models.map((m: any) => ({
      id: m.id, object: 'model', created: Math.floor(Date.now() / 1000),
      owned_by: m.provider, permissions: [], root: m.id,
    }));
    ['free', 'free-fast', 'free-smart'].forEach((id) => {
      models.unshift({ id, object: 'model', created: Math.floor(Date.now() / 1000), owned_by: '@freeswap', permissions: [], root: id });
    });
    res.json({ object: 'list', data: models });
  });

  app.get('/v1/status', (_req: any, res: any) => {
    const health = monitor.getAllHealth();
    const status: any[] = [];
    health.forEach((h: any, id: string) => {
      status.push({ provider: id, status: h.status, avgLatencyMs: h.avgLatencyMs, circuitState: h.circuitState });
    });
    res.json({ providers: status, timestamp: Date.now() });
  });

  app.post('/v1/chat/completions', async (req: any, res: any) => {
    try {
      const decision = await router.route({
        model: req.body.model,
        messages: req.body.messages,
        tools: req.body.tools,
        stream: req.body.stream,
      });

      const primary = providers.find((p) => p.getProviderId() === decision.provider && p.isEnabled());

      if (!primary) {
        return sendFallback(providers, decision, req, res);
      }

      if (req.body.stream) {
        return handleStream(primary, decision, req, res);
      }

      const response = await primary.chatCompletion(
        req.body.messages.map((m: any) => ({ role: m.role, content: m.content })),
        { model: decision.model, tools: req.body.tools, max_tokens: req.body.max_tokens, temperature: req.body.temperature }
      );

      if ('error' in response) {
        const r = await tryFallbacks(providers, decision, req);
        if (r) return res.json(r);
        return res.status(429).json(response);
      }

      res.json(formatChatResponse(response, decision.model, decision.provider, false));
    } catch (err: any) {
      res.status(500).json({
        error: { message: err.message || 'Internal server error', type: 'server_error', code: 'INTERNAL_ERROR' },
      });
    }
  });

  return app;
}

async function handleStream(provider: any, decision: any, req: any, res: any) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive',
    'X-FreeSwap-Provider': decision.provider, 'X-FreeSwap-Model': decision.model, 'X-FreeSwap-Reason': decision.reason,
  });
  try {
    const stream = provider.streamChatCompletion(
      req.body.messages.map((m: any) => ({ role: m.role, content: m.content })),
      { model: decision.model, tools: req.body.tools, max_tokens: req.body.max_tokens, temperature: req.body.temperature }
    );
    let id = 0;
    for await (const chunk of stream) {
      if ('error' in chunk) continue;
      const choice = chunk.choices?.[0];
      res.write(`data: ${JSON.stringify({
        id: `chatcmpl-${id++}`, object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000), model: decision.model,
        choices: [{ index: 0, delta: { content: choice?.delta?.content || '' }, finish_reason: choice?.finish_reason || null }],
      })}\n\n`);
      if (choice?.finish_reason) break;
    }
    res.write('data: [DONE]\n\n');
  } catch { res.write(`data: ${JSON.stringify({ error: 'stream failed' })}\n\n`); }
  res.end();
}

async function tryFallbacks(providers: any[], decision: any, req: any) {
  for (const fb of decision.fallbackChain) {
    const p = providers.find((x: any) => x.getProviderId() === fb.provider && x.isEnabled());
    if (!p) continue;
    try {
      const resp = await p.chatCompletion(
        req.body.messages.map((m: any) => ({ role: m.role, content: m.content })),
        { model: fb.model || '', tools: req.body.tools }
      );
      if ('error' in resp) continue;
      return formatChatResponse(resp, fb.model, fb.provider, true);
    } catch { continue; }
  }
  return null;
}

async function sendFallback(providers: any[], decision: any, req: any, res: any) {
  const r = await tryFallbacks(providers, decision, req);
  if (r) return res.json(r);
  res.status(503).json({
    error: { message: 'All providers exhausted', type: 'no_provider', code: 'ALL_EXHAUSTED' },
  });
}

function formatChatResponse(response: any, model: string, provider: string, fallback: boolean) {
  return {
    id: `chatcmpl-${Date.now()}`, object: 'chat.completion',
    created: Math.floor(Date.now() / 1000), model,
    choices: [{
      index: 0,
      message: { role: 'assistant', content: response.choices?.[0]?.message?.content || null },
      finish_reason: response.choices?.[0]?.finish_reason || 'stop',
    }],
    usage: response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    provider,
    ...(fallback ? { fallback: true } : {}),
  };
}
