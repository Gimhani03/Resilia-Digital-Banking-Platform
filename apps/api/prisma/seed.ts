import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { DEMO_PASSWORD, DEMO_USERNAME } from "@resilia/shared";

const prisma = new PrismaClient();

function hashChain(prev: string, category: string, action: string, actor: string, detail: string) {
  const payload = `${prev}|${category}|${action}|${actor}|${detail}|seed`;
  return createHash("sha256").update(payload).digest("hex");
}

async function main() {
  await prisma.dispute.deleteMany();
  await prisma.mfaChallenge.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.loanApplication.deleteMany();
  await prisma.card.deleteMany();
  await prisma.device.deleteMany();
  await prisma.beneficiary.deleteMany();
  await prisma.biller.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const amal = await prisma.user.create({
    data: {
      username: DEMO_USERNAME,
      passwordHash,
      fullName: "Amal Perera",
      nationalId: "199512345V",
      email: "amal.perera@email.lk",
      phone: "0771234578",
      phoneLast4: "4578",
      address: "42 Galle Road, Colombo 03",
      role: "CUSTOMER",
      kycStatus: "VERIFIED",
      totpSecret: "JBSWY3DPEHPK3PXP",
      totpEnabled: true,
    },
  });

  const officer = await prisma.user.create({
    data: {
      username: "s.jayasuriya",
      passwordHash: await bcrypt.hash("OpsConsole2065!", 10),
      fullName: "S. Jayasuriya",
      nationalId: "STAFF001",
      email: "s.jayasuriya@resilia.bank",
      phone: "0112345621",
      phoneLast4: "5621",
      address: "RESILIA HQ, Colombo",
      role: "OFFICER",
      kycStatus: "VERIFIED",
      totpSecret: "JBSWY3DPEHPK3PXP",
      totpEnabled: true,
    },
  });

  const savings = await prisma.account.create({
    data: {
      userId: amal.id,
      label: "Savings",
      mask: "****4821",
      type: "SAVINGS",
      balance: 482650,
      heldAmount: 87500,
      currency: "LKR",
      nickname: "Everyday savings",
    },
  });

  await prisma.account.create({
    data: {
      userId: amal.id,
      label: "Current",
      mask: "****9012",
      type: "CURRENT",
      balance: 125000,
      heldAmount: 0,
      currency: "LKR",
      nickname: "Business current",
    },
  });

  await prisma.beneficiary.createMany({
    data: [
      {
        userId: amal.id,
        name: "Nimal Fernando",
        bankName: "People’s Bank",
        accountMask: "****3344",
        accountNumber: "1234563344",
        nickname: "Nimal",
        favorite: true,
      },
      {
        userId: amal.id,
        name: "Sanduni Jayawardena",
        bankName: "Commercial Bank",
        accountMask: "****7788",
        accountNumber: "9876547788",
        nickname: "Sanduni",
        favorite: false,
      },
      {
        userId: amal.id,
        name: "Lanka Traders Pvt Ltd",
        bankName: "Hatton National Bank",
        accountMask: "****2201",
        accountNumber: "5566772201",
        nickname: "Lanka Traders",
        favorite: true,
      },
    ],
  });

  await prisma.biller.createMany({
    data: [
      {
        code: "CEB",
        name: "Ceylon Electricity Board",
        category: "UTILITIES",
        accountHint: "Account number on bill",
        minAmount: 100,
        maxAmount: 500000,
      },
      {
        code: "NWSDB",
        name: "National Water Supply & Drainage Board",
        category: "UTILITIES",
        accountHint: "Consumer account number",
        minAmount: 100,
        maxAmount: 200000,
      },
      {
        code: "DIALOG",
        name: "Dialog Axiata",
        category: "TELECOM",
        accountHint: "Mobile number",
        minAmount: 50,
        maxAmount: 50000,
      },
      {
        code: "MOBITEL",
        name: "Mobitel",
        category: "TELECOM",
        accountHint: "Mobile number",
        minAmount: 50,
        maxAmount: 50000,
      },
      {
        code: "KEELLS",
        name: "Keells Super",
        category: "MERCHANT",
        accountHint: "Loyalty / invoice ref",
        minAmount: 100,
        maxAmount: 200000,
      },
      {
        code: "PICKME",
        name: "PickMe",
        category: "TRANSPORT",
        accountHint: "Registered mobile",
        minAmount: 100,
        maxAmount: 25000,
      },
    ],
  });

  await prisma.device.create({
    data: {
      userId: amal.id,
      name: "iPhone 15 · Colombo",
      platform: "iOS",
      location: "Colombo",
      fingerprint: "trusted-iphone-amal",
      trusted: true,
      pending: false,
    },
  });

  await prisma.device.create({
    data: {
      userId: amal.id,
      name: "Chrome · Unknown laptop",
      platform: "Web",
      location: "Colombo",
      fingerprint: "pending-chrome-laptop",
      trusted: false,
      pending: true,
    },
  });

  await prisma.card.createMany({
    data: [
      {
        userId: amal.id,
        label: "RESILIA Debit",
        mask: "****4821",
        type: "DEBIT",
        frozen: false,
        dailyLimit: 150000,
        online: true,
        contactless: true,
        international: false,
        pinSet: true,
        expiry: "08/28",
      },
      {
        userId: amal.id,
        label: "RESILIA Credit",
        mask: "****7712",
        type: "CREDIT",
        frozen: false,
        dailyLimit: 250000,
        online: true,
        contactless: true,
        international: true,
        pinSet: true,
        expiry: "11/29",
      },
    ],
  });

  const now = Date.now();
  await prisma.transaction.createMany({
    data: [
      {
        accountId: savings.id,
        reference: "QR-KEELLS-01",
        counterparty: "Keells Super",
        category: "MERCHANT",
        amount: 4250,
        fee: 0,
        direction: "OUT",
        status: "SETTLED",
        riskScore: 9,
        billerCode: "KEELLS",
        settledAt: new Date(now - 3600_000),
        createdAt: new Date(now - 3600_000),
      },
      {
        accountId: savings.id,
        reference: "SAL-NSBM-01",
        counterparty: "Salary · NSBM Labs",
        category: "SALARY",
        amount: 185000,
        fee: 0,
        direction: "IN",
        status: "SETTLED",
        riskScore: 2,
        settledAt: new Date(now - 86400_000),
        createdAt: new Date(now - 86400_000),
      },
      {
        accountId: savings.id,
        reference: "BILL-CEB-01",
        counterparty: "CEB Bill",
        category: "UTILITIES",
        amount: 6890,
        fee: 0,
        direction: "OUT",
        status: "SETTLED",
        riskScore: 5,
        billerCode: "CEB",
        settledAt: new Date(now - 3 * 86400_000),
        createdAt: new Date(now - 3 * 86400_000),
      },
      {
        accountId: savings.id,
        reference: "TRF-NIMAL-01",
        counterparty: "Transfer to Nimal",
        category: "TRANSFER",
        amount: 12000,
        fee: 25,
        direction: "OUT",
        status: "SETTLED",
        riskScore: 14,
        note: "Weekend trip",
        settledAt: new Date(now - 4 * 86400_000),
        createdAt: new Date(now - 4 * 86400_000),
      },
      {
        accountId: savings.id,
        reference: "HELD-DEMO-01",
        counterparty: "Unknown Merchant LK",
        category: "MERCHANT",
        amount: 87500,
        fee: 0,
        direction: "OUT",
        status: "HELD",
        riskScore: 84,
        riskReason: "High amount vs usual pattern · New payee",
        createdAt: new Date(now - 1800_000),
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: amal.id,
        channel: "push",
        kind: "security",
        title: "Security alert",
        body: "Login from a new device in Colombo was blocked until MFA completed.",
        href: "/devices",
        read: false,
      },
      {
        userId: amal.id,
        channel: "sms",
        kind: "payment",
        title: "Salary credited",
        body: "LKR 185,000 credited to Savings ****4821",
        href: "/accounts",
        read: true,
      },
      {
        userId: amal.id,
        channel: "email",
        kind: "loan",
        title: "Loan eligibility ready",
        body: "Your personal loan estimate is available in the app.",
        href: "/loans",
        read: false,
      },
      {
        userId: amal.id,
        channel: "push",
        kind: "security",
        title: "Payment held for review",
        body: "HELD-DEMO-01 · Risk score 84/100 · High amount vs usual pattern",
        href: "/payments/HELD-DEMO-01",
        read: false,
      },
    ],
  });

  const loanAmount = 350000;
  const tenureMonths = 24;
  const instalment = Number(((loanAmount * 1.12) / tenureMonths).toFixed(2));

  await prisma.loanApplication.create({
    data: {
      userId: amal.id,
      product: "PERSONAL",
      amount: loanAmount,
      tenureMonths,
      purpose: "Home renovation",
      monthlyIncome: 185000,
      status: "SUBMITTED",
      eligibilityScore: 78,
      dti: 0.32,
      fraudFlags: "[]",
      aiRecommendation: "Likely approve · within policy band",
      instalment,
    },
  });

  let prev = "GENESIS";
  const events = [
    ["Infra", "platform.boot", "system", "Region A warm · Region B standby armed"],
    ["Identity", "ekyc.completed", DEMO_USERNAME, "National ID verified · match 98%"],
    ["Auth", "login.success", DEMO_USERNAME, "Trusted iPhone · MFA authenticator"],
    ["Payments", "payment.settled", DEMO_USERNAME, "QR-KEELLS-01 · Keells Super"],
    ["Fraud", "txn.held", "fraud-service", "HELD-DEMO-01 · score 84"],
    ["Admin", "loan.submitted", DEMO_USERNAME, "PERSONAL LKR 350000"],
    ["Security", "device.pending", DEMO_USERNAME, "Chrome laptop awaiting approval"],
  ] as const;

  for (const [category, action, actor, detail] of events) {
    const hash = hashChain(prev, category, action, actor, detail);
    await prisma.auditEvent.create({
      data: { category, action, actor, detail, hash, prevHash: prev },
    });
    prev = hash;
  }

  console.log("Seeded RESILIA demo data");
  console.log(`Customer: ${DEMO_USERNAME} / ${DEMO_PASSWORD}`);
  console.log(`Officer:  s.jayasuriya / OpsConsole2065!`);
  console.log(`Demo OTP (DEMO_MODE only): 482916`);
  console.log(`TOTP secret (Authenticator): JBSWY3DPEHPK3PXP`);
  console.log(`Reset:    RESET-2065`);
  void officer;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
