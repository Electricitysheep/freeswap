export interface TokenSaverOptions {
  maxToolOutputLength: number;
  maxMessageLength: number;
  compressGitDiff: boolean;
  compressJson: boolean;
  enableCavemanMode: boolean;
  cavemanSystemPrompt: string;
}

const DEFAULTS: TokenSaverOptions = {
  maxToolOutputLength: 4000,
  maxMessageLength: 8000,
  compressGitDiff: true,
  compressJson: true,
  enableCavemanMode: false,
  cavemanSystemPrompt: '',
};

export class TokenSaver {
  private options: TokenSaverOptions;

  constructor(options?: Partial<TokenSaverOptions>) {
    this.options = { ...DEFAULTS, ...options };
  }

  processMessages(messages: { role: string; content: any }[]): { role: string; content: any }[] {
    return messages.map((msg) => {
      if (msg.role === 'system' && this.options.enableCavemanMode) {
        return {
          ...msg,
          content: this.applyCavemanMode(msg.content),
        };
      }
      if (typeof msg.content === 'string') {
        return { ...msg, content: this.compressText(msg.content) };
      }
      if (Array.isArray(msg.content)) {
        return {
          ...msg,
          content: msg.content.map((part: any) => {
            if (part.type === 'text') {
              return { ...part, text: this.compressText(part.text) };
            }
            return part;
          }),
        };
      }
      return msg;
    });
  }

  private compressText(text: string): string {
    let result = text;

    if (text.length > this.options.maxMessageLength) {
      result = text.slice(0, this.options.maxMessageLength) +
        `\n\n[...truncated ${text.length - this.options.maxMessageLength} chars...]`;
    }

    if (this.options.compressGitDiff) {
      result = this.compressGitDiffOutput(result);
    }

    if (this.options.compressJson) {
      result = this.compressLargeJson(result);
    }

    return result;
  }

  private compressGitDiffOutput(text: string): string {
    const lines = text.split('\n');
    if (lines.length < 10) return text;
    const diffHeader = lines.filter((l) => l.startsWith('diff --git') || l.startsWith('---') || l.startsWith('+++'));
    if (diffHeader.length < 3) return text;

    const compressed: string[] = [];
    let inChunk = false;
    let removedLines = 0;

    for (const line of lines) {
      if (line.startsWith('diff --git') || line.startsWith('--- ') || line.startsWith('+++ ')) {
        if (removedLines > 0) {
          compressed.push(`  [...${removedLines} unmodified context lines hidden...]`);
          removedLines = 0;
        }
        compressed.push(line);
        inChunk = false;
      } else if (line.startsWith('@@ ')) {
        if (removedLines > 0) {
          compressed.push(`  [...${removedLines} unmodified context lines hidden...]`);
          removedLines = 0;
        }
        compressed.push(line);
        inChunk = true;
      } else if (inChunk) {
        if (line.startsWith('+') || line.startsWith('-')) {
          if (removedLines > 0) {
            compressed.push(`  [...${removedLines} unmodified context lines hidden...]`);
            removedLines = 0;
          }
          compressed.push(line);
        } else if (line.trim() === '') {
          compressed.push(line);
        } else {
          removedLines++;
        }
      } else {
        compressed.push(line);
      }
    }
    if (removedLines > 0) {
      compressed.push(`  [...${removedLines} unmodified context lines hidden...]`);
    }

    return compressed.join('\n');
  }

  private compressLargeJson(text: string): string {
    const jsonRegex = /```(?:json)?\s*(\{[\s\S]*?\}|\[[\s\S]*?\])\s*```/g;
    let match;
    let result = text;
    const offsets: { start: number; end: number; compressed: string }[] = [];

    while ((match = jsonRegex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        const sizeEstimate = JSON.stringify(parsed).length;
        if (sizeEstimate > 2000) {
          if (Array.isArray(parsed)) {
            const kept = parsed.slice(0, 20);
            const remaining = parsed.length - 20;
            offsets.push({
              start: match.index,
              end: match.index + match[0].length,
              compressed: '```json\n' +
                JSON.stringify(kept, null, 2) +
                `\n  ...${remaining} more items truncated...\n\`\`\``,
            });
          } else if (typeof parsed === 'object' && parsed !== null) {
            const keys = Object.keys(parsed);
            const kept: Record<string, any> = {};
            const sampleKeys = keys.slice(0, 15);
            for (const k of sampleKeys) kept[k] = parsed[k];
            offsets.push({
              start: match.index,
              end: match.index + match[0].length,
              compressed: '```json\n' +
                JSON.stringify(kept, null, 2) +
                `\n  ...${keys.length - 15} more keys truncated...\n\`\`\``,
            });
          }
        }
      } catch { /* skip invalid json */ }
    }

    for (let i = offsets.length - 1; i >= 0; i--) {
      const { start, end, compressed } = offsets[i];
      result = result.slice(0, start) + compressed + result.slice(end);
    }

    return result;
  }

  private applyCavemanMode(systemPrompt: string): string {
    return this.options.cavemanSystemPrompt || (
      'You are a caveman. Answer in short, terse sentences. ' +
      'No fluff, no explanations, no markdown formatting. ' +
      'Give only the essential technical substance. ' +
      'Use minimal words. Be direct. Ouch.'
    );
  }

  estimateSavings(messages: { role: string; content: any }[]): { originalChars: number; compressedChars: number; savingsPercent: number } {
    const originalStr = JSON.stringify(messages);
    const processed = this.processMessages(messages);
    const compressedStr = JSON.stringify(processed);
    const originalChars = originalStr.length;
    const compressedChars = compressedStr.length;

    return {
      originalChars,
      compressedChars,
      savingsPercent: originalChars > 0
        ? Math.round(((originalChars - compressedChars) / originalChars) * 100)
        : 0,
    };
  }
}

export function createTokenSaver(options?: Partial<TokenSaverOptions>): TokenSaver {
  return new TokenSaver(options);
}
