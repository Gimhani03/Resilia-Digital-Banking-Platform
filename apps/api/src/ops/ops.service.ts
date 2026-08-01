import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { EventBusService } from "../event-bus/event-bus.service";
import { postLedgerEntry } from "../payments/ledger";

@Injectable()
export class OpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly bus: EventBusService,
  ) {}

  async overview() {
    const holds = await this.prisma.transaction.count({
      where: { status: "HELD" },
    });
    const high = await this.prisma.transaction.count({
      where: { status: "HELD", riskScore: { gte: 80 } },
    });
    const openDisputes = await this.prisma.dispute.count({
      where: { status: "OPEN" },
    });

    return {
      uptime: "99.98%",
      txnPerMin: 4812,
      activeFraudHolds: holds,
      highPriorityHolds: high,
      openDisputes,
      drReady: true,
      rpoMinutes: 2,
      rtoMinutes: 11,
      services: [
        { name: "Identity & Auth", latencyMs: 42, status: "Healthy" },
        { name: "Accounts", latencyMs: 38, status: "Healthy" },
        { name: "Payments / Transfers", latencyMs: 51, status: "Healthy" },
        { name: "Loans & Credit", latencyMs: 67, status: "Healthy" },
        { name: "Fraud & Risk", latencyMs: 29, status: "Healthy" },
        { name: "Audit & Compliance", latencyMs: 44, status: "Degraded" },
        { name: "Notification", latencyMs: 33, status: "Healthy" },
        { name: "HSM / Master Key vault", latencyMs: null, status: "Sealed" },
      ],
      alerts: [
        {
          severity: "HIGH" as const,
          title: "Velocity anomaly · merchant QR",
          detail: "Txn frozen pre-settlement · awaiting analyst",
        },
        {
          severity: "HIGH" as const,
          title: "Impossible travel login",
          detail: "Step-up MFA forced · device not trusted",
        },
        {
          severity: "MED" as const,
          title: "Loan app spam pattern",
          detail: "Rate-limited at API Gateway",
        },
        {
          severity: "MED" as const,
          title: "USSD channel spike",
          detail: "Within capacity · monitoring",
        },
        ...(openDisputes > 0
          ? [
              {
                severity: "MED" as const,
                title: `${openDisputes} open customer dispute${openDisputes === 1 ? "" : "s"}`,
                detail: "Awaiting officer review in Disputes queue",
              },
            ]
          : []),
      ],
    };
  }

  async listDisputes(status?: string) {
    const where =
      status && status !== "ALL"
        ? { status: status.toUpperCase() }
        : undefined;
    const rows = await this.prisma.dispute.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        user: true,
        transaction: { include: { account: true } },
      },
    });
    return rows.map((d) => this.mapDispute(d));
  }

  async getDispute(id: string) {
    const row = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        user: true,
        transaction: { include: { account: true } },
      },
    });
    if (!row) throw new BadRequestException("Dispute not found");

    const [accounts, cards] = await Promise.all([
      this.prisma.account.findMany({
        where: { userId: row.userId, type: { not: "CLEARING" } },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.card.findMany({ where: { userId: row.userId } }),
    ]);

    return {
      ...this.mapDispute(row),
      accounts: accounts.map((a) => ({
        id: a.id,
        label: a.label,
        nickname: a.nickname,
        mask: a.mask,
        type: a.type,
        balance: Number(a.balance),
        frozen: a.frozen,
      })),
      cards: cards.map((c) => ({
        id: c.id,
        label: c.label,
        mask: c.mask,
        type: c.type,
        frozen: c.frozen,
      })),
    };
  }

  async decide(
    id: string,
    input: {
      status: "RESOLVED" | "REJECTED";
      resolution: string;
      refund?: boolean;
    },
    actor: string,
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        user: true,
        transaction: { include: { account: true } },
      },
    });
    if (!dispute) throw new BadRequestException("Dispute not found");
    if (dispute.status !== "OPEN") {
      throw new BadRequestException("Dispute already decided");
    }

    const resolution = (input.resolution || "").trim();
    if (!resolution) {
      throw new BadRequestException("Resolution note is required");
    }
    if (input.status !== "RESOLVED" && input.status !== "REJECTED") {
      throw new BadRequestException("Invalid status");
    }

    const wantRefund = !!input.refund && input.status === "RESOLVED";
    if (wantRefund && !dispute.transaction) {
      throw new BadRequestException(
        "Cannot refund without a linked transaction",
      );
    }
    if (
      wantRefund &&
      dispute.transaction &&
      (dispute.transaction.status !== "SETTLED" ||
        dispute.transaction.direction !== "OUT")
    ) {
      throw new BadRequestException(
        "Refund only allowed for settled outbound transactions",
      );
    }

    let refunded = false;
    let refundTxnId: string | null = null;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (wantRefund && dispute.transaction) {
        const amount = Number(dispute.transaction.amount);
        const fee = Number(dispute.transaction.fee);
        const credit = amount + fee;
        const stamp = Date.now().toString(36).toUpperCase();
        const refundTxn = await tx.transaction.create({
          data: {
            accountId: dispute.transaction.accountId,
            reference: `DSP-REF-${stamp}`,
            counterparty: "RESILIA Dispute Refund",
            category: "DISPUTE_REFUND",
            amount: credit,
            fee: 0,
            direction: "IN",
            status: "SETTLED",
            note: `Refund for dispute ${dispute.id.slice(-6)} · ${dispute.transaction.reference}`,
            settledAt: new Date(),
          },
        });
        await postLedgerEntry(tx, {
          accountId: dispute.transaction.accountId,
          transactionId: refundTxn.id,
          direction: "CREDIT",
          amount: credit,
          memo: "dispute.refund",
        });
        await tx.transaction.update({
          where: { id: dispute.transaction.id },
          data: {
            note: [
              dispute.transaction.note,
              `Reversed via dispute ${dispute.id.slice(-6)}`,
            ]
              .filter(Boolean)
              .join(" · "),
            status: "REVERSED",
          },
        });
        refunded = true;
        refundTxnId = refundTxn.id;
      }

      return tx.dispute.update({
        where: { id },
        data: {
          status: input.status,
          resolution,
        },
        include: {
          user: true,
          transaction: { include: { account: true } },
        },
      });
    });

    await this.audit.record({
      category: "Security",
      action:
        input.status === "RESOLVED"
          ? "dispute.resolved"
          : "dispute.rejected",
      actor,
      detail: `${dispute.user.fullName} · ${resolution}${
        refunded ? " · refund credited" : ""
      }`,
    });

    await this.bus.publish({
      type: "dispute.decided",
      disputeId: id,
      userId: dispute.userId,
      status: input.status,
      refunded,
      resolution,
      actor,
    });

    return {
      ...this.mapDispute(updated),
      refunded,
      refundTxnId: refundTxnId ?? undefined,
    };
  }

  async freezeFromDispute(
    id: string,
    input: { target: "card" | "account"; targetId: string },
    actor: string,
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!dispute) throw new BadRequestException("Dispute not found");

    if (input.target === "card") {
      const card = await this.prisma.card.findFirst({
        where: { id: input.targetId, userId: dispute.userId },
      });
      if (!card) throw new BadRequestException("Card not found for customer");
      const updated = await this.prisma.card.update({
        where: { id: card.id },
        data: { frozen: true },
      });
      await this.audit.record({
        category: "Security",
        action: "card.frozen",
        actor,
        detail: `Card ${card.mask} frozen by officer from dispute ${dispute.id.slice(-6)}`,
      });
      await this.bus.publish({
        type: "security.freeze",
        userId: dispute.userId,
        target: "card",
        targetId: card.id,
      });
      return { target: "card" as const, id: updated.id, frozen: true };
    }

    const account = await this.prisma.account.findFirst({
      where: {
        id: input.targetId,
        userId: dispute.userId,
        type: { not: "CLEARING" },
      },
    });
    if (!account) {
      throw new BadRequestException("Account not found for customer");
    }
    const updated = await this.prisma.account.update({
      where: { id: account.id },
      data: { frozen: true },
    });
    await this.audit.record({
      category: "Security",
      action: "account.frozen",
      actor,
      detail: `Account ${account.mask} frozen by officer from dispute ${dispute.id.slice(-6)}`,
    });
    await this.bus.publish({
      type: "security.freeze",
      userId: dispute.userId,
      target: "account",
      targetId: account.id,
    });
    return { target: "account" as const, id: updated.id, frozen: true };
  }

  private mapDispute(d: {
    id: string;
    userId: string;
    transactionId: string | null;
    reason: string;
    status: string;
    resolution: string;
    createdAt: Date;
    updatedAt: Date;
    user?: {
      id: string;
      fullName: string;
      email: string;
      phone: string;
      nationalId: string;
    };
    transaction?: {
      id: string;
      reference: string;
      counterparty: string;
      category: string;
      amount: { toNumber?: () => number } | number;
      fee: { toNumber?: () => number } | number;
      direction: string;
      status: string;
      note: string;
      createdAt: Date;
      settledAt: Date | null;
      account?: {
        id: string;
        mask: string;
        label: string;
        nickname: string;
      };
    } | null;
  }) {
    const amount = d.transaction
      ? typeof d.transaction.amount === "object" &&
        d.transaction.amount &&
        "toNumber" in d.transaction.amount
        ? d.transaction.amount.toNumber!()
        : Number(d.transaction.amount)
      : undefined;
    const fee = d.transaction
      ? typeof d.transaction.fee === "object" &&
        d.transaction.fee &&
        "toNumber" in d.transaction.fee
        ? d.transaction.fee.toNumber!()
        : Number(d.transaction.fee)
      : undefined;

    return {
      id: d.id,
      userId: d.userId,
      transactionId: d.transactionId ?? undefined,
      reason: d.reason,
      status: d.status,
      resolution: d.resolution || undefined,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      customer: d.user
        ? {
            id: d.user.id,
            fullName: d.user.fullName,
            email: d.user.email,
            phone: d.user.phone,
            nic: d.user.nationalId,
          }
        : undefined,
      transaction: d.transaction
        ? {
            id: d.transaction.id,
            reference: d.transaction.reference,
            counterparty: d.transaction.counterparty,
            category: d.transaction.category,
            amount: amount!,
            fee: fee!,
            direction: d.transaction.direction,
            status: d.transaction.status,
            note: d.transaction.note,
            createdAt: d.transaction.createdAt.toISOString(),
            settledAt: d.transaction.settledAt?.toISOString(),
            account: d.transaction.account
              ? {
                  id: d.transaction.account.id,
                  mask: d.transaction.account.mask,
                  label: d.transaction.account.label,
                  nickname: d.transaction.account.nickname,
                }
              : undefined,
          }
        : undefined,
    };
  }
}
