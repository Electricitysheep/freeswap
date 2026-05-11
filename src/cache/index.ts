import { createHash } from 'crypto';

interface CacheEntry {
  response: any;
  cachedAt: number;
  ttlMs: number;
}

export interface CachedResponse {
  response: any;
  cachedAt: number;
  ttlMs: number;
  isExpired(): boolean;
}

export interface ResponseCacheOptions {
  maxSize?: number;
  ttlMs?: number;
}

export class ResponseCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private defaultTtlMs: number;
  private hits: number;
  private misses: number;

  constructor(options?: ResponseCacheOptions) {
    this.cache = new Map();
    this.maxSize = options?.maxSize ?? 1000;
    this.defaultTtlMs = options?.ttlMs ?? 300000;
    this.hits = 0;
    this.misses = 0;
  }

  private generateKey(messages: any[], model: string, tools?: any[]): string {
    const key = JSON.stringify(messages) + model + (tools ? JSON.stringify(tools) : '');
    return createHash('sha256').update(key).digest('hex');
  }

  get(messages: any[], model: string, options?: { tools?: any[] }): CachedResponse | null {
    const key = this.generateKey(messages, model, options?.tools);
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() - entry.cachedAt > entry.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // LRU: re-insert to update Map order
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.hits++;
    return {
      response: entry.response,
      cachedAt: entry.cachedAt,
      ttlMs: entry.ttlMs,
      isExpired(): boolean {
        return Date.now() - entry.cachedAt > entry.ttlMs;
      },
    };
  }

  set(messages: any[], model: string, response: any, options?: { tools?: any[]; ttlMs?: number }): void {
    const key = this.generateKey(messages, model, options?.tools);
    const ttlMs = options?.ttlMs ?? this.defaultTtlMs;

    // Evict oldest entries until under maxSize
    while (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey === undefined) {
        break;
      }
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      response,
      cachedAt: Date.now(),
      ttlMs,
    });
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  getStats(): { size: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }
}

export function createResponseCache(options?: ResponseCacheOptions): ResponseCache {
  return new ResponseCache(options);
}
