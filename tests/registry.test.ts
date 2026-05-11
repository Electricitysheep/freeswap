import { describe, it, expect } from 'vitest';
import {
  loadRegistry,
  getModelsByProvider,
  getModelsByCapability,
  getModelsByMetaModel,
  findBestModel,
} from '../src/registry';

describe('loadRegistry', () => {
  it('loads registry from default path', async () => {
    const registry = await loadRegistry();
    expect(registry).toBeDefined();
    expect(registry.version).toBe('1.0');
    expect(Array.isArray(registry.models)).toBe(true);
  });

  it('returns models with required fields', async () => {
    const registry = await loadRegistry();
    for (const m of registry.models) {
      expect(m.id).toBeTruthy();
      expect(m.provider).toBeTruthy();
      expect(m.apiModelName).toBeDefined();
      expect(m.capabilities).toBeDefined();
      expect(m.rateLimit).toBeDefined();
    }
  });

  it('contains more than 0 models', async () => {
    const registry = await loadRegistry();
    expect(registry.models.length).toBeGreaterThan(0);
  });

  it('returns empty registry for non-existent path', async () => {
    const registry = await loadRegistry('/nonexistent/path.yaml');
    expect(registry.models).toEqual([]);
  });
});

describe('getModelsByProvider', () => {
  it('returns models for groq', async () => {
    const registry = await loadRegistry();
    const models = getModelsByProvider(registry, 'groq');
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((m) => m.provider === 'groq')).toBe(true);
  });

  it('returns empty array for unknown provider', async () => {
    const registry = await loadRegistry();
    const models = getModelsByProvider(registry, 'nonexistent-provider' as any);
    expect(models.length).toBe(0);
  });

  it('returns models for gemini', async () => {
    const registry = await loadRegistry();
    const models = getModelsByProvider(registry, 'gemini');
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((m) => m.provider === 'gemini')).toBe(true);
  });
});

describe('getModelsByCapability', () => {
  it('filters by toolUse', async () => {
    const registry = await loadRegistry();
    const models = getModelsByCapability(registry, { toolUse: true });
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((m) => m.capabilities.toolUse)).toBe(true);
  });

  it('filters by vision', async () => {
    const registry = await loadRegistry();
    const models = getModelsByCapability(registry, { vision: true });
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((m) => m.capabilities.vision)).toBe(true);
  });
});

describe('getModelsByMetaModel', () => {
  it('returns ordered models for free meta-model', async () => {
    const registry = await loadRegistry();
    const models = getModelsByMetaModel(registry, 'free');
    expect(models.length).toBeGreaterThan(0);
  });

  it('returns ordered models for free-fast meta-model', async () => {
    const registry = await loadRegistry();
    const models = getModelsByMetaModel(registry, 'free-fast');
    expect(models.length).toBeGreaterThan(0);
  });
});

describe('findBestModel', () => {
  it('finds best model with toolUse', async () => {
    const registry = await loadRegistry();
    const model = findBestModel(registry, { requiresTools: true });
    expect(model).not.toBeNull();
    expect(model!.capabilities.toolUse).toBe(true);
  });

  it('returns null for impossible criteria', async () => {
    const registry = await loadRegistry();
    const model = findBestModel(registry, { minContextWindow: 999999999 });
    expect(model).toBeNull();
  });

  it('finds best model with vision capability', async () => {
    const registry = await loadRegistry();
    const model = findBestModel(registry, { requiresVision: true });
    expect(model).not.toBeNull();
    expect(model!.capabilities.vision).toBe(true);
  });

  it('filters by provider', async () => {
    const registry = await loadRegistry();
    const model = findBestModel(registry, { provider: 'groq' });
    expect(model).not.toBeNull();
    expect(model!.provider).toBe('groq');
  });
});
