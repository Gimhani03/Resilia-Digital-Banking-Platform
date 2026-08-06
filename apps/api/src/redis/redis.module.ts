import { Global, Injectable, Module, OnModuleDestroy, Logger } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private memory = new Map<string, { value: string; expiresAt?: number }>();
  usingMemory: boolean;

  /** Counts every operation that silently landed on the fallback store. */
  fallbackOperations = 0;
  private lastFallbackReason = "";

  constructor() {
    const url = process.env.REDIS_URL?.trim();
    if (!url || url === "disabled") {
      this.degrade("REDIS_URL not set");
      this.usingMemory = true;
      return;
    }

    try {
      this.client = new Redis(url, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        enableOfflineQueue: false,
      });
      this.usingMemory = false;

      this.client.connect().catch((err) => {
        this.client = null;
        this.usingMemory = true;
        this.degrade(`connect failed: ${err?.message ?? err}`);
      });

      // A cache that quietly stops being shared across replicas is the same
      // failure as a cache that is down — surface it either way.
      this.client.on("error", (err) => {
        this.degrade(`connection error: ${err?.message ?? err}`);
      });
    } catch (err) {
      this.client = null;
      this.usingMemory = true;
      this.degrade(`init failed: ${(err as Error).message}`);
    }
  }

  /**
   * Marks the cache as degraded. Logged at error level, not warn: an operator
   * scanning for problems must see this, because every read still succeeds and
   * the service otherwise looks perfectly healthy. /api/health/ready reports
   * `redis: degraded` off the same flag.
   */
  private degrade(reason: string) {
    this.usingMemory = true;
    if (this.lastFallbackReason === reason) return;
    this.lastFallbackReason = reason;
    this.logger.error(
      `REDIS DEGRADED — falling back to in-process store (${reason}). ` +
        `OTP challenges and rate-limit counters are now replica-local.`,
    );
  }

  /** Exposed for the readiness probe and for Application Insights metrics. */
  status() {
    return {
      usingMemory: this.usingMemory,
      fallbackOperations: this.fallbackOperations,
      lastFallbackReason: this.lastFallbackReason || null,
    };
  }

  async onModuleDestroy() {
    if (this.client) await this.client.quit().catch(() => undefined);
  }

  private memGet(key: string) {
    this.fallbackOperations += 1;
    const row = this.memory.get(key);
    if (!row) return null;
    if (row.expiresAt && row.expiresAt < Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return row.value;
  }

  async get(key: string): Promise<string | null> {
    if (this.client) {
      try {
        return await this.client.get(key);
      } catch {
        return this.memGet(key);
      }
    }
    return this.memGet(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.client) {
      try {
        if (ttlSeconds) await this.client.set(key, value, "EX", ttlSeconds);
        else await this.client.set(key, value);
        return;
      } catch {
        /* fall through */
      }
    }
    this.memory.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async del(key: string): Promise<void> {
    if (this.client) {
      try {
        await this.client.del(key);
        return;
      } catch {
        /* fall through */
      }
    }
    this.memory.delete(key);
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    if (this.client) {
      try {
        const n = await this.client.incr(key);
        if (n === 1 && ttlSeconds) await this.client.expire(key, ttlSeconds);
        return n;
      } catch {
        /* fall through */
      }
    }
    const cur = Number(this.memGet(key) || "0") + 1;
    this.memory.set(key, {
      value: String(cur),
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
    return cur;
  }
}

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
