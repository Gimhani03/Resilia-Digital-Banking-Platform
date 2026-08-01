export type MfaMethod = "authenticator" | "sms" | "biometric";

export type TxnStatus =
  | "PENDING"
  | "SCREENING"
  | "HELD"
  | "SETTLED"
  | "REJECTED"
  | "CANCELLED";

export type TxnCategory =
  | "TRANSFER"
  | "MERCHANT"
  | "UTILITIES"
  | "SALARY"
  | "LOAN"
  | "OTHER";

export type LoanStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "DISBURSED";

export type ServiceHealth = "Healthy" | "Degraded" | "Down" | "Sealed";

export type DisputeStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  nationalId: string;
  email: string;
  phone: string;
  phoneLast4: string;
  address: string;
  role: string;
  kycStatus: string;
}

export interface AccountSummary {
  id: string;
  label: string;
  mask: string;
  type: "SAVINGS" | "CURRENT";
  balance: number;
  available: number;
  heldAmount: number;
  currency: string;
  frozen: boolean;
  nickname: string;
}

export interface BeneficiaryDto {
  id: string;
  name: string;
  bankName: string;
  accountMask: string;
  accountNumber: string;
  nickname: string;
  favorite: boolean;
  createdAt: string;
}

export interface BillerDto {
  id: string;
  code: string;
  name: string;
  category: string;
  accountHint: string;
  minAmount: number;
  maxAmount: number;
}

export interface TransactionDto {
  id: string;
  reference: string;
  counterparty: string;
  category: TxnCategory;
  amount: number;
  direction: "IN" | "OUT";
  status: TxnStatus;
  riskScore?: number;
  riskReason?: string;
  fee?: number;
  note?: string;
  createdAt: string;
  settledAt?: string;
}

export interface DeviceDto {
  id: string;
  name: string;
  platform: string;
  location: string;
  trusted: boolean;
  pending: boolean;
  lastSeen: string;
}

export interface CardDto {
  id: string;
  label: string;
  mask: string;
  type: "DEBIT" | "CREDIT";
  frozen: boolean;
  dailyLimit: number;
  online: boolean;
  contactless: boolean;
  international: boolean;
  pinSet: boolean;
  expiry: string;
}

export interface NotificationDto {
  id: string;
  channel: "push" | "sms" | "email";
  title: string;
  body: string;
  kind: "security" | "payment" | "loan" | "system";
  href?: string;
  read: boolean;
  createdAt: string;
}

export interface LoanApplicationDto {
  id: string;
  product: "PERSONAL" | "BUSINESS" | "WORKING_CAPITAL";
  amount: number;
  tenureMonths: number;
  purpose: string;
  monthlyIncome: number;
  status: LoanStatus;
  eligibilityScore: number;
  dti: number;
  fraudFlags: string[];
  aiRecommendation: string;
  instalment: number;
  createdAt: string;
  decidedAt?: string;
}

export interface DisputeDto {
  id: string;
  transactionId?: string;
  reason: string;
  status: DisputeStatus;
  resolution?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AuditEventDto {
  id: string;
  category:
    | "Payments"
    | "Auth"
    | "Admin"
    | "Fraud"
    | "Security"
    | "Identity"
    | "Infra";
  action: string;
  actor: string;
  detail: string;
  hash: string;
  prevHash: string;
  createdAt: string;
}

export interface ServiceStatusDto {
  name: string;
  latencyMs: number | null;
  status: ServiceHealth;
}

export interface OpsOverviewDto {
  uptime: string;
  txnPerMin: number;
  activeFraudHolds: number;
  highPriorityHolds: number;
  drReady: boolean;
  rpoMinutes: number;
  rtoMinutes: number;
  services: ServiceStatusDto[];
  alerts: { severity: "HIGH" | "MED" | "LOW"; title: string; detail: string }[];
}

export const DEMO_OTP = "482916";
export const DEMO_USERNAME = "a.perera.2065";
export const DEMO_PASSWORD = "Resilia2065!";

export const BANKS = [
  "People’s Bank",
  "Bank of Ceylon",
  "Commercial Bank",
  "Hatton National Bank",
  "Sampath Bank",
  "Nations Trust Bank",
  "DFCC Bank",
  "RESILIA Bank",
] as const;

export const LOAN_PRODUCTS = [
  { id: "PERSONAL", label: "Personal loan", max: 2000000 },
  { id: "BUSINESS", label: "Business loan", max: 5000000 },
  { id: "WORKING_CAPITAL", label: "Working capital", max: 3000000 },
] as const;
