import { Global, Injectable, Module, OnModuleDestroy, Logger } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private memory = new Map<string, { value: string; expiresAt?: number }>();
  usingMemory: boolean;

  constructor() {
    const url = process.env.REDIS_URL?.trim();
    if (url) {
      try {
        this.client = new Redis(url, {
          maxRetriesPerRequest: 1,
          lazyConnect: true,
          enableOfflineQueue: false,
        });
        this.client.connect().catch(() => {
          this.logger.warn("Redis unavailable — using in-memory store");
          this.client = null;
        });
        this.usingMemory = false;
      } catch {
        this.logger.warn("Redis init failed — using in-memory store");
        this.client = null;
        this.usingMemory = true;
      }
    } else {
      this.logger.warn("REDIS_URL not set — using in-memory store");
      this.usingMemory = true;
    }
  }

  async onModuleDestroy() {
    if (this.client) await this.client.quit().catch(() => undefined);
  }

  private memGet(key: string) {
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
