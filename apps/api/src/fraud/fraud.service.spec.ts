import { FraudService } from "./fraud.service";

/**
 * Unit tests for the fraud scoring rules.
 *
 * These pin the scoring arithmetic and the 70-point hold threshold, which is
 * the only place in the platform where a customer payment is stopped. Prisma,
 * the event bus and the audit log are stubbed — the subject under test is the
 * rule set, not persistence.
 */

type Stub = ReturnType<typeof buildStubs>;

function buildStubs(opts: {
  recentOutbound?: number;
  knownPayee?: boolean;
  amount?: number;
  fee?: number;
} = {}) {
  const updates: any[] = [];
  const published: any[] = [];
  const audited: any[] = [];

  const prisma = {
    transaction: {
      count: jest.fn().mockResolvedValue(opts.recentOutbound ?? 0),
      findFirst: jest.fn().mockResolvedValue(opts.knownPayee ? { id: "known" } : null),
      findUnique: jest.fn().mockResolvedValue({
        id: "txn-1",
        accountId: "acc-1",
        amount: opts.amount ?? 1000,
        fee: opts.fee ?? 0,
      }),
      update: jest.fn().mockImplementation(async (args: any) => {
        updates.push(args);
        return args;
      }),
    },
    account: { update: jest.fn().mockResolvedValue({}) },
    notification: { create: jest.fn().mockResolvedValue({}) },
  };

  const bus = {
    publish: jest.fn().mockImplementation(async (e: any) => published.push(e)),
    on: jest.fn(),
  };

  const audit = {
    record: jest.fn().mockImplementation(async (e: any) => audited.push(e)),
  };

  const service = new FraudService(prisma as any, bus as any, audit as any);
  return { service, prisma, bus, audit, updates, published, audited };
}

function screen(stubs: Stub, overrides: Partial<Parameters<FraudService["screen"]>[0]> = {}) {
  return stubs.service.screen({
    transactionId: "txn-1",
    userId: "user-1",
    amount: 1000,
    counterparty: "Nimal Silva",
    category: "TRANSFER",
    ...overrides,
  });
}

describe("FraudService.screen — amount thresholds", () => {
  it("scores a routine payment to a known payee below the hold threshold", async () => {
    const stubs = buildStubs({ knownPayee: true });
    const result = await screen(stubs, { amount: 1000 });

    // Baseline 8, no rule fires.
    expect(result.riskScore).toBe(8);
    expect(result.held).toBe(false);
    expect(result.reason).toBe("Within usual pattern");
  });

  it("adds 18 points in the 20k–50k band without holding on its own", async () => {
    const stubs = buildStubs({ knownPayee: true });
    const result = await screen(stubs, { amount: 20000 });

    expect(result.riskScore).toBe(26); // 8 + 18
    expect(result.held).toBe(false);
  });

  it("adds 45 points at or above 50k and flags the amount as the reason", async () => {
    const stubs = buildStubs({ knownPayee: true });
    const result = await screen(stubs, { amount: 50000 });

    expect(result.riskScore).toBe(53); // 8 + 45
    expect(result.reason).toContain("High amount vs usual pattern");
    // 53 is still under 70 — a large payment to a trusted payee is not, by
    // itself, enough to stop the transaction.
    expect(result.held).toBe(false);
  });
});

describe("FraudService.screen — velocity and new-payee rules", () => {
  it("adds 25 points once three or more outbound payments land within the hour", async () => {
    const stubs = buildStubs({ knownPayee: true, recentOutbound: 3 });
    const result = await screen(stubs, { amount: 1000 });

    expect(result.riskScore).toBe(33); // 8 + 25
    expect(result.reason).toContain("Velocity anomaly");
  });

  it("adds 22 points for a first-time transfer payee", async () => {
    const stubs = buildStubs({ knownPayee: false });
    const result = await screen(stubs, { amount: 1000, category: "TRANSFER" });

    expect(result.riskScore).toBe(30); // 8 + 22
    expect(result.reason).toContain("New payee");
  });

  it("does not apply the new-payee rule outside the TRANSFER category", async () => {
    const stubs = buildStubs({ knownPayee: false });
    const result = await screen(stubs, { amount: 1000, category: "BILL" });

    expect(result.riskScore).toBe(8);
    expect(result.reason).toBe("Within usual pattern");
  });
});

describe("FraudService.screen — hold behaviour", () => {
  it("holds when stacked rules cross 70 and reserves the funds", async () => {
    // 8 + 45 (>=50k) + 25 (velocity) + 22 (new payee) = 100
    const stubs = buildStubs({ knownPayee: false, recentOutbound: 4, amount: 60000, fee: 250 });
    const result = await screen(stubs, { amount: 60000 });

    expect(result.riskScore).toBe(100);
    expect(result.held).toBe(true);

    expect(stubs.updates[0].data.status).toBe("HELD");

    // The held amount must reserve the fee as well as the principal, or the
    // customer could spend money that is already committed.
    expect(stubs.prisma.account.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "acc-1" },
        data: { heldAmount: { increment: 60250 } },
      }),
    );

    expect(stubs.audited[0]).toEqual(
      expect.objectContaining({ category: "Fraud", action: "txn.held" }),
    );
    expect(stubs.published[0]).toEqual(
      expect.objectContaining({ type: "payment.held", riskScore: 100 }),
    );
  });

  it("forceHold raises a clean transaction to a holding score for the demo path", async () => {
    const stubs = buildStubs({ knownPayee: true });
    const result = await screen(stubs, { amount: 1000, forceHold: true });

    expect(result.riskScore).toBe(82);
    expect(result.held).toBe(true);
    expect(result.reason).toContain("Demo force-hold");
  });

  it("leaves a transaction PENDING when it scores below the threshold", async () => {
    const stubs = buildStubs({ knownPayee: true });
    await screen(stubs, { amount: 1000 });

    expect(stubs.updates[0].data.status).toBe("PENDING");
    expect(stubs.prisma.account.update).not.toHaveBeenCalled();
    expect(stubs.published).toHaveLength(0);
  });
});
