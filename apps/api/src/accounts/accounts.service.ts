import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { EventBusService } from "../event-bus/event-bus.service";

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly bus: EventBusService,
  ) {}

  mapAccount(a: {
    id: string;
    label: string;
    mask: string;
    type: string;
    balance: { toNumber?: () => number } | number | string;
    heldAmount: { toNumber?: () => number } | number | string;
    currency: string;
    frozen: boolean;
    nickname: string;
  }) {
    const balance = num(a.balance);
    const heldAmount = num(a.heldAmount);
    return {
      id: a.id,
      label: a.label,
      mask: a.mask,
      type: a.type,
      balance,
      heldAmount,
      available: balance - heldAmount,
      currency: a.currency,
      frozen: a.frozen,
      nickname: a.nickname,
    };
  }

  async list(userId: string) {
    const accounts = await this.prisma.account.findMany({ where: { userId } });
    return accounts.map((a) => this.mapAccount(a));
  }

  async detail(userId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new BadRequestException("Account not found");
    const recent = await this.prisma.transaction.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return {
      ...this.mapAccount(account),
      recent: recent.map(mapTxn),
    };
  }

  async dashboard(userId: string) {
    const [accounts, recent, alerts] = await Promise.all([
      this.list(userId),
      this.prisma.transaction.findMany({
        where: { account: { userId } },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      this.prisma.notification.findMany({
        where: { userId, kind: "security", read: false },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
    ]);
    const primary = accounts[0];
    return {
      primary,
      accounts,
      recent: recent.map(mapTxn),
      securityAlerts: alerts,
    };
  }

  async freezeAccount(userId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new BadRequestException("Account not found");
    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: { frozen: true },
    });
    await this.audit.record({
      category: "Security",
      action: "account.frozen",
      actor: userId,
      detail: `Account ${account.mask} frozen by customer`,
    });
    await this.bus.publish({
      type: "security.freeze",
      userId,
      target: "account",
      targetId: accountId,
    });
    return this.mapAccount(updated);
  }

  async unfreezeAccount(userId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new BadRequestException("Account not found");
    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: { frozen: false },
    });
    await this.audit.record({
      category: "Security",
      action: "account.unfrozen",
      actor: userId,
      detail: `Account ${account.mask} unfrozen by customer`,
    });
    return this.mapAccount(updated);
  }

  async updateNickname(userId: string, accountId: string, nickname: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) throw new BadRequestException("Account not found");
    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: { nickname },
    });
    return this.mapAccount(updated);
  }
}

function num(v: { toNumber?: () => number } | number | string) {
  return typeof v === "object" && v && "toNumber" in v && v.toNumber
    ? v.toNumber()
    : Number(v);
}

export function mapTxn(t: {
  id: string;
  reference: string;
  counterparty: string;
  category: string;
  amount: { toNumber?: () => number } | number | string;
  fee: { toNumber?: () => number } | number | string;
  direction: string;
  status: string;
  riskScore: number | null;
  riskReason: string | null;
  note?: string;
  createdAt: Date;
  settledAt: Date | null;
}) {
  return {
    id: t.id,
    reference: t.reference,
    counterparty: t.counterparty,
    category: t.category,
    amount: num(t.amount),
    fee: num(t.fee),
    direction: t.direction,
    status: t.status,
    riskScore: t.riskScore ?? undefined,
    riskReason: t.riskReason ?? undefined,
    note: t.note || undefined,
    createdAt: t.createdAt.toISOString(),
    settledAt: t.settledAt?.toISOString(),
  };
}
