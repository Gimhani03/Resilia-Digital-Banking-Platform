import { Global, Injectable, Logger, Module, OnModuleInit } from "@nestjs/common";
import { mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { createHash, randomUUID } from "crypto";

export interface NotificationSender {
  send(input: {
    channel: "sms" | "email" | "push";
    to: string;
    title: string;
    body: string;
  }): Promise<void>;
}

@Injectable()
export class ConsoleNotificationSender implements NotificationSender {
  private readonly logger = new Logger("NotificationSender");

  async send(input: {
    channel: "sms" | "email" | "push";
    to: string;
    title: string;
    body: string;
  }) {
    this.logger.log(
      `[${input.channel}] → ${input.to} · ${input.title}: ${input.body}`,
    );
  }
}

@Injectable()
export class HttpWebhookNotificationSender implements NotificationSender {
  private readonly logger = new Logger("WebhookNotifier");
  constructor(private readonly webhookUrl: string) {}

  async send(input: {
    channel: "sms" | "email" | "push";
    to: string;
    title: string;
    body: string;
  }) {
    try {
      await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    } catch (e) {
      this.logger.warn(
        `Webhook notify failed: ${e instanceof Error ? e.message : e}`,
      );
    }
  }
}

export const NOTIFICATION_SENDER = "NOTIFICATION_SENDER";

export interface ObjectStore {
  put(input: {
    key: string;
    bytes: Buffer;
    mimeType: string;
  }): Promise<{ key: string; url: string }>;
  getUrl(key: string): string;
  read?(key: string): Promise<Buffer | null>;
}

@Injectable()
export class LocalObjectStore implements ObjectStore {
  private readonly root: string;

  constructor() {
    this.root = process.env.UPLOAD_DIR || join(process.cwd(), "uploads");
  }

  async ensure() {
    await mkdir(this.root, { recursive: true });
  }

  async put(input: { key: string; bytes: Buffer; mimeType: string }) {
    await this.ensure();
    const safe = input.key.replace(/[^a-zA-Z0-9._/-]/g, "_");
    const path = join(this.root, safe);
    await mkdir(join(path, ".."), { recursive: true }).catch(() => undefined);
    await writeFile(path, input.bytes);
    return { key: safe, url: this.getUrl(safe) };
  }

  getUrl(key: string) {
    return `file://${join(this.root, key)}`;
  }

  async read(key: string): Promise<Buffer | null> {
    try {
      return await readFile(join(this.root, key));
    } catch {
      return null;
    }
  }
}

/** Minimal S3-compatible put via HTTP PUT when S3_ENDPOINT + bucket set. */
@Injectable()
export class S3ObjectStore implements ObjectStore {
  private readonly logger = new Logger("S3ObjectStore");
  private readonly endpoint: string;
  private readonly bucket: string;
  private readonly fallback = new LocalObjectStore();

  constructor() {
    this.endpoint = process.env.S3_ENDPOINT || "";
    this.bucket = process.env.S3_BUCKET || "resilia-kyc";
  }

  async put(input: { key: string; bytes: Buffer; mimeType: string }) {
    if (!this.endpoint) return this.fallback.put(input);
    const url = `${this.endpoint.replace(/\/$/, "")}/${this.bucket}/${input.key}`;
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": input.mimeType,
          ...(process.env.S3_ACCESS_KEY
            ? { "x-amz-meta-access": process.env.S3_ACCESS_KEY }
            : {}),
        },
        body: new Uint8Array(input.bytes),
      });
      if (!res.ok) throw new Error(`S3 PUT ${res.status}`);
      return { key: input.key, url };
    } catch (e) {
      this.logger.warn(
        `S3 put failed, falling back to local: ${e instanceof Error ? e.message : e}`,
      );
      return this.fallback.put(input);
    }
  }

  getUrl(key: string) {
    if (!this.endpoint) return this.fallback.getUrl(key);
    return `${this.endpoint.replace(/\/$/, "")}/${this.bucket}/${key}`;
  }
}

export const OBJECT_STORE = "OBJECT_STORE";

export function kycObjectKey(userId: string, documentType: string, ext: string) {
  const hash = createHash("sha256")
    .update(`${userId}:${documentType}:${randomUUID()}`)
    .digest("hex")
    .slice(0, 16);
  return `kyc/${userId}/${documentType}-${hash}.${ext}`;
}

@Global()
@Module({
  providers: [
    {
      provide: NOTIFICATION_SENDER,
      useFactory: (): NotificationSender => {
        const url = process.env.NOTIFY_WEBHOOK_URL?.trim();
        if (url) return new HttpWebhookNotificationSender(url);
        return new ConsoleNotificationSender();
      },
    },
    {
      provide: OBJECT_STORE,
      useFactory: (): ObjectStore => {
        if (process.env.S3_ENDPOINT?.trim()) return new S3ObjectStore();
        return new LocalObjectStore();
      },
    },
  ],
  exports: [NOTIFICATION_SENDER, OBJECT_STORE],
})
export class ProvidersModule implements OnModuleInit {
  constructor() {}
  async onModuleInit() {
    const store = new LocalObjectStore();
    await store.ensure();
  }
}
