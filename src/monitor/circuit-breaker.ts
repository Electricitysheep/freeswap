// ============================================================
// FreeSwap - Circuit Breaker
// ============================================================

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit */
  failureThreshold?: number;
  /** Number of consecutive successes in half-open to close the circuit */
  successThreshold?: number;
  /** Max parallel requests allowed in half-open state */
  halfOpenMaxRequests?: number;
  /** Cooldown period (ms) before attempting half-open */
  cooldownMs?: number;
}

export interface CircuitBreakerStats {
  state: 'closed' | 'open' | 'half-open';
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  halfOpenRequests: number;
  lastOpenTime: number | null;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
}

export const DEFAULT_FAILURE_THRESHOLD = 3;
export const DEFAULT_SUCCESS_THRESHOLD = 2;
export const DEFAULT_HALF_OPEN_MAX = 1;
export const DEFAULT_COOLDOWN_MS = 30000;

/**
 * Circuit breaker that prevents cascading failures by temporarily
 * rejecting requests to a failing provider.
 *
 * Thread-safety note: all state mutations are synchronous and
 * therefore atomic with respect to the JavaScript event loop.
 */
export class CircuitBreaker {
  private _state: 'closed' | 'open' | 'half-open' = 'closed';
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private halfOpenRequests = 0;
  private lastOpenTime: number | null = null;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly halfOpenMaxRequests: number;
  private readonly cooldownMs: number;

  constructor(
    public readonly providerId: string,
    options: CircuitBreakerOptions = {}
  ) {
    this.failureThreshold = options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.successThreshold = options.successThreshold ?? DEFAULT_SUCCESS_THRESHOLD;
    this.halfOpenMaxRequests = options.halfOpenMaxRequests ?? DEFAULT_HALF_OPEN_MAX;
    this.cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  }

  /** Record a successful call through this circuit. */
  recordSuccess(): void {
    this.lastSuccessTime = Date.now();

    if (this._state === 'half-open') {
      this.halfOpenRequests = Math.max(0, this.halfOpenRequests - 1);
      this.consecutiveSuccesses++;

      if (this.consecutiveSuccesses > this.successThreshold) {
        this._state = 'closed';
        this.consecutiveFailures = 0;
        this.consecutiveSuccesses = 0;
        this.halfOpenRequests = 0;
      }
    } else if (this._state === 'closed') {
      this.consecutiveFailures = 0;
    }
  }

  /** Record a failed call through this circuit. */
  recordFailure(): void {
    this.lastFailureTime = Date.now();
    this.consecutiveFailures++;

    if (this._state === 'half-open') {
      this.halfOpenRequests = Math.max(0, this.halfOpenRequests - 1);
      this._state = 'open';
      this.lastOpenTime = Date.now();
      this.consecutiveSuccesses = 0;
    } else if (this._state === 'closed') {
      if (this.consecutiveFailures >= this.failureThreshold) {
        this._state = 'open';
        this.lastOpenTime = Date.now();
      }
    }
  }

  /**
   * Determine whether a new request may proceed.
   * Transitions open → half-open automatically when cooldown expires.
   */
  allowRequest(): boolean {
    if (this._state === 'closed') {
      return true;
    }

    if (this._state === 'open') {
      if (
        this.lastOpenTime !== null &&
        Date.now() - this.lastOpenTime >= this.cooldownMs
      ) {
        this._state = 'half-open';
        this.consecutiveSuccesses = 0;
        this.halfOpenRequests = 0;
      } else {
        return false;
      }
    }

    if (this._state === 'half-open') {
      if (this.halfOpenRequests < this.halfOpenMaxRequests) {
        this.halfOpenRequests++;
        return true;
      }
      return false;
    }

    return false;
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this._state;
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this._state,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      halfOpenRequests: this.halfOpenRequests,
      lastOpenTime: this.lastOpenTime,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
    };
  }
}
