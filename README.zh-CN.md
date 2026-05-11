# 🔄 FreeSwap

> 为你的 AI Agent 热插拔免费 LLM 模型。自动发现、自动路由、自动故障转移。

[![npm version](https://img.shields.io/badge/npm-0.1.0-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()
[![CI](https://github.com/Electricitysheep/freeswap/actions/workflows/ci.yml/badge.svg)](https://github.com/Electricitysheep/freeswap/actions/workflows/ci.yml)

[English](README.md) | **中文**

---

## 📖 概述

**FreeSwap** 是一个开源智能代理，将 **9+ 个免费 LLM 提供商**聚合为一个 OpenAI 兼容端点。它解决了一个核心问题：

> 免费模型 API 每天都在出现和消失。Groq 今天很快，明天就被限速。Gemini 有 1M 上下文但免费层每个季度都在变。手动管理 9+ 个免费提供商不可行。

FreeSwap = **自动管理这一切**。

## ✨ 核心特性

| 特性 | 说明 |
|------|------|
| 🚀 **9 合 1 端点** | Groq、Gemini、OpenRouter、Cerebras、Mistral、NVIDIA NIM、Cloudflare、GitHub Models、Ollama |
| 🧠 **智能路由** | `free`(最大可用)、`free-fast`(最低延迟)、`free-smart`(最强推理) |
| 🎯 **任务感知** | 简单问题→最快/最便宜模型；复杂推理→最强大模型；自动分类 |
| 🔄 **自动故障转移** | 提供商限速？自动切换到下一个，你永远看不到 429 |
| 🔑 **多密钥轮换** | 每个提供商堆叠 3+ 个 API 密钥，获得 ~450 req/min 的免费额度 |
| 🛡️ **断路器** | 故障提供商自动隔离并在恢复后重新测试 |
| 📊 **Web 仪表盘** | 内置暗色主题仪表盘，实时监控提供商健康状态 |
| ⚡ **响应缓存** | 相同提示返回缓存结果 (~23ms)，零配额消耗 |
| 💻 **本地集成** | 搭配 Ollama 将简单任务路由到本地模型，零成本推理 |
| 🔌 **即插即用** | 替换 OpenAI base URL 即可使用，无需修改代码 |

## 🚀 快速开始

```bash
# 通过 npx 运行
npx freeswap

# 或克隆仓库
git clone https://github.com/Electricitysheep/freeswap.git
cd freeswap
npm install
cp .env.example .env
# 编辑 .env 填入你的 API 密钥

# 启动代理服务器
npx freeswap start
```

### 一行代码集成

**之前：**
```python
client = OpenAI(api_key="sk-xxx")
```

**之后：**
```python
client = OpenAI(
    base_url="http://localhost:8080/v1",  # 替换 base URL
    api_key="你的 master key"
)
```

### 使用元模型

```python
# 最快模型（适合聊天机器人）
response = client.chat.completions.create(model="free-fast", ...)

# 最强推理（适合复杂任务）
response = client.chat.completions.create(model="free-smart", ...)

# 最大可用性（自动故障转移）
response = client.chat.completions.create(model="free", ...)
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
├── 注册表引擎      — YAML + SHA-256 验证的免费模型数据库
├── 健康监控        — 定时探测 + 三态断路器 (关闭/半开/断开)
├── 任务分类器      — 启发式复杂度评估 (简单/标准/复杂/关键)
├── 智能路由引擎    — 复杂度 + 能力 + 成本多维度最优匹配  
├── 故障转移管理器  — 自动降级到链中下一个提供商
├── 多密钥轮换器    — 轮询分发密钥以突破免费速率限制
├── 响应缓存        — LRU + TTL 缓存，零配额重复利用
├── Web 仪表盘      — 暗色主题、实时健康监控
└── OpenAI 代理     — /v1/chat/completions 即插即用
```

## 📟 CLI 命令

```bash
freeswap start     # 启动代理服务器
freeswap list      # 列出注册的免费模型
freeswap providers # 列出配置的提供商
```

## 🔧 环境变量

| 变量 | 默认值 | 说明 |
|----------|---------|------|
| `FREESWAP_MASTER_KEY` | `dev-key` | 代理认证密钥 |
| `GROQ_API_KEY` | — | 逗号分隔以启用多密钥 |
| `GOOGLE_GEMINI_KEY` | — | — |
| `OPENROUTER_KEY` | — | — |
| `CEREBRAS_KEY` | — | — |
| `MISTRAL_KEY` | — | — |
| `NVIDIA_NIM_KEY` | — | — |
| `CLOUDFLARE_KEY` | — | — |
| `GITHUB_MODELS_KEY` | — | — |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | — |
| `PORT` | `8080` | 服务器端口 |
| `DEFAULT_META_MODEL` | `free` | 默认路由策略 |
| `LOG_LEVEL` | `info` | debug、info、warn、error |

## 📊 Web 仪表盘

启动后访问 **http://localhost:8080/**：

- **提供商健康卡片** — 颜色编码状态（绿/黄/红/灰）
- **实时状态** — 每 5 秒自动刷新
- **模型注册表** — 可搜索的模型表格
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
| 🔌 Agent 插件架构 | ✅ (规划中) | ❌ | ❌ |

## 📈 发展路线图

- [x] **Phase 1**: MVP 代理 (9 提供商 + 故障转移 + 32 次测试)
- [x] **Phase 2**: Web 仪表盘 + 响应缓存 + CI/CD + 模型发现
- [ ] **Phase 3**: 社区模型注册表 (GitHub Issues/PR 自动验证)
- [ ] **Phase 4**: ML 驱动路由 (ONNX 模型选择分类器)
- [ ] **Phase 5**: 插件适配器 (OpenCode、Claude Code、Cursor)

## 🤝 贡献

发现新的免费模型？提交 PR 更新 `models/registry.yaml`！

1. Fork 仓库
2. 在 registry.yaml 中添加模型
3. 运行 `npm run validate` 验证
4. 提交 PR

## 📄 许可证

MIT
