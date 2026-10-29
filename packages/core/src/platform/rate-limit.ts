import type { Redis } from "ioredis";
import { DomainError } from "../shared/errors";

export interface RateLimiter {
  /** Count one hit against `key`; returns false when the limit for the window is exceeded. */
  hit(key: string, limit: number, windowSeconds: number): Promise<boolean>;
}

export class RedisRateLimiter implements RateLimiter {
  constructor(private readonly redis: Redis) {}
  async hit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const k = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSeconds)}`;
    const count = await this.redis.incr(k);
    if (count === 1) await this.redis.expire(k, windowSeconds);
    return count <= limit;
  }
}

export class MemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, { count: number; until: number }>();
  async hit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || entry.until < now) {
      this.hits.set(key, { count: 1, until: now + windowSeconds * 1000 });
      return 1 <= limit;
    }
    entry.count += 1;
    return entry.count <= limit;
  }
}

export async function enforce(limiter: RateLimiter, key: string, limit: number, windowSeconds: number): Promise<void> {
  if (!(await limiter.hit(key, limit, windowSeconds))) throw new DomainError("auth.rate_limited", 429);
}
