/**
 * API Key Manager for Gemini - Handles rotation of multiple API keys with rate limiting
 * 
 * Supports 5 API keys with:
 * - Round-robin rotation for even distribution
 * - Per-key rate limiting (8-9 RPM per key, safe below 10 RPM limit)
 * - Token bucket algorithm for smooth rate limiting
 * - Health tracking per key (success/failure rates)
 * - Intelligent backoff for failed keys
 * - Automatic fallback to healthy keys
 * 
 * Calculation:
 * - 5 keys × 9 RPM = 45 RPM total (handling 40-45 student submissions/minute)
 * - 5 keys × 250 RPD = 1250 RPD total (sufficient for 1000+ requests/day with buffer)
 * - Safe margin: Each key at 8-9 RPM (well below 10 RPM limit)
 * - Per key: ~200 requests per day (well within 250 RPD limit)
 */

class APIKeyManager {
  constructor() {
    // Load 5 API keys from environment with rate limiting
    this.keys = [
      { id: 1, key: process.env.GEMINI_API_KEY_1, healthy: true, lastFailureTime: null, failureCount: 0, requestCount: 0, successCount: 0, ...this.initRateLimiter() },
      { id: 2, key: process.env.GEMINI_API_KEY_2, healthy: true, lastFailureTime: null, failureCount: 0, requestCount: 0, successCount: 0, ...this.initRateLimiter() },
      { id: 3, key: process.env.GEMINI_API_KEY_3, healthy: true, lastFailureTime: null, failureCount: 0, requestCount: 0, successCount: 0, ...this.initRateLimiter() },
      { id: 4, key: process.env.GEMINI_API_KEY_4, healthy: true, lastFailureTime: null, failureCount: 0, requestCount: 0, successCount: 0, ...this.initRateLimiter() },
      { id: 5, key: process.env.GEMINI_API_KEY_5, healthy: true, lastFailureTime: null, failureCount: 0, requestCount: 0, successCount: 0, ...this.initRateLimiter() },
    ];

    this.currentIndex = 0; // Round-robin index
    this.rotationEnabled = true;
    
    // Rate limiting config
    this.rpmLimit = 9; // 9 requests per minute per key (safe below 10 RPM limit)
    this.tokensPerSecond = this.rpmLimit / 60; // Distribute tokens smoothly
    
    // Validate that all keys are configured
    const missingKeys = this.keys.filter(k => !k.key).map(k => `GEMINI_API_KEY_${k.id}`);
    if (missingKeys.length > 0) {
      console.warn(`[API-KEY-MANAGER] Missing keys: ${missingKeys.join(', ')}. Configure GEMINI_API_KEY_1 through GEMINI_API_KEY_5.`);
    }
    
    const validKeys = this.keys.filter(k => k.key).length;
    console.log(`[API-KEY-MANAGER] Initialized with ${validKeys}/5 API keys. Max capacity: ${validKeys * this.rpmLimit} RPM (${validKeys * 250} RPD).`);
  }

  /**
   * Initialize token bucket rate limiter for a key
   * Token bucket: allows smooth distribution of requests up to limit
   */
  initRateLimiter() {
    return {
      tokens: this.rpmLimit, // Start with full bucket
      lastRefillTime: Date.now(),
    };
  }

  /**
   * Refill tokens based on time elapsed (token bucket algorithm)
   * Called before checking if key has available capacity
   */
  refillTokens(key) {
    const now = Date.now();
    const elapsedMs = now - key.lastRefillTime;
    const elapsedSeconds = elapsedMs / 1000;
    
    // Add tokens based on elapsed time
    const tokensToAdd = elapsedSeconds * this.tokensPerSecond;
    key.tokens = Math.min(key.tokens + tokensToAdd, this.rpmLimit);
    key.lastRefillTime = now;
  }

  /**
   * Check if a key has available capacity (rate limit check)
   */
  hasCapacity(key) {
    this.refillTokens(key);
    return key.tokens >= 1;
  }

  /**
   * Consume one token from the key (called after successful request)
   */
  consumeToken(key) {
    this.refillTokens(key);
    if (key.tokens >= 1) {
      key.tokens -= 1;
      return true;
    }
    return false;
  }

  /**
   * Get the next available API key using round-robin with health + rate limit awareness
   * Prioritizes healthy keys with available capacity
   * Falls back to others if all are temporarily throttled
   */
  getNextKey() {
    // Filter keys that are healthy AND have capacity
    const availableKeys = this.keys.filter(k => k.key && k.healthy && this.hasCapacity(k));
    
    if (availableKeys.length === 0) {
      // No healthy keys with capacity; try any healthy key (may need to wait)
      const healthyKeys = this.keys.filter(k => k.key && k.healthy);
      
      if (healthyKeys.length === 0) {
        // All keys unhealthy; pick the one that failed longest ago
        const validKeys = this.keys.filter(k => k.key);
        if (validKeys.length === 0) {
          throw new Error('No API keys configured. Set GEMINI_API_KEY_1 through GEMINI_API_KEY_5');
        }
        const leastRecentFailure = validKeys.reduce((prev, curr) => {
          const prevTime = prev.lastFailureTime || 0;
          const currTime = curr.lastFailureTime || 0;
          return currTime < prevTime ? curr : prev;
        });
        console.warn(`[API-KEY-MANAGER] All keys unhealthy; using key ${leastRecentFailure.id} (least recently failed)`);
        return leastRecentFailure;
      }

      // Return first healthy key even if no capacity (will wait in queue)
      console.warn(`[API-KEY-MANAGER] No keys with capacity; returning first healthy key (${healthyKeys[0].id})`);
      return healthyKeys[0];
    }

    // Round-robin through available keys
    if (this.rotationEnabled) {
      let attempts = 0;
      while (attempts < availableKeys.length) {
        this.currentIndex = (this.currentIndex + 1) % this.keys.length;
        const key = this.keys[this.currentIndex];
        if (key.key && key.healthy && this.hasCapacity(key)) {
          console.log(`[API-KEY-MANAGER] Rotating to key ${key.id} (tokens: ${key.tokens.toFixed(1)}, requests: ${key.requestCount + 1})`);
          return key;
        }
        attempts++;
      }
    }

    // Fallback to first available
    return availableKeys[0];
  }

  /**
   * Record a successful API call and consume token
   */
  recordSuccess(keyId) {
    const key = this.keys.find(k => k.id === keyId);
    if (key) {
      key.requestCount++;
      key.successCount++;
      
      // Consume token for this request
      this.consumeToken(key);
      
      // Reduce failure count on success (recovery)
      key.failureCount = Math.max(0, key.failureCount - 1);
      if (key.failureCount === 0 && !key.healthy) {
        key.healthy = true;
        console.log(`[API-KEY-MANAGER] Key ${keyId} recovered (${key.successCount}/${key.requestCount} successful, ${key.tokens.toFixed(1)} tokens available)`);
      }
      console.log(`[API-KEY-MANAGER] Key ${keyId} success: ${key.successCount}/${key.requestCount} (${Math.round(100 * key.successCount / key.requestCount)}%), tokens: ${key.tokens.toFixed(1)}`);
    }
  }

  /**
   * Record a failed API call and trigger backoff
   */
  recordFailure(keyId, errorMessage) {
    const key = this.keys.find(k => k.id === keyId);
    if (key) {
      key.requestCount++;
      key.failureCount++;
      key.lastFailureTime = Date.now();

      // Determine if key should be marked unhealthy based on failure rate
      const failureRate = key.failureCount / Math.max(key.requestCount, 1);
      const shouldMarkUnhealthy = key.failureCount >= 2 || failureRate > 0.3;

      if (shouldMarkUnhealthy && key.healthy) {
        key.healthy = false;
        console.warn(`[API-KEY-MANAGER] Key ${keyId} marked unhealthy (${key.failureCount}/${key.requestCount} failed, error: ${errorMessage})`);
      }

      const backoffMs = this.getBackoffMs(key.failureCount);
      console.warn(`[API-KEY-MANAGER] Key ${keyId} failed: ${errorMessage} (backoff: ${backoffMs}ms, failure rate: ${Math.round(100 * failureRate)}%, tokens: ${key.tokens.toFixed(1)})`);
    }
  }

  /**
   * Get exponential backoff delay in milliseconds
   * Scales: 1000ms, 2000ms, 4000ms, 8000ms, etc. (capped at 60s)
   */
  getBackoffMs(failureCount) {
    const baseMs = 1000;
    const maxMs = 60000; // Cap at 60 seconds
    return Math.min(baseMs * Math.pow(2, Math.max(0, failureCount - 1)), maxMs);
  }

  /**
   * Get current statistics for all keys
   */
  getStats() {
    return this.keys.map(k => {
      this.refillTokens(k); // Ensure tokens are current
      return {
        id: k.id,
        healthy: k.healthy,
        requests: k.requestCount,
        successes: k.successCount,
        failures: k.failureCount,
        successRate: k.requestCount > 0 ? Math.round(100 * k.successCount / k.requestCount) : 100,
        tokens: parseFloat(k.tokens.toFixed(2)),
        capacity: k.key ? 'configured' : 'missing',
        lastFailure: k.lastFailureTime ? new Date(k.lastFailureTime).toISOString() : 'never',
      };
    });
  }

  /**
   * Reset statistics (for debugging/monitoring)
   */
  resetStats() {
    this.keys.forEach(k => {
      k.requestCount = 0;
      k.successCount = 0;
      k.failureCount = 0;
      k.lastFailureTime = null;
      k.healthy = true;
      k.tokens = this.rpmLimit; // Reset token bucket
      k.lastRefillTime = Date.now();
    });
    console.log('[API-KEY-MANAGER] Statistics reset, all tokens refilled');
  }
}

module.exports = new APIKeyManager();
