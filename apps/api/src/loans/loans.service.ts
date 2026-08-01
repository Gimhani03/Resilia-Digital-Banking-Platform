import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventBusService } from "../event-bus/event-bus.service";
import { AuditService } from "../audit/audit.service";
import { postLedgerEntry } from "../payments/ledger";

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBusService,
    private readonly audit: AuditService,
  ) {}

  estimate(amount: number, tenureMonths: number, income: number) {
    const instalment = Number(((amount * 1.12) / tenureMonths).toFixed(2));
    const dti = income > 0 ? instalment / income : 1;
    let score = 92;
    if (dti > 0.4) score -= 25;
    if (dti > 0.55) score -= 20;
    if (amount > 1000000) score -= 10;
    score = Math.max(20, Math.min(99, score));
    return {
      eligibilityScore: score,
      dti: Number(dti.toFixed(2)),
      instalment,
      aiRecommendation:
        score >= 70
          ? "Likely approve · within policy band"
          : "Manual review recommended · elevated DTI",
      fraudFlags: score < 50 ? ["Income inconsistency"] : [],
    };
  }

  async apply(
    userId: string,
    input: {
      product: "PERSONAL" | "BUSINESS" | "WORKING_CAPITAL";
      amount: number;
      tenureMonths: number;
      purpose: string;
      monthlyIncome: number;
    },
  ) {
    const est = this.estimate(
      input.amount,
      input.tenureMonths,
      input.monthlyIncome,
    );
    const loan = await this.prisma.loanApplication.create({
      data: {
        userId,
        product: input.product,
        amount: input.amount,
        tenureMonths: input.tenureMonths,
        purpose: input.purpose,
        monthlyIncome: input.monthlyIncome,
        status: "SUBMITTED",
        eligibilityScore: est.eligibilityScore,
        dti: est.dti,
        fraudFlags: JSON.stringify(est.fraudFlags),
        aiRecommendation: est.aiRecommendation,
        instalment: est.instalment,
      },
      include: { user: true },
    });

    await this.audit.record({
      category: "Admin",
      action: "loan.submitted",
      actor: userId,
      detail: `${loan.product} LKR ${input.amount} · score ${est.eligibilityScore}`,
    });

    await this.bus.publish({
      type: "loan.submitted",
      loanId: loan.id,
      userId,
      amount: input.amount,
    });

    return this.map(loan);
  }

  async listForUser(userId: string) {
    const rows = await this.prisma.loanApplication.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { user: true },
    });
    return rows.map((l) => this.map(l));
  }

  async getOne(userId: string, id: string) {
    const loan = await this.prisma.loanApplication.findFirst({
      where: { id, userId },
      include: { user: true },
    });
    if (!loan) throw new BadRequestException("Loan not found");
    return this.map(loan);
  }

  async queue() {
    const rows = await this.prisma.loanApplication.findMany({
      where: { status: "SUBMITTED" },
      orderBy: { createdAt: "asc" },
      include: { user: true },
    });
    return rows.map((l) => this.map(l));
  }

  async decide(
    loanId: string,
    status: "APPROVED" | "REJECTED",
    actor: string,
  ) {
    const loan = await this.prisma.loanApplication.findUnique({
      where: { id: loanId },
      include: { user: true },
    });
    if (!loan) throw new BadRequestException("Loan not found");
    if (loan.status !== "SUBMITTED") {
      throw new BadRequestException("Already decided");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.loanApplication.update({
        where: { id: loanId },
        data: { status, decidedAt: new Date() },
        include: { user: true },
      });

      if (status === "APPROVED") {
        const account = await tx.account.findFirst({
          where: {
            userId: loan.userId,
            frozen: false,
            type: { not: "CLEARING" },
          },
          orderBy: { createdAt: "asc" },
        });
        if (!account) {
          throw new BadRequestException("No disbursement account");
        }
        const amount = Number(loan.amount);
        const stamp = Date.now().toString(36).toUpperCase();
        const txn = await tx.transaction.create({
          data: {
            accountId: account.id,
            reference: `LOAN-${stamp}`,
            counterparty: "RESILIA Loan Disbursement",
            category: "LOAN",
            amount,
            fee: 0,
            direction: "IN",
            status: "SETTLED",
            note: `Loan ${loan.id.slice(-6)} disbursed`,
            settledAt: new Date(),
          },
        });
        await postLedgerEntry(tx, {
          accountId: account.id,
          transactionId: txn.id,
          direction: "CREDIT",
          amount,
          memo: "loan.disburse",
        });
      }

      return row;
    });

    await this.audit.record({
      category: "Admin",
      action: `loan.${status.toLowerCase()}`,
      actor,
      detail: `${loan.user.fullName} · LKR ${Number(loan.amount)}${
        status === "APPROVED" ? " · disbursed" : ""
      }`,
    });
    await this.bus.publish({
      type: "loan.decided",
      loanId,
      status,
      actor,
    });
    return this.map(updated);
  }

  private map(loan: {
    id: string;
    product: string;
    amount: { toNumber?: () => number } | number;
    tenureMonths: number;
    purpose: string;
    monthlyIncome?: { toNumber?: () => number } | number;
    status: string;
    eligibilityScore: number;
    dti: number;
    fraudFlags: string[] | string;
    aiRecommendation: string;
    instalment?: { toNumber?: () => number } | number;
    createdAt: Date;
    decidedAt?: Date | null;
    user?: { fullName: string };
  }) {
    const amount =
      typeof loan.amount === "object" && loan.amount?.toNumber
        ? loan.amount.toNumber()
        : Number(loan.amount);
    const instalment =
      typeof loan.instalment === "object" && loan.instalment?.toNumber
        ? loan.instalment.toNumber()
        : Number(loan.instalment ?? 0);
    const monthlyIncome =
      typeof loan.monthlyIncome === "object" && loan.monthlyIncome?.toNumber
        ? loan.monthlyIncome.toNumber()
        : Number(loan.monthlyIncome ?? 0);
    const flags =
      typeof loan.fraudFlags === "string"
        ? (JSON.parse(loan.fraudFlags || "[]") as string[])
        : loan.fraudFlags;
    return {
      id: loan.id,
      product: loan.product,
      amount,
      tenureMonths: loan.tenureMonths,
      purpose: loan.purpose,
      monthlyIncome,
      status: loan.status,
      eligibilityScore: loan.eligibilityScore,
      dti: loan.dti,
      fraudFlags: flags,
      aiRecommendation: loan.aiRecommendation,
      instalment,
      applicantName: loan.user?.fullName ?? "",
      createdAt: loan.createdAt.toISOString(),
      decidedAt: loan.decidedAt?.toISOString(),
    };
  }
}
