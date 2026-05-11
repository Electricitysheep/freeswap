import {
  TaskComplexity,
  TaskClassification,
} from '../types';

// ============================================================
// Configurable Heuristic Constants
// ============================================================

/** Max character count for a prompt to be considered simple */
export const SIMPLE_PROMPT_MAX_CHARS = 200;
/** Min estimated tokens to trigger complex classification */
export const COMPLEX_PROMPT_MIN_TOKENS = 4000;
/** Min estimated tokens to trigger long-context flag */
export const LONG_CONTEXT_MIN_TOKENS = 10000;
/** Min number of turns to consider a conversation multi-turn (standard) */
export const STANDARD_TURN_THRESHOLD = 2;
/** Output token estimate multiplier for simple tasks */
export const OUTPUT_TOKEN_SIMPLE_MULT = 0.5;
/** Output token estimate multiplier for standard tasks */
export const OUTPUT_TOKEN_STANDARD_MULT = 1.0;
/** Output token estimate multiplier for complex tasks */
export const OUTPUT_TOKEN_COMPLEX_MULT = 1.5;
/** Output token estimate multiplier for critical tasks */
export const OUTPUT_TOKEN_CRITICAL_MULT = 2.0;
/** Max output tokens for simple tasks */
export const OUTPUT_TOKEN_SIMPLE_MAX = 512;
/** Max output tokens for standard tasks */
export const OUTPUT_TOKEN_STANDARD_MAX = 2048;
/** Max output tokens for complex tasks */
export const OUTPUT_TOKEN_COMPLEX_MAX = 4096;
/** Max output tokens for critical tasks */
export const OUTPUT_TOKEN_CRITICAL_MAX = 8192;

// ============================================================
// Token Estimation
// ============================================================

/**
 * Rough token estimator: characters / 4.
 * This is a fast heuristic suitable for routing decisions.
 */
export function estimateTokens(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  return Math.ceil(text.length / 4);
}

// ============================================================
// Detection Helpers
// ============================================================

function detectCodeBlocks(text: string): boolean {
  if (!text) return false;
  return /```[\s\S]*?```/.test(text);
}

function detectToolUse(messages: any[] = []): boolean {
  return messages.some(
    (m) =>
      m?.role === 'assistant' &&
      Array.isArray(m?.tool_calls) &&
      m.tool_calls.length > 0
  );
}

function detectVision(messages: any[] = []): boolean {
  return messages.some((m) => {
    if (!Array.isArray(m?.content)) return false;
    return m.content.some(
      (c: any) => c?.type === 'image_url' || c?.type === 'image'
    );
  });
}

function detectStructuredOutputNeed(
  text: string,
  messages: any[] = []
): boolean {
  const fullText = [
    text,
    ...messages.map((m) => (typeof m?.content === 'string' ? m.content : '')),
  ]
    .join(' ')
    .toLowerCase();
  const keywords = ['json', 'schema', 'structured output', 'xml format', 'yaml output'];
  return keywords.some((kw) => fullText.includes(kw));
}

// ============================================================
// TaskClassifier
// ============================================================

export class TaskClassifier {
  /**
   * Classify a request by complexity using fast heuristics.
   */
  classify(
    prompt: string,
    options: { tools?: any[]; messages?: any[] } = {}
  ): TaskClassification {
    const messages = options.messages || [];
    const tools = options.tools || [];
    const textToAnalyze = prompt || '';

    const estimatedInputTokens = estimateTokens(textToAnalyze);

    const hasCodeBlocks = detectCodeBlocks(textToAnalyze);
    const hasToolUse = detectToolUse(messages) || tools.length > 0;
    const requiresVision = detectVision(messages);
    const requiresStructuredOutput = detectStructuredOutputNeed(
      textToAnalyze,
      messages
    );

    const hasLongContext = estimatedInputTokens > LONG_CONTEXT_MIN_TOKENS;

    let complexity: TaskComplexity = 'standard';

    if (requiresVision || requiresStructuredOutput || hasLongContext) {
      complexity = 'critical';
    } else if (
      hasToolUse ||
      hasCodeBlocks ||
      estimatedInputTokens > COMPLEX_PROMPT_MIN_TOKENS
    ) {
      complexity = 'complex';
    } else if (
      textToAnalyze.length < SIMPLE_PROMPT_MAX_CHARS &&
      !hasToolUse &&
      !hasCodeBlocks &&
      messages.length < STANDARD_TURN_THRESHOLD
    ) {
      complexity = 'simple';
    }

    const estimatedOutputTokens = this.estimateOutputTokens(
      complexity,
      estimatedInputTokens
    );

    return {
      complexity,
      requiresTools: hasToolUse,
      requiresVision,
      requiresStructuredOutput,
      requiresStreaming: false, // router overrides from request.stream
      estimatedInputTokens,
      estimatedOutputTokens,
      hasLongContext,
    };
  }

  private estimateOutputTokens(
    complexity: TaskComplexity,
    inputTokens: number
  ): number {
    switch (complexity) {
      case 'simple':
        return Math.min(
          OUTPUT_TOKEN_SIMPLE_MAX,
          Math.ceil(inputTokens * OUTPUT_TOKEN_SIMPLE_MULT)
        );
      case 'standard':
        return Math.min(
          OUTPUT_TOKEN_STANDARD_MAX,
          Math.ceil(inputTokens * OUTPUT_TOKEN_STANDARD_MULT)
        );
      case 'complex':
        return Math.min(
          OUTPUT_TOKEN_COMPLEX_MAX,
          Math.ceil(inputTokens * OUTPUT_TOKEN_COMPLEX_MULT)
        );
      case 'critical':
        return Math.min(
          OUTPUT_TOKEN_CRITICAL_MAX,
          Math.ceil(inputTokens * OUTPUT_TOKEN_CRITICAL_MULT)
        );
      default:
        return Math.min(
          OUTPUT_TOKEN_STANDARD_MAX,
          Math.ceil(inputTokens * OUTPUT_TOKEN_STANDARD_MULT)
        );
    }
  }
}
