import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventBusService } from "../event-bus/event-bus.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class FraudService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBusService,
    private readonly audit: AuditService,
  ) {}

  subscribe() {
    this.bus.on(async (event) => {
      if (event.type === "payment.held") {
        await this.prisma.notification.create({
          data: {
            userId: event.userId,
            channel: "push",
            kind: "security",
            title: "Payment held for review",
            body: `Risk score ${event.riskScore}/100 · ${event.reason}`,
            href: `/payments/${event.transactionId}`,
          },
        });
      }
    });
  }

  async screen(input: {
    transactionId: string;
    userId: string;
    amount: number;
    counterparty: string;
    category: string;
    forceHold?: boolean;
  }) {
    let score = 8;
    const reasons: string[] = [];

    if (input.amount >= 50000) {
      score += 45;
      reasons.push("High amount vs usual pattern");
    } else if (input.amount >= 20000) {
      score += 18;
    }

    const recentOut = await this.prisma.transaction.count({
      where: {
        account: { userId: input.userId },
        direction: "OUT",
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });
    if (recentOut >= 3) {
      score += 25;
      reasons.push("Velocity anomaly");
    }

    const knownPayee = await this.prisma.transaction.findFirst({
      where: {
        account: { userId: input.userId },
        counterparty: input.counterparty,
        status: "SETTLED",
      },
    });
    if (!knownPayee && input.category === "TRANSFER") {
      score += 22;
      reasons.push("New payee");
    }

    if (input.forceHold) {
      score = Math.max(score, 82);
      reasons.push("Demo force-hold");
    }

    const held = score >= 70;
    const reason = reasons.join(" · ") || "Within usual pattern";

    await this.prisma.transaction.update({
      where: { id: input.transactionId },
      data: {
        riskScore: score,
        riskReason: reason,
        status: held ? "HELD" : "PENDING",
      },
    });

    if (held) {
      const txn = await this.prisma.transaction.findUnique({
        where: { id: input.transactionId },
      });
      if (txn) {
        const reserve = Number(txn.amount) + Number(txn.fee);
        await this.prisma.account.update({
          where: { id: txn.accountId },
          data: { heldAmount: { increment: reserve } },
        });
      }
      await this.audit.record({
        category: "Fraud",
        action: "txn.held",
        actor: "fraud-service",
        detail: `${input.transactionId} · score ${score} · ${reason}`,
      });
      await this.bus.publish({
        type: "payment.held",
        transactionId: input.transactionId,
        userId: input.userId,
        riskScore: score,
        reason,
      });
    }

    return { held, riskScore: score, reason };
  }

  async activeHolds() {
    const rows = await this.prisma.transaction.findMany({
      where: { status: "HELD" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { account: { include: { user: true } } },
    });
    return rows.map((t) => ({
      id: t.id,
      reference: t.reference,
      counterparty: t.counterparty,
      amount: Number(t.amount),
      riskScore: t.riskScore,
      riskReason: t.riskReason,
      customer: t.account.user.fullName,
      createdAt: t.createdAt.toISOString(),
    }));
  }
}
