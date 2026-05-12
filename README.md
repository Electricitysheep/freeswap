<div align="center">

# 🔄 FreeSwap

**为你的 AI Agent 热插拔免费 LLM 模型 · Hot-swap free LLM models for your agents**

自动发现 · 自动路由 · 自动故障转移 | Auto-detect · Auto-route · Auto-failover

[![npm version](https://img.shields.io/badge/npm-0.1.0-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()
[![CI](https://github.com/Electricitysheep/freeswap/actions/workflows/ci.yml/badge.svg)](https://github.com/Electricitysheep/freeswap/actions/workflows/ci.yml)

[🇨🇳 中文](#-概述) | [🇬🇧 English](#-overview)

---

**⭐ If you find this useful, please give it a Star!** ⭐

---

</div>

---

# 🇨🇳 中文文档

## 📖 概述

**FreeSwap** 是一个开源智能代理，将 **9+ 个免费 LLM 提供商** 聚合并一个 OpenAI 兼容端点。

> 免费模型 API 每天都在出现和消失。Groq 今天很快，明天就被限速。Gemini 有 1M 上下文但免费层每个季度都在变。手动管理 9+ 个免费提供商不可行。
>
> **FreeSwap = 自动管理这一切。**

## ✨ 核心特性

| 特性 | 说明 |
|------|------|
| 🚀 **9 合 1 端点** | Groq、Gemini、OpenRouter、Cerebras、Mistral、NVIDIA NIM、Cloudflare、GitHub Models、Ollama |
| 🧠 **智能路由** | `free`(最大可用)、`free-fast`(最低延迟)、`free-smart`(最强推理) |
| 🎯 **任务感知** | 简单问题→最快/最便宜模型；复杂推理→最强大模型 |
| 🔄 **自动故障转移** | 提供商限速？自动切换到下一个，你永远看不到 429 |
| 🔑 **多密钥轮换** | 每个提供商堆叠 3+ 个 API 密钥，获得 ~450 req/min 的免费额度 |
| 🛡️ **断路器** | 故障提供商自动隔离并在恢复后重新测试 |
| 📊 **Web 仪表盘** | 内置暗色主题仪表盘，实时监控提供商健康状态 |
| ⚡ **响应缓存** | SHA-256 + LRU，相同提示 ~23ms 返回，零配额消耗 |
| 💻 **本地集成** | 搭配 Ollama 将简单任务路由到本地模型，零成本推理 |
| 🐳 **Docker 支持** | 一行命令部署：`docker run freeswap/freeswap` |
| 🔌 **即插即用** | 替换 OpenAI base URL 即可使用，无需修改代码 |

## 🚀 快速开始

```bash
# 一键安装（推荐）
curl -fsSL https://raw.githubusercontent.com/Electricitysheep/freeswap/main/scripts/install.sh | bash

# 或通过 Docker
docker run -p 8080:8080 freeswap/freeswap

# 或通过 npx
npx freeswap

# 或克隆仓库
git clone https://github.com/Electricitysheep/freeswap.git
cd freeswap
npm install && npm run build
cp .env.example .env
# 编辑 .env 填入你的 API 密钥

# 启动
npx freeswap start
```

### 一行代码集成

```python
# 之前：
client = OpenAI(api_key="sk-xxx")

# 之后：
client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="你的 master key"
)

# 使用元模型：
response = client.chat.completions.create(model="free-fast", ...)
```

## 🧩 元模型策略

| 模型 | 策略 | 适用场景 |
|------|------|---------|
| `free` | 轮询所有可用提供商 | 追求最大可用性 |
| `free-fast` | 低延迟优先 (Groq、Cerebras) | 聊天机器人、实时 UI |
| `free-smart` | 高能力优先 (Gemini、NVIDIA NIM) | 推理、代码生成、分析 |

## 🔌 支持提供商

| 提供商 | 速率限制 | 最佳模型 | 注册地址 |
|--------|---------|---------|---------|
| **Groq** 🔥 | 30 RPM / 1000 RPD | Llama 3.3 70B (315 tok/s) | [console.groq.com](https://console.groq.com) |
| **Gemini** 🏆 | 10 RPM / 1500 RPD | 2.5 Flash (1M 上下文) | [aistudio.google.com](https://aistudio.google.com) |
| **OpenRouter** 🌐 | 20 RPM / 50 RPD | 27+ 免费模型 | [openrouter.ai](https://openrouter.ai) |
| **Cerebras** ⚡ | 30 RPM / 14400 RPD | Llama 3.3 70B (~1000 tok/s) | [cloud.cerebras.ai](https://cloud.cerebras.ai) |
| **Mistral** 💪 | 2 RPM / 10亿 token/月 | Small 3.1、Codestral | [console.mistral.ai](https://console.mistral.ai) |
| **NVIDIA NIM** 🎯 | 40 RPM / 1000 积分 | Llama 3.3 70B、DeepSeek R1 | [build.nvidia.com](https://build.nvidia.com) |
| **Cloudflare** 🌍 | 20 RPM / 10000 神经元/天 | Llama 3.3 70B | [workers.ai](https://workers.ai) |
| **GitHub Models** 🐙 | 15 RPM / 150 RPD | GPT-4o-mini、Llama 3.3 | [marketplace/models](https://github.com/marketplace/models) |
| **Ollama** 💻 | 无限制 (本地) | 任何本地模型 | [ollama.ai](https://ollama.ai) |

## 🏗️ 架构

```
FreeSwap
├── 注册表引擎      — YAML 数据库（16 个已验证的免费模型）
├── 健康监控        — 定时探测 + 三态断路器
├── 任务分类器      — 启发式复杂度评估（简单/标准/复杂/关键）
├── 智能路由引擎    — 复杂度 + 能力 + 成本多维度最优匹配
├── 故障转移管理器  — 自动降级到链中下一个提供商
├── 多密钥轮换器    — 轮询分发密钥以突破免费速率限制
├── 响应缓存        — SHA-256 + LRU + TTL，零配额重复利用
├── Web 仪表盘      — 暗色主题、实时健康监控、费用节省统计
└── OpenAI 代理     — /v1/chat/completions 即插即用
```

## 📊 Web 仪表盘

启动后访问 **http://localhost:8080/**：

- **提供商健康卡片** — 颜色编码状态（绿/黄/红/灰）
- **实时状态** — 每 5 秒自动刷新
- **模型注册表** — 可搜索的模型表格
- **费用节省统计** — 实时显示你省了多少钱
- **统计概览** — 在线提供商数、模型总数、健康率

## 🤔 为什么不用 OpenRouter / LiteLLM？

| 特性 | FreeSwap | OpenRouter | LiteLLM |
|------|----------|-----------|---------|
| 💰 费用 | $0 (零加价) | +5.5% 加价 | $0 (自托管) |
| 🔑 多密钥轮换 | ✅ | ❌ | ❌ |
| 🕵️ 实时模型发现 | ✅ | ❌ | ❌ |
| 🧠 任务感知路由 | ✅ (4 级) | ❌ (随机) | ❌ (静态) |
| 💻 Ollama 集成 | ✅ | ❌ | ✅ |
| 🛡️ 断路器 | ✅ | 基础 | ❌ |
| 📊 Web 仪表盘 | ✅ | ✅ | ❌ |
| ⚡ 响应缓存 | ✅ (SHA-256+LRU) | ❌ | 插件 |
| 🐳 Docker | ✅ | ✅ | ❌ |

## 📟 CLI

```bash
freeswap start     # 启动代理服务器
freeswap list      # 列出注册的免费模型
freeswap providers # 列出配置的提供商
```

## 📈 发展路线

- [x] **Phase 1**: MVP 代理 — 9 提供商 + 故障转移 + 35 个测试
- [x] **Phase 2**: Web 仪表盘 + 响应缓存 + CI/CD + 多语言
- [ ] **Phase 3**: Docker 镜像 + 社区模型注册表
- [ ] **Phase 4**: ML 驱动路由 (ONNX 分类器)
- [ ] **Phase 5**: 插件适配器 (VSCode、OpenCode、Claude Code)

## 🤝 贡献

发现新的免费模型？提交 PR 更新 `models/registry.yaml`！

1. Fork 仓库
2. 在 registry.yaml 中添加模型条目
3. 运行 `npm run validate` 验证
4. 提交 PR

## 📄 许可证

MIT

---

---

# 🇬🇧 English

## 📖 Overview

**FreeSwap** is an open-source intelligent proxy that aggregates **9+ free LLM providers** behind a single OpenAI-compatible endpoint.

> Free LLM APIs appear and disappear daily. Groq is fast today, rate-limited tomorrow. Gemini has 1M context but changes its free tier quarterly. Managing 9+ free providers manually is impractical.
>
> **FreeSwap handles all of this automatically.**

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🚀 **9-in-1 Endpoint** | Groq, Gemini, OpenRouter, Cerebras, Mistral, NVIDIA NIM, Cloudflare, GitHub Models, Ollama |
| 🧠 **Smart Routing** | `free` (max uptime), `free-fast` (lowest latency), `free-smart` (best reasoning) |
| 🎯 **Task-Aware** | Simple → fast/cheap models; Complex → capable models; automatic classification |
| 🔄 **Auto-Failover** | Provider rate-limited? Next one answers. You never see 429s |
| 🔑 **Multi-Key Rotation** | Stack 3+ keys per provider for ~450 req/min combined free quota |
| 🛡️ **Circuit Breakers** | Failing providers get sidelined and tested for recovery |
| 📊 **Web Dashboard** | Dark-themed dashboard with real-time provider health monitoring |
| ⚡ **Response Cache** | SHA-256 + LRU, identical prompts return in ~23ms, zero quota burn |
| 💻 **Local Models** | Route simple tasks to Ollama for zero-cost inference |
| 🐳 **Docker Support** | One-command deploy: `docker run freeswap/freeswap` |
| 🔌 **Drop-in Replacement** | Swap your OpenAI base URL. That's it. No code changes needed |

## 🚀 Quick Start

```bash
# One-liner install (recommended)
curl -fsSL https://raw.githubusercontent.com/Electricitysheep/freeswap/main/scripts/install.sh | bash

# Or via Docker
docker run -p 8080:8080 freeswap/freeswap

# Or via npx
npx freeswap

# Or clone
git clone https://github.com/Electricitysheep/freeswap.git
cd freeswap
npm install && npm run build
cp .env.example .env
# Edit .env with your API keys

# Start
npx freeswap start
```

### Usage

```python
# Before:
client = OpenAI(api_key="sk-xxx")

# After:
client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="your-master-key"
)

# Meta-models:
response = client.chat.completions.create(model="free-fast", ...)
```

## 📊 Web Dashboard

Open **http://localhost:8080/** after starting:

- **Provider Health Cards** — Color-coded status (green/yellow/red/gray)
- **Live Status** — Auto-refresh every 5 seconds
- **Model Registry** — Searchable model table
- **Cost Savings** — Real-time savings counter
- **Stats Overview** — Online providers, total models, health rate

## 📟 CLI

```bash
freeswap start     # Start proxy server
freeswap list      # List registered free models
freeswap providers # List configured providers
```

## 🤝 Contributing

Found a new free model? Open a PR updating `models/registry.yaml`!

## 📄 License

MIT
