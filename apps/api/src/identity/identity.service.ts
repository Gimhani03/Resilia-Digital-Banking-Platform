import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { createHash, randomBytes, randomInt, randomUUID } from "crypto";
import { authenticator } from "otplib";
import { DEMO_OTP } from "@resilia/shared";
import { PrismaService } from "../prisma/prisma.service";
import { EventBusService } from "../event-bus/event-bus.service";
import { AuditService } from "../audit/audit.service";
import { RedisService } from "../redis/redis.module";
import { isDemoMode } from "../config/fee.config";

const STEP_UP_PURPOSES = [
  "TRANSFER",
  "BILL",
  "RELEASE",
  "FREEZE",
  "DISPUTE",
] as const;

const RESET_TOKEN = "RESET-2065";
const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_SEC = 7 * 24 * 60 * 60;

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly bus: EventBusService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
  ) {}

  private demo() {
    return isDemoMode();
  }

  private async rateLimit(key: string, limit: number, windowSec: number) {
    const n = await this.redis.incr(`rl:${key}`, windowSec);
    if (n > limit) {
      throw new BadRequestException("Too many attempts · try again later");
    }
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private issueOtpCode() {
    if (this.demo()) return DEMO_OTP;
    return String(randomInt(100000, 999999));
  }

  private async verifyUserCode(
    user: { totpSecret: string; totpEnabled: boolean; phoneLast4: string },
    code: string,
    method: string,
    challengeCode: string,
  ) {
    if (this.demo() && code === DEMO_OTP) return true;
    if (method === "authenticator" || challengeCode === "TOTP") {
      if (!user.totpSecret) return false;
      return authenticator.check(code, user.totpSecret);
    }
    return challengeCode === code;
  }

  private async issueTokens(user: {
    id: string;
    username: string;
    role: string;
    fullName: string;
  }) {
    const jti = randomUUID();
    const refreshToken = randomBytes(48).toString("hex");
    const refreshHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + ACCESS_TTL_SEC * 1000);
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_SEC * 1000);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenJti: jti,
        refreshTokenHash: refreshHash,
        expiresAt,
        refreshExpiresAt,
      },
    });

    await this.redis.set(
      `sess:${jti}`,
      user.id,
      ACCESS_TTL_SEC,
    );
    await this.redis.set(
      `refresh:${refreshHash}`,
      JSON.stringify({ userId: user.id, jti }),
      REFRESH_TTL_SEC,
    );

    const accessToken = this.jwt.sign(
      {
        sub: user.id,
        username: user.username,
        role: user.role,
        name: user.fullName,
        jti,
      },
      {
        secret: process.env.JWT_SECRET || "resilia-dev-jwt-secret-change-me",
        expiresIn: ACCESS_TTL_SEC,
      },
    );

    return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SEC };
  }

  async login(input: {
    username: string;
    password: string;
    deviceFingerprint: string;
    deviceName?: string;
    platform?: string;
    location?: string;
  }) {
    await this.rateLimit(`login:${input.username}`, 10, 60);

    const user = await this.prisma.user.findUnique({
      where: { username: input.username },
    });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid credentials");
    }

    let device = await this.prisma.device.findFirst({
      where: { userId: user.id, fingerprint: input.deviceFingerprint },
    });

    const newDevice = !device;
    if (!device) {
      device = await this.prisma.device.create({
        data: {
          userId: user.id,
          fingerprint: input.deviceFingerprint,
          name: input.deviceName || "Unknown device",
          platform: input.platform || "Web",
          location: input.location || "Unknown",
          trusted: false,
          pending: true,
        },
      });
    } else {
      device = await this.prisma.device.update({
        where: { id: device.id },
        data: { lastSeen: new Date() },
      });
    }

    let totpSetup: { secret: string; otpauthUrl: string } | undefined;
    if (!user.totpEnabled || !user.totpSecret) {
      const secret = authenticator.generateSecret();
      await this.prisma.user.update({
        where: { id: user.id },
        data: { totpSecret: secret, totpEnabled: true },
      });
      user.totpSecret = secret;
      user.totpEnabled = true;
      totpSetup = {
        secret,
        otpauthUrl: authenticator.keyuri(user.username, "RESILIA", secret),
      };
    }

    const challenge = await this.prisma.mfaChallenge.create({
      data: {
        userId: user.id,
        method: "authenticator",
        code: "TOTP",
        purpose: "LOGIN",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    await this.audit.record({
      category: "Auth",
      action: "login.challenge",
      actor: user.username,
      detail: `MFA challenge issued · device ${device.name}${newDevice ? " (new)" : ""}`,
    });

    await this.bus.publish({
      type: "auth.login",
      userId: user.id,
      deviceId: device.id,
      newDevice,
    });

    return {
      challengeId: challenge.id,
      requiresMfa: true,
      newDevice,
      totpSetup,
      methods: [
        {
          id: "authenticator",
          label: "Authenticator app",
          hint: "Open your TOTP app · 6-digit code",
        },
        {
          id: "sms",
          label: "SMS OTP",
          hint: `Fallback · ••${user.phoneLast4}`,
        },
      ],
      ...(this.demo() ? { demoOtp: DEMO_OTP } : {}),
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
      },
    };
  }

  async verifyMfa(input: {
    challengeId: string;
    code: string;
    method: string;
    deviceFingerprint: string;
  }) {
    await this.rateLimit(`mfa:${input.challengeId}`, 8, 60);

    const challenge = await this.prisma.mfaChallenge.findUnique({
      where: { id: input.challengeId },
    });
    if (!challenge || challenge.consumed || challenge.expiresAt < new Date()) {
      throw new BadRequestException("Challenge expired");
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: challenge.userId },
    });

    const ok = await this.verifyUserCode(
      user,
      input.code,
      input.method,
      challenge.code,
    );
    if (!ok) throw new UnauthorizedException("Invalid MFA code");

    if (challenge.purpose !== "LOGIN") {
      await this.prisma.mfaChallenge.update({
        where: { id: challenge.id },
        data: { method: input.method, code: "VERIFIED" },
      });
      return {
        verified: true,
        purpose: challenge.purpose,
        challengeId: challenge.id,
      };
    }

    await this.prisma.mfaChallenge.update({
      where: { id: challenge.id },
      data: { consumed: true, method: input.method },
    });

    const device = await this.prisma.device.findFirst({
      where: { userId: user.id, fingerprint: input.deviceFingerprint },
    });
    if (device) {
      await this.prisma.device.update({
        where: { id: device.id },
        data: { lastSeen: new Date() },
      });
    }

    const tokens = await this.issueTokens(user);

    await this.audit.record({
      category: "Auth",
      action: "login.success",
      actor: user.username,
      detail: `MFA via ${input.method} · session 15m`,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: this.mapProfile(user),
    };
  }

  async refresh(refreshToken: string) {
    const hash = this.hashToken(refreshToken);
    const cached = await this.redis.get(`refresh:${hash}`);
    const session = await this.prisma.session.findFirst({
      where: { refreshTokenHash: hash, revoked: false },
      include: { user: true },
    });
    if (!session || !session.refreshExpiresAt || session.refreshExpiresAt < new Date()) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    if (!cached) {
      // allow DB-backed refresh if redis flushed
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revoked: true },
    });
    await this.redis.del(`sess:${session.tokenJti}`);
    await this.redis.del(`refresh:${hash}`);

    const tokens = await this.issueTokens(session.user);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return this.mapProfile(user);
  }

  async updateProfile(
    userId: string,
    input: {
      fullName?: string;
      email?: string;
      phone?: string;
      address?: string;
    },
  ) {
    const data: {
      fullName?: string;
      email?: string;
      phone?: string;
      phoneLast4?: string;
      address?: string;
    } = {};
    if (input.fullName !== undefined) data.fullName = input.fullName;
    if (input.email !== undefined) data.email = input.email;
    if (input.address !== undefined) data.address = input.address;
    if (input.phone !== undefined) {
      data.phone = input.phone;
      const digits = input.phone.replace(/\D/g, "");
      data.phoneLast4 = digits.slice(-4) || "0000";
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    await this.audit.record({
      category: "Identity",
      action: "profile.updated",
      actor: user.username,
      detail: "Customer profile fields updated",
    });
    return this.mapProfile(user);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException("Current password is incorrect");
    }
    if (newPassword.length < 8) {
      throw new BadRequestException("New password must be at least 8 characters");
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    await this.prisma.session.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
    await this.audit.record({
      category: "Auth",
      action: "password.changed",
      actor: user.username,
      detail: "Password updated · sessions revoked",
    });
    return { ok: true, message: "Password updated" };
  }

  async forgotPassword(username: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (user) {
      await this.audit.record({
        category: "Auth",
        action: "password.reset_requested",
        actor: username,
        detail: "Reset token issued",
      });
    }
    return {
      message: this.demo()
        ? `If the account exists, use reset token ${RESET_TOKEN}`
        : "If the account exists, check your email for reset instructions",
      ...(this.demo() ? { demoToken: RESET_TOKEN } : {}),
    };
  }

  async resetPassword(input: {
    username: string;
    token: string;
    newPassword: string;
  }) {
    if (input.token !== RESET_TOKEN) {
      throw new BadRequestException("Invalid reset token");
    }
    if (input.newPassword.length < 8) {
      throw new BadRequestException("New password must be at least 8 characters");
    }
    const user = await this.prisma.user.findUnique({
      where: { username: input.username },
    });
    if (!user) throw new BadRequestException("User not found");
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(input.newPassword, 10) },
    });
    await this.prisma.session.updateMany({
      where: { userId: user.id, revoked: false },
      data: { revoked: true },
    });
    await this.audit.record({
      category: "Auth",
      action: "password.reset",
      actor: user.username,
      detail: "Password reset completed",
    });
    return { ok: true, message: "Password reset successful" };
  }

  async logout(userId: string, jti?: string, refreshToken?: string) {
    if (jti) {
      await this.prisma.session.updateMany({
        where: { userId, tokenJti: jti, revoked: false },
        data: { revoked: true },
      });
      await this.redis.del(`sess:${jti}`);
    }
    if (refreshToken) {
      const hash = this.hashToken(refreshToken);
      await this.prisma.session.updateMany({
        where: { userId, refreshTokenHash: hash },
        data: { revoked: true },
      });
      await this.redis.del(`refresh:${hash}`);
    }
    return { ok: true };
  }

  async createStepUp(
    userId: string,
    purpose: string,
    meta?: Record<string, unknown>,
  ) {
    if (!STEP_UP_PURPOSES.includes(purpose as (typeof STEP_UP_PURPOSES)[number])) {
      throw new BadRequestException(
        `purpose must be one of ${STEP_UP_PURPOSES.join(", ")}`,
      );
    }
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const challenge = await this.prisma.mfaChallenge.create({
      data: {
        userId,
        method: "authenticator",
        code: "TOTP",
        purpose,
        meta: JSON.stringify(meta ?? {}),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    await this.audit.record({
      category: "Auth",
      action: "mfa.step_up",
      actor: user.username,
      detail: `Step-up MFA · ${purpose}`,
    });
    return {
      challengeId: challenge.id,
      purpose,
      expiresAt: challenge.expiresAt.toISOString(),
      methods: [
        { id: "authenticator", label: "Authenticator app", hint: "6-digit TOTP" },
      ],
      ...(this.demo() ? { demoOtp: DEMO_OTP } : {}),
    };
  }

  async consumeStepUp(
    userId: string,
    challengeId: string,
    purpose: string,
  ) {
    const challenge = await this.prisma.mfaChallenge.findFirst({
      where: { id: challengeId, userId },
    });
    if (!challenge || challenge.consumed || challenge.expiresAt < new Date()) {
      throw new BadRequestException("MFA challenge expired or invalid");
    }
    if (challenge.purpose !== purpose) {
      throw new BadRequestException(
        `MFA challenge purpose mismatch · expected ${purpose}`,
      );
    }
    if (challenge.code !== "VERIFIED") {
      throw new BadRequestException("MFA challenge not verified");
    }
    await this.prisma.mfaChallenge.update({
      where: { id: challenge.id },
      data: { consumed: true },
    });
    return challenge;
  }

  async listDevices(userId: string) {
    return this.prisma.device.findMany({
      where: { userId },
      orderBy: { lastSeen: "desc" },
    });
  }

  async decideDevice(userId: string, deviceId: string, approve: boolean) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, userId },
    });
    if (!device) throw new BadRequestException("Device not found");
    const updated = await this.prisma.device.update({
      where: { id: deviceId },
      data: approve
        ? { trusted: true, pending: false }
        : { trusted: false, pending: false },
    });
    await this.audit.record({
      category: "Security",
      action: approve ? "device.approved" : "device.denied",
      actor: userId,
      detail: `${device.name} · ${device.location}`,
    });
    return updated;
  }

  async revokeDevice(userId: string, deviceId: string) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, userId },
    });
    if (!device) throw new BadRequestException("Device not found");
    await this.prisma.device.delete({ where: { id: deviceId } });
    await this.audit.record({
      category: "Security",
      action: "device.revoked",
      actor: userId,
      detail: `${device.name} · ${device.location}`,
    });
    return { ok: true };
  }

  async onboard(input: {
    fullName: string;
    nationalId: string;
    username: string;
    password: string;
    documentType: string;
    phone?: string;
    email?: string;
    address?: string;
    documentBase64?: string;
    documentMimeType?: string;
    selfieBase64?: string;
    selfieMimeType?: string;
  }) {
    if (!input.documentBase64?.trim()) {
      throw new BadRequestException("ID document photo is required");
    }
    if (!input.selfieBase64?.trim()) {
      throw new BadRequestException("Liveness selfie is required");
    }

    const existing = await this.prisma.user.findUnique({
      where: { username: input.username },
    });
    if (existing) throw new BadRequestException("Username taken");

    const phone = input.phone || "";
    const digits = phone.replace(/\D/g, "");
    const phoneLast4 = digits.slice(-4) || "0000";
    const passwordHash = await bcrypt.hash(input.password, 10);
    const savingsMask = "****" + String(Math.floor(1000 + Math.random() * 9000));
    const currentMask = "****" + String(Math.floor(1000 + Math.random() * 9000));
    const totpSecret = authenticator.generateSecret();

    const user = await this.prisma.user.create({
      data: {
        username: input.username,
        passwordHash,
        fullName: input.fullName,
        nationalId: input.nationalId,
        email: input.email || "",
        phone,
        phoneLast4,
        address: input.address || "",
        role: "CUSTOMER",
        kycStatus: "PENDING_REVIEW",
        totpSecret,
        totpEnabled: true,
        accounts: {
          create: [
            {
              label: "Savings",
              mask: savingsMask,
              type: "SAVINGS",
              balance: 5000,
              currency: "LKR",
              nickname: "Welcome savings",
            },
            {
              label: "Current",
              mask: currentMask,
              type: "CURRENT",
              balance: 0,
              currency: "LKR",
            },
          ],
        },
        cards: {
          create: {
            label: "RESILIA Debit",
            mask: savingsMask,
            type: "DEBIT",
            frozen: false,
            dailyLimit: 100000,
            online: true,
            contactless: true,
            international: false,
            pinSet: false,
          },
        },
      },
    });

    await this.uploadKycDocument(user.id, {
      documentType: input.documentType,
      mimeType: input.documentMimeType || "image/jpeg",
      base64: input.documentBase64,
    });
    await this.uploadKycDocument(user.id, {
      documentType: "SELFIE_LIVENESS",
      mimeType: input.selfieMimeType || "image/jpeg",
      base64: input.selfieBase64,
    });

    await this.audit.record({
      category: "Identity",
      action: "ekyc.submitted",
      actor: user.username,
      detail: `Document ${input.documentType} + selfie · pending officer review`,
    });

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      kycStatus: "PENDING_REVIEW",
      totpSetup: {
        secret: totpSecret,
        otpauthUrl: authenticator.keyuri(user.username, "RESILIA", totpSecret),
      },
      message:
        "e-KYC submitted · add TOTP before login · banking unlocks after officer approval",
      ...(this.demo() ? { demoOtp: DEMO_OTP } : {}),
    };
  }

  async requireKycVerified(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException("User not found");
    if (user.role === "OFFICER") return;
    if (user.kycStatus === "VERIFIED") return;
    if (user.kycStatus === "REJECTED") {
      throw new BadRequestException(
        "KYC was rejected. Re-apply or contact support before banking.",
      );
    }
    throw new BadRequestException(
      "KYC is pending officer review. Transfers and payments unlock after approval.",
    );
  }

  async uploadKycDocument(
    userId: string,
    input: {
      documentType: string;
      mimeType: string;
      base64: string;
      fileName?: string;
    },
  ) {
    const { LocalObjectStore, S3ObjectStore, kycObjectKey } = await import(
      "../providers/providers.module"
    );
    const store = process.env.S3_ENDPOINT?.trim()
      ? new S3ObjectStore()
      : new LocalObjectStore();
    const ext =
      (input.fileName || "").split(".").pop() ||
      (input.mimeType.includes("png")
        ? "png"
        : input.mimeType.includes("jpeg") || input.mimeType.includes("jpg")
          ? "jpg"
          : "bin");
    const raw = input.base64.includes(",")
      ? input.base64.split(",")[1]
      : input.base64;
    const bytes = Buffer.from(raw, "base64");
    if (bytes.length > 8 * 1024 * 1024) {
      throw new BadRequestException("File too large (max 8MB)");
    }
    const key = kycObjectKey(userId, input.documentType, ext);
    const stored = await store.put({
      key,
      bytes,
      mimeType: input.mimeType || "application/octet-stream",
    });
    const doc = await this.prisma.kycDocument.create({
      data: {
        userId,
        documentType: input.documentType,
        storageKey: stored.key,
        mimeType: input.mimeType || "application/octet-stream",
        sizeBytes: bytes.length,
      },
    });
    await this.audit.record({
      category: "Identity",
      action: "kyc.document_uploaded",
      actor: userId,
      detail: `${input.documentType} · ${bytes.length} bytes`,
    });
    return {
      id: doc.id,
      documentType: doc.documentType,
      storageKey: doc.storageKey,
      sizeBytes: doc.sizeBytes,
      url: stored.url,
    };
  }

  private mapProfile(user: {
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
    totpEnabled?: boolean;
  }) {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      nationalId: user.nationalId,
      email: user.email,
      phone: user.phone,
      phoneLast4: user.phoneLast4,
      address: user.address,
      role: user.role,
      kycStatus: user.kycStatus,
      totpEnabled: !!user.totpEnabled,
    };
  }
}
