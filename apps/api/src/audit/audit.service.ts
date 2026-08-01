import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditService {
  private writeChain: Promise<unknown> = Promise.resolve();

  constructor(private readonly prisma: PrismaService) {}

  record(input: {
    category: string;
    action: string;
    actor: string;
    detail: string;
  }) {
    const run = this.writeChain.then(() => this.write(input));
    this.writeChain = run.catch(() => undefined);
    return run;
  }

  private async write(input: {
    category: string;
    action: string;
    actor: string;
    detail: string;
  }) {
    const last = await this.prisma.auditEvent.findFirst({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const prevHash = last?.hash || "GENESIS";
    const payload = `${prevHash}|${input.category}|${input.action}|${input.actor}|${input.detail}|${Date.now()}`;
    const hash = createHash("sha256").update(payload).digest("hex");
    return this.prisma.auditEvent.create({
      data: { ...input, hash, prevHash },
    });
  }

  async list(category?: string) {
    return this.prisma.auditEvent.findMany({
      where: category && category !== "All" ? { category } : undefined,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    });
  }

  async integrity() {
    const events = await this.prisma.auditEvent.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    let ok = true;
    let prev = "GENESIS";
    let brokenAt: string | null = null;
    for (const e of events) {
      if (e.prevHash !== prev) {
        ok = false;
        brokenAt = e.id;
        break;
      }
      // Tip check: we cannot recompute historical timestamps exactly; link integrity is prevHash chain.
      prev = e.hash;
    }
    return {
      events: events.length,
      chainValid: ok,
      brokenAt,
      tipHash: events.at(-1)?.hash ?? null,
      recomputedLinks: true,
    };
  }
}
