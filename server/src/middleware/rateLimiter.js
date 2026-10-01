import { config } from '../config.js';

/**
 * Sliding Window Token / Request Rate Limiter
 * Enforces per-client request limits based on API key or IP address.
 */
export function createRateLimiter({
  windowMs = config.rateLimit?.windowMs || 60000,
  maxRequests = config.rateLimit?.maxRequests || 120,
  keyGenerator = null
} = {}) {
  const clients = new Map(); // key -> { count, windowStart }

  // Periodic cleanup of stale client buckets every 2 minutes
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, client] of clients.entries()) {
      if (now - client.windowStart > windowMs * 2) {
        clients.delete(key);
      }
    }
  }, 120000);
  if (cleanupTimer.unref) cleanupTimer.unref();

  return function rateLimiterMiddleware(req, res, next) {
    // Health checks
    if (req.path === '/api/health' || req.path === '/health') {
      return next();
    }

    const now = Date.now();

    // Determine client identifier: API key or IP
    const clientId = keyGenerator
      ? keyGenerator(req)
      : (req.headers['x-api-key'] || req.ip || req.socket?.remoteAddress || 'unknown-client');

    let client = clients.get(clientId);

    if (!client || now - client.windowStart >= windowMs) {
      client = {
        count: 1,
        windowStart: now
      };
      clients.set(clientId, client);
    } else {
      client.count++;
    }

    const remaining = Math.max(0, maxRequests - client.count);
    const resetTimeSeconds = Math.ceil((client.windowStart + windowMs - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTimeSeconds);

    if (client.count > maxRequests) {
      res.setHeader('Retry-After', resetTimeSeconds);
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Limit of ${maxRequests} requests per ${windowMs / 1000}s exceeded.`,
          solution: `Please wait ${resetTimeSeconds} second(s) before retrying your request.`
        }
      });
    }

    next();
  };
}

// Default global rate limiter instance
export const rateLimiter = createRateLimiter();
