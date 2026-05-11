# 🔄 FreeSwap

> Hot-swap free LLM models for your agents. Auto-detect, auto-route, auto-failover.

[![npm version](https://img.shields.io/badge/npm-0.1.0-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

## The Problem

Free LLM APIs appear and disappear daily. Groq is fast today, rate-limited tomorrow. Gemini has 1M context but changes its free tier quarterly. Managing 9+ free providers manually is impractical.

## The Solution

FreeSwap is an intelligent proxy that aggregates 9+ free LLM providers behind a single OpenAI-compatible endpoint.

### Key Features

- **9 providers, one endpoint** — Groq, Gemini, OpenRouter, Cerebras, Mistral, NVIDIA NIM, Cloudflare, GitHub Models, Ollama
- **Smart routing** — `free` (max uptime), `free-fast` (lowest latency), `free-smart` (best reasoning)
- **Task-aware classification** — Simple prompts use fast/cheap models; complex reasoning uses capable models
- **Auto-failover** — Provider rate-limited? Next one answers automatically
- **Multi-key rotation** — Stack 3 keys per provider for ~450 req/min combined
- **Circuit breakers** — Failing providers get sidelined and tested for recovery
- **Live dashboard** — Provider health, usage stats, cache hit rate at `/v1/status`
- **Ollama integration** — Route simple tasks to local models for zero-cost inference

## Quick Start

```bash
# Install
npx freeswap

# Or clone and run
git clone https://github.com/yourusername/freeswap
cd freeswap
npm install
cp .env.example .env
# Add your API keys to .env

# Start
npx freeswap start
```

### Usage

Replace your OpenAI base URL:

```python
# Before:
client = OpenAI(api_key="sk-...")

# After:
client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="your-master-key"
)
```

Use meta-models:

```python
# Fastest available (perfect for chatbots)
response = client.chat.completions.create(model="free-fast", ...)

# Best reasoning (for complex tasks)
response = client.chat.completions.create(model="free-smart", ...)

# Max availability (auto-failover across all providers)
response = client.chat.completions.create(model="free", ...)
```

## Meta-Models

| Model | Strategy | Best For |
|-------|----------|---------|
| `free` | Rotates across all providers | Max uptime |
| `free-fast` | Lowest latency first (Groq, Cerebras) | Chatbots, real-time UI |
| `free-smart` | Most capable first (Gemini, NIM) | Reasoning, code generation |

## Supported Providers

| Provider | Rate Limit | Models | Sign Up |
|----------|-----------|--------|---------|
| Groq | 30 RPM / 1000 RPD | Llama 3.3 70B, Llama 4 Scout | [console.groq.com](https://console.groq.com) |
| Gemini | 10 RPM / 1500 RPD | 2.5 Flash (1M ctx), 2.5 Pro | [aistudio.google.com](https://aistudio.google.com) |
| OpenRouter | 20 RPM / 50 RPD | 27+ free models | [openrouter.ai](https://openrouter.ai) |
| Cerebras | 30 RPM / 14400 RPD | Llama 3.3 70B, GPT-OSS 120B | [cloud.cerebras.ai](https://cloud.cerebras.ai) |
| Mistral | 2 RPM / 1B tok/mo | Small 3.1, Codestral | [console.mistral.ai](https://console.mistral.ai) |
| NVIDIA NIM | 40 RPM / 1000 credits | Llama 3.3 70B, DeepSeek R1 | [build.nvidia.com](https://build.nvidia.com) |
| Cloudflare | 20 RPM / 10000 neur/d | Llama 3.3 70B | [workers.ai](https://workers.ai) |
| GitHub Models | 15 RPM / 150 RPD | GPT-4o-mini, Llama 3.3 | [marketplace/models](https://github.com/marketplace/models) |
| Ollama | Unlimited (local) | Any local model | [ollama.ai](https://ollama.ai) |

## Architecture

```
FreeSwap
├── Model Registry     — Community-maintained YAML of verified free models
├── Health Monitor     — Periodic probes + circuit breakers per provider
├── Task Classifier    — Heuristic complexity estimation (simple/standard/complex)
├── Smart Router       — Picks best model based on classification + meta-model
├── Fallback Manager   — Automatic failover through provider chain
├── Multi-Key Rotator  — Round-robin key rotation per provider
└── OpenAI Proxy       — Drop-in replacement at /v1/chat/completions
```

## CLI

```bash
freeswap start     # Start proxy server
freeswap list      # List registered free models
freeswap providers # List configured providers
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FREESWAP_MASTER_KEY` | `dev-key` | API key for proxy auth |
| `GROQ_API_KEY` | — | Comma-separated for multi-key |
| `GOOGLE_GEMINI_KEY` | — | — |
| `OPENROUTER_KEY` | — | — |
| `CEREBRAS_KEY` | — | — |
| `MISTRAL_KEY` | — | — |
| `NVIDIA_NIM_KEY` | — | — |
| `CLOUDFLARE_KEY` | — | — |
| `GITHUB_MODELS_KEY` | — | — |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | — |
| `PORT` | `8080` | Server port |
| `DEFAULT_META_MODEL` | `free` | Default routing strategy |
| `LOG_LEVEL` | `info` | debug, info, warn, error |

## Why Not Just Use OpenRouter/LiteLLM?

| Feature | FreeSwap | OpenRouter | LiteLLM |
|---------|----------|-----------|---------|
| Cost | $0 (no markup) | 5.5% markup | $0 (self-host) |
| Multi-key rotation | ✅ | ❌ | ❌ |
| Real-time model discovery | ✅ | ❌ | ❌ |
| Task-aware routing | ✅ (4 tiers) | ❌ (random) | ❌ (static) |
| Local Ollama integration | ✅ | ❌ | ✅ |
| Circuit breakers | ✅ | Basic | ❌ |
| Agent plugin architecture | ✅ (roadmap) | ❌ | ❌ |

## Roadmap

- [x] Phase 1: MVP proxy with 9 providers + failover
- [ ] Phase 2: Real-time model discovery via automated health probes
- [ ] Phase 3: Community model registry (GitHub Issues/PRs)
- [ ] Phase 4: Web dashboard with provider analytics
- [ ] Phase 5: Plugin adapters for OpenCode, Claude Code, etc.

## Contributing

See our [registry YAML](models/registry.yaml). Found a new free model? Open a PR!

## License

MIT