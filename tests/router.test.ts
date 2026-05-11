import { describe, it, expect } from 'vitest';
import { TaskClassifier, estimateTokens } from '../src/router/classifier';

describe('estimateTokens', () => {
  it('estimates 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates ~token count for normal text', () => {
    const tokens = estimateTokens('Hello world');
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(10);
  });
});

describe('TaskClassifier', () => {
  const classifier = new TaskClassifier();

  it('classifies short simple prompt as simple', () => {
    const result = classifier.classify('Hi', { messages: [{ role: 'user', content: 'Hi' }] });
    expect(result.complexity).toBe('simple');
  });

  it('classifies code block prompt as complex', () => {
    const result = classifier.classify('Write a function:\n```python\ndef hello():\n    pass\n```', {
      messages: [{ role: 'user', content: 'Write a function' }],
    });
    expect(result.complexity).toBe('complex');
  });

  it('detects tool requirements', () => {
    const result = classifier.classify('What is the weather?', {
      tools: [{ type: 'function', function: { name: 'get_weather' } }],
      messages: [{ role: 'user', content: 'What is the weather?' }],
    });
    expect(result.requiresTools).toBe(true);
  });

it('detects long context', () => {
    const longText = 'word '.repeat(10000);
    const result = classifier.classify(longText, {
      messages: [{ role: 'user', content: longText }],
    });
    expect(result.hasLongContext).toBe(true);
  });

  it('classifies standard conversation', () => {
    const result = classifier.classify('Tell me more', {
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'Tell me more' },
      ],
    });
    expect(['simple', 'standard']).toContain(result.complexity);
  });
});
