import { createHash, randomUUID } from "crypto";
import { BadRequestException } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

export async function postLedgerEntry(
  tx: TxClient,
  input: {
    accountId: string;
    transactionId?: string;
    direction: "DEBIT" | "CREDIT";
    amount: number;
    memo?: string;
  },
) {
  const account = await tx.account.findUniqueOrThrow({
    where: { id: input.accountId },
  });
  const current = Number(account.balance);
  const next =
    input.direction === "DEBIT"
      ? current - input.amount
      : current + input.amount;

  await tx.account.update({
    where: { id: input.accountId },
    data: { balance: next },
  });

  return tx.ledgerEntry.create({
    data: {
      accountId: input.accountId,
      transactionId: input.transactionId ?? null,
      direction: input.direction,
      amount: input.amount,
      balanceAfter: next,
      memo: input.memo || "",
    },
  });
}

/** Debit customer + credit clearing (double-entry for external money out). */
export async function postOutboundSettlement(
  tx: TxClient,
  input: {
    accountId: string;
    clearingAccountId: string;
    transactionId: string;
    amount: number;
    fee: number;
    releaseHold?: boolean;
  },
) {
  const total = input.amount + input.fee;
  const account = await tx.account.findUniqueOrThrow({
    where: { id: input.accountId },
  });
  if (input.releaseHold) {
    const held = Number(account.heldAmount);
    if (held < total) {
      throw new BadRequestException("Held amount mismatch");
    }
    await tx.account.update({
      where: { id: input.accountId },
      data: { heldAmount: { decrement: total } },
    });
  } else {
    const available = Number(account.balance) - Number(account.heldAmount);
    if (available < total) {
      throw new BadRequestException("Insufficient available balance");
    }
  }

  await postLedgerEntry(tx, {
    accountId: input.accountId,
    transactionId: input.transactionId,
    direction: "DEBIT",
    amount: total,
    memo: "customer.debit",
  });
  await postLedgerEntry(tx, {
    accountId: input.clearingAccountId,
    transactionId: input.transactionId,
    direction: "CREDIT",
    amount: total,
    memo: "clearing.credit",
  });
}

export async function ensureClearingAccount(tx: TxClient) {
  const existing = await tx.account.findFirst({
    where: { mask: "****CLRG", type: "CLEARING" },
  });
  if (existing) return existing;

  let officer = await tx.user.findFirst({ where: { role: "OFFICER" } });
  if (!officer) {
    officer = await tx.user.create({
      data: {
        username: `system.clearing.${randomUUID().slice(0, 8)}`,
        passwordHash: createHash("sha256").update("nopass").digest("hex"),
        fullName: "RESILIA Clearing",
        nationalId: "SYSTEM-CLEARING",
        phoneLast4: "0000",
        role: "SYSTEM",
        kycStatus: "VERIFIED",
      },
    });
  }

  return tx.account.create({
    data: {
      userId: officer.id,
      label: "Settlement clearing",
      mask: "****CLRG",
      type: "CLEARING",
      balance: 0,
      currency: "LKR",
    },
  });
}

export async function withIdempotency<T>(
  prisma: PrismaClient,
  input: {
    key: string | undefined;
    userId: string;
    path: string;
  },
  handler: () => Promise<T>,
): Promise<T> {
  if (!input.key || !input.key.trim()) {
    throw new BadRequestException("Idempotency-Key header is required");
  }
  const key = `${input.userId}:${input.path}:${input.key.trim()}`;
  const existing = await prisma.idempotencyRecord.findUnique({
    where: { key },
  });
  if (existing) {
    return JSON.parse(existing.response) as T;
  }

  const result = await handler();
  try {
    await prisma.idempotencyRecord.create({
      data: {
        key,
        userId: input.userId,
        path: input.path,
        response: JSON.stringify(result),
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      const again = await prisma.idempotencyRecord.findUnique({
        where: { key },
      });
      if (again) return JSON.parse(again.response) as T;
    }
    throw e;
  }
  return result;
}
