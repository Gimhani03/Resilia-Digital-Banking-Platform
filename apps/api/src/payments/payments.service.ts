import {
  BadRequestException,
  Inject,
  Injectable,
  forwardRef,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EventBusService } from "../event-bus/event-bus.service";
import { AuditService } from "../audit/audit.service";
import { FraudService } from "../fraud/fraud.service";
import { IdentityService } from "../identity/identity.service";
import { FeeConfig } from "../config/fee.config";
import { mapTxn } from "../accounts/accounts.service";
import {
  ensureClearingAccount,
  postLedgerEntry,
  postOutboundSettlement,
  withIdempotency,
} from "./ledger";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBusService,
    private readonly audit: AuditService,
    @Inject(forwardRef(() => FraudService))
    private readonly fraud: FraudService,
    private readonly identity: IdentityService,
    private readonly fees: FeeConfig,
  ) {}

  private available(account: { balance: unknown; heldAmount: unknown }) {
    return Number(account.balance) - Number(account.heldAmount);
  }

  async history(
    userId: string,
    query: {
      category?: string;
      q?: string;
      from?: string;
      to?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.TransactionWhereInput = {
      account: { userId },
    };
    if (query.category && query.category !== "All") {
      where.category = query.category;
    }
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }
    if (query.q) {
      where.OR = [
        { counterparty: { contains: query.q } },
        { reference: { contains: query.q } },
        { note: { contains: query.q } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items: rows.map(mapTxn),
      total,
      page,
      pageSize,
    };
  }

  async statement(userId: string, accountId: string, from?: string, to?: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new BadRequestException("Account not found");

    const where: Prisma.TransactionWhereInput = { accountId };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const rows = await this.prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });

    const items = rows.map(mapTxn);
    const credits = items
      .filter((t) => t.direction === "IN" && t.status === "SETTLED")
      .reduce((s, t) => s + t.amount, 0);
    const debits = items
      .filter((t) => t.direction === "OUT" && t.status === "SETTLED")
      .reduce((s, t) => s + t.amount + (t.fee ?? 0), 0);

    return {
      accountId,
      mask: account.mask,
      from: from ?? null,
      to: to ?? null,
      openingNote: "Balances as of statement window",
      credits,
      debits,
      net: credits - debits,
      items,
    };
  }

  async getOne(userId: string, id: string) {
    const txn = await this.prisma.transaction.findFirst({
      where: { id, account: { userId } },
    });
    if (!txn) throw new BadRequestException("Transaction not found");
    return mapTxn(txn);
  }

  async listPayees(userId: string) {
    const rows = await this.prisma.beneficiary.findMany({
      where: { userId },
      orderBy: [{ favorite: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(mapBeneficiary);
  }

  async createPayee(
    userId: string,
    input: {
      name: string;
      bankName: string;
      accountNumber: string;
      nickname?: string;
      favorite?: boolean;
    },
  ) {
    const last4 = input.accountNumber.slice(-4);
    const row = await this.prisma.beneficiary.create({
      data: {
        userId,
        name: input.name,
        bankName: input.bankName,
        accountNumber: input.accountNumber,
        accountMask: `****${last4}`,
        nickname: input.nickname || "",
        favorite: input.favorite ?? false,
      },
    });
    return mapBeneficiary(row);
  }

  async updatePayee(
    userId: string,
    id: string,
    input: {
      name?: string;
      bankName?: string;
      accountNumber?: string;
      nickname?: string;
      favorite?: boolean;
    },
  ) {
    const existing = await this.prisma.beneficiary.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new BadRequestException("Payee not found");
    const data: Prisma.BeneficiaryUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.bankName !== undefined) data.bankName = input.bankName;
    if (input.nickname !== undefined) data.nickname = input.nickname;
    if (input.favorite !== undefined) data.favorite = input.favorite;
    if (input.accountNumber !== undefined) {
      data.accountNumber = input.accountNumber;
      data.accountMask = `****${input.accountNumber.slice(-4)}`;
    }
    const row = await this.prisma.beneficiary.update({
      where: { id },
      data,
    });
    return mapBeneficiary(row);
  }

  async deletePayee(userId: string, id: string) {
    const existing = await this.prisma.beneficiary.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new BadRequestException("Payee not found");
    await this.prisma.beneficiary.delete({ where: { id } });
    return { ok: true };
  }

  async listBillers() {
    const rows = await this.prisma.biller.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
    return rows.map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      category: b.category,
      accountHint: b.accountHint,
      minAmount: b.minAmount,
      maxAmount: b.maxAmount,
    }));
  }

  async initiateTransfer(
    userId: string,
    input: {
      accountId: string;
      counterparty: string;
      amount: number;
      beneficiaryId?: string;
      note?: string;
      mfaChallengeId: string;
      forceHold?: boolean;
      idempotencyKey?: string;
    },
  ) {
    return withIdempotency(
      this.prisma,
      {
        key: input.idempotencyKey,
        userId,
        path: "payments.transfer",
      },
      async () => {
        await this.identity.requireKycVerified(userId);
        await this.identity.consumeStepUp(
          userId,
          input.mfaChallengeId,
          "TRANSFER",
        );

        const account = await this.prisma.account.findFirst({
          where: { id: input.accountId, userId },
        });
        if (!account) throw new BadRequestException("Account not found");
        if (account.frozen) throw new BadRequestException("Account is frozen");

        let counterparty = input.counterparty;
        let beneficiaryId = input.beneficiaryId;
        if (beneficiaryId) {
          const bene = await this.prisma.beneficiary.findFirst({
            where: { id: beneficiaryId, userId },
          });
          if (!bene) throw new BadRequestException("Beneficiary not found");
          counterparty = bene.nickname || bene.name;
          beneficiaryId = bene.id;
        }

        const fee = this.fees.transfer(input.amount);
        if (this.available(account) < input.amount + fee) {
          throw new BadRequestException("Insufficient available balance");
        }

        const reference = `TRF-${Date.now().toString(36).toUpperCase()}`;
        const txn = await this.prisma.transaction.create({
          data: {
            accountId: account.id,
            reference,
            counterparty,
            category: "TRANSFER",
            amount: input.amount,
            fee,
            direction: "OUT",
            status: "SCREENING",
            note: input.note || "",
            beneficiaryId: beneficiaryId ?? null,
            idempotencyKey: input.idempotencyKey || null,
          },
        });

        await this.bus.publish({
          type: "payment.initiated",
          transactionId: txn.id,
          userId,
          amount: input.amount,
          counterparty,
          category: "TRANSFER",
        });

        const screening = await this.fraud.screen({
          transactionId: txn.id,
          userId,
          amount: input.amount,
          counterparty,
          category: "TRANSFER",
          forceHold: input.forceHold === true ? true : undefined,
        });

        if (screening.held) {
          return {
            ...mapTxn(
              await this.prisma.transaction.findUniqueOrThrow({
                where: { id: txn.id },
              }),
            ),
            screening,
          };
        }

        return this.settle(userId, txn.id);
      },
    );
  }

  async payBill(
    userId: string,
    input: {
      accountId: string;
      biller: string;
      amount: number;
      method: "BILL" | "QR";
      billerCode?: string;
      accountRef?: string;
      mfaChallengeId: string;
      forceHold?: boolean;
      idempotencyKey?: string;
    },
  ) {
    return withIdempotency(
      this.prisma,
      { key: input.idempotencyKey, userId, path: "payments.bill" },
      async () => {
        await this.identity.requireKycVerified(userId);
        await this.identity.consumeStepUp(userId, input.mfaChallengeId, "BILL");

        const account = await this.prisma.account.findFirst({
          where: { id: input.accountId, userId },
        });
        if (!account) throw new BadRequestException("Account not found");
        if (account.frozen) throw new BadRequestException("Account is frozen");
        if (this.available(account) < input.amount) {
          throw new BadRequestException("Insufficient available balance");
        }

        let counterparty = input.biller;
        let billerCode = input.billerCode;
        if (billerCode) {
          const biller = await this.prisma.biller.findUnique({
            where: { code: billerCode },
          });
          if (!biller || !biller.active) {
            throw new BadRequestException("Biller not found");
          }
          if (
            input.amount < biller.minAmount ||
            input.amount > biller.maxAmount
          ) {
            throw new BadRequestException(
              `Amount must be between ${biller.minAmount} and ${biller.maxAmount}`,
            );
          }
          counterparty = biller.name;
        }

        const note = input.accountRef ? `Ref ${input.accountRef}` : "";

        const reference = `${input.method}-${Date.now().toString(36).toUpperCase()}`;
        const txn = await this.prisma.transaction.create({
          data: {
            accountId: account.id,
            reference,
            counterparty,
            category: input.method === "QR" ? "MERCHANT" : "UTILITIES",
            amount: input.amount,
            fee: 0,
            direction: "OUT",
            status: "SCREENING",
            note,
            billerCode: billerCode ?? null,
            idempotencyKey: input.idempotencyKey || null,
          },
        });

        await this.bus.publish({
          type: "payment.initiated",
          transactionId: txn.id,
          userId,
          amount: input.amount,
          counterparty,
          category: txn.category,
        });

        const screening = await this.fraud.screen({
          transactionId: txn.id,
          userId,
          amount: input.amount,
          counterparty,
          category: txn.category,
          forceHold: input.forceHold === true ? true : undefined,
        });

        if (screening.held) {
          return {
            ...mapTxn(
              await this.prisma.transaction.findUniqueOrThrow({
                where: { id: txn.id },
              }),
            ),
            screening,
          };
        }

        return this.settle(userId, txn.id);
      },
    );
  }

  async internalTransfer(
    userId: string,
    input: {
      fromAccountId: string;
      toAccountId: string;
      amount: number;
      note?: string;
      mfaChallengeId: string;
      idempotencyKey?: string;
    },
  ) {
    return withIdempotency(
      this.prisma,
      { key: input.idempotencyKey, userId, path: "payments.internal" },
      async () => {
        await this.identity.requireKycVerified(userId);
        await this.identity.consumeStepUp(
          userId,
          input.mfaChallengeId,
          "TRANSFER",
        );

        if (input.fromAccountId === input.toAccountId) {
          throw new BadRequestException("Accounts must differ");
        }
        const from = await this.prisma.account.findFirst({
          where: { id: input.fromAccountId, userId },
        });
        const to = await this.prisma.account.findFirst({
          where: { id: input.toAccountId, userId },
        });
        if (!from || !to) throw new BadRequestException("Account not found");
        if (from.frozen || to.frozen) {
          throw new BadRequestException("Account is frozen");
        }
        if (this.available(from) < input.amount) {
          throw new BadRequestException("Insufficient available balance");
        }

        const stamp = Date.now().toString(36).toUpperCase();
        const note = input.note || "Internal transfer";

        const outTxn = await this.prisma.$transaction(async (tx) => {
          const out = await tx.transaction.create({
            data: {
              accountId: from.id,
              reference: `INT-OUT-${stamp}`,
              counterparty: to.label,
              category: "TRANSFER",
              amount: input.amount,
              fee: 0,
              direction: "OUT",
              status: "SETTLED",
              note,
              settledAt: new Date(),
              idempotencyKey: input.idempotencyKey || null,
            },
          });
          const inn = await tx.transaction.create({
            data: {
              accountId: to.id,
              reference: `INT-IN-${stamp}`,
              counterparty: from.label,
              category: "TRANSFER",
              amount: input.amount,
              fee: 0,
              direction: "IN",
              status: "SETTLED",
              note,
              settledAt: new Date(),
            },
          });
          await postLedgerEntry(tx, {
            accountId: from.id,
            transactionId: out.id,
            direction: "DEBIT",
            amount: input.amount,
            memo: "internal.out",
          });
          await postLedgerEntry(tx, {
            accountId: to.id,
            transactionId: inn.id,
            direction: "CREDIT",
            amount: input.amount,
            memo: "internal.in",
          });
          return out;
        });

        await this.audit.record({
          category: "Payments",
          action: "payment.internal",
          actor: userId,
          detail: `${from.mask} → ${to.mask} · LKR ${input.amount}`,
        });

        return mapTxn(outTxn);
      },
    );
  }

  async settle(userId: string, transactionId: string) {
    const txn = await this.prisma.transaction.findFirst({
      where: { id: transactionId, account: { userId } },
      include: { account: true },
    });
    if (!txn) throw new BadRequestException("Transaction not found");
    if (txn.status === "SETTLED") return mapTxn(txn);
    if (!["SCREENING", "HELD", "PENDING"].includes(txn.status)) {
      throw new BadRequestException(`Cannot settle status ${txn.status}`);
    }

    const total = Number(txn.amount) + Number(txn.fee);
    const wasHeld = txn.status === "HELD";

    await this.prisma.$transaction(async (tx) => {
      const clearing = await ensureClearingAccount(tx);
      await postOutboundSettlement(tx, {
        accountId: txn.accountId,
        clearingAccountId: clearing.id,
        transactionId: txn.id,
        amount: Number(txn.amount),
        fee: Number(txn.fee),
        releaseHold: wasHeld,
      });
      await tx.transaction.update({
        where: { id: txn.id },
        data: { status: "SETTLED", settledAt: new Date() },
      });
    });

    await this.audit.record({
      category: "Payments",
      action: "payment.settled",
      actor: userId,
      detail: `${txn.reference} · ${txn.counterparty} · LKR ${total}`,
    });

    await this.bus.publish({
      type: "payment.settled",
      transactionId: txn.id,
      userId,
      amount: Number(txn.amount),
    });

    return mapTxn(
      await this.prisma.transaction.findUniqueOrThrow({
        where: { id: txn.id },
      }),
    );
  }

  async releaseHeld(
    userId: string,
    transactionId: string,
    mfaChallengeId: string,
    idempotencyKey?: string,
  ) {
    return withIdempotency(
      this.prisma,
      { key: idempotencyKey, userId, path: `payments.release.${transactionId}` },
      async () => {
        await this.identity.consumeStepUp(userId, mfaChallengeId, "RELEASE");
        const txn = await this.prisma.transaction.findFirst({
          where: { id: transactionId, account: { userId }, status: "HELD" },
        });
        if (!txn) throw new BadRequestException("Held transaction not found");
        await this.audit.record({
          category: "Fraud",
          action: "hold.released",
          actor: userId,
          detail: `${txn.reference} released with MFA`,
        });
        return this.settle(userId, transactionId);
      },
    );
  }

  async rejectHeld(userId: string, transactionId: string, freezeCard?: boolean) {
    const txn = await this.prisma.transaction.findFirst({
      where: { id: transactionId, account: { userId }, status: "HELD" },
    });
    if (!txn) throw new BadRequestException("Held transaction not found");

    const total = Number(txn.amount) + Number(txn.fee);

    await this.prisma.$transaction([
      this.prisma.transaction.update({
        where: { id: txn.id },
        data: { status: "REJECTED" },
      }),
      this.prisma.account.update({
        where: { id: txn.accountId },
        data: { heldAmount: { decrement: total } },
      }),
    ]);

    if (freezeCard) {
      const card = await this.prisma.card.findFirst({ where: { userId } });
      if (card) {
        await this.prisma.card.update({
          where: { id: card.id },
          data: { frozen: true },
        });
      }
    }

    await this.audit.record({
      category: "Fraud",
      action: "hold.rejected",
      actor: userId,
      detail: `${txn.reference} rejected${freezeCard ? " · card frozen" : ""}`,
    });

    await this.bus.publish({
      type: "payment.rejected",
      transactionId: txn.id,
      userId,
      reason: txn.riskReason || "Customer rejected",
    });

    return mapTxn(
      await this.prisma.transaction.findUniqueOrThrow({
        where: { id: txn.id },
      }),
    );
  }

  async listDisputes(userId: string) {
    const rows = await this.prisma.dispute.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapDispute);
  }

  async getDispute(userId: string, id: string) {
    const row = await this.prisma.dispute.findFirst({
      where: { id, userId },
    });
    if (!row) throw new BadRequestException("Dispute not found");
    return mapDispute(row);
  }

  async raiseDispute(
    userId: string,
    input: { transactionId?: string; reason: string },
  ) {
    if (input.transactionId) {
      const txn = await this.prisma.transaction.findFirst({
        where: { id: input.transactionId, account: { userId } },
      });
      if (!txn) throw new BadRequestException("Transaction not found");
    }
    const dispute = await this.prisma.dispute.create({
      data: {
        userId,
        transactionId: input.transactionId,
        reason: input.reason,
      },
    });
    await this.audit.record({
      category: "Security",
      action: "dispute.raised",
      actor: userId,
      detail: input.reason,
    });
    return mapDispute(dispute);
  }
}

function mapBeneficiary(b: {
  id: string;
  name: string;
  bankName: string;
  accountMask: string;
  accountNumber: string;
  nickname: string;
  favorite: boolean;
  createdAt: Date;
}) {
  return {
    id: b.id,
    name: b.name,
    bankName: b.bankName,
    accountMask: b.accountMask,
    accountNumber: b.accountNumber,
    nickname: b.nickname,
    favorite: b.favorite,
    createdAt: b.createdAt.toISOString(),
  };
}

function mapDispute(d: {
  id: string;
  transactionId: string | null;
  reason: string;
  status: string;
  resolution: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: d.id,
    transactionId: d.transactionId ?? undefined,
    reason: d.reason,
    status: d.status,
    resolution: d.resolution || undefined,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}
