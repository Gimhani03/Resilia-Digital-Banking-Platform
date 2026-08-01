import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventBusService } from "../event-bus/event-bus.service";
import {
  NOTIFICATION_SENDER,
  type NotificationSender,
} from "../providers/providers.module";

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBusService,
    @Inject(NOTIFICATION_SENDER)
    private readonly sender: NotificationSender,
  ) {}

  subscribe() {
    this.bus.on(async (event) => {
      if (event.type === "auth.login" && event.newDevice) {
        await this.createAndSend(event.userId, {
          channel: "push",
          kind: "security",
          title: "New device login blocked until MFA",
          body: "Review trusted devices if this was not you.",
          href: "/devices",
        });
      }
      if (event.type === "payment.settled") {
        await this.createAndSend(event.userId, {
          channel: "sms",
          kind: "payment",
          title: "Payment settled",
          body: `LKR ${event.amount.toLocaleString()} settled successfully.`,
          href: "/payments",
        });
      }
      if (event.type === "security.freeze") {
        await this.createAndSend(event.userId, {
          channel: "email",
          kind: "security",
          title: `${event.target} frozen`,
          body: `Your ${event.target} was frozen instantly. Audit log updated.`,
          href: event.target === "card" ? "/cards" : "/accounts",
        });
      }
      if (event.type === "loan.decided") {
        const loan = await this.prisma.loanApplication.findUnique({
          where: { id: event.loanId },
        });
        if (loan) {
          await this.createAndSend(loan.userId, {
            channel: "push",
            kind: "loan",
            title: `Loan ${event.status.toLowerCase()}`,
            body: `Application ${loan.id.slice(-6)} was ${event.status.toLowerCase()}.`,
            href: "/loans",
          });
        }
      }
      if (event.type === "dispute.decided") {
        const upheld = event.status === "RESOLVED";
        await this.createAndSend(event.userId, {
          channel: "push",
          kind: "security",
          title: upheld ? "Dispute upheld" : "Dispute closed",
          body: event.refunded
            ? `${event.resolution} A refund was credited to your account.`
            : event.resolution ||
              (upheld
                ? "Your dispute was resolved in your favour."
                : "Your dispute was reviewed and closed."),
          href: "/security",
        });
      }
    });
  }

  private async createAndSend(
    userId: string,
    input: {
      channel: "sms" | "email" | "push";
      kind: string;
      title: string;
      body: string;
      href: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    await this.prisma.notification.create({
      data: {
        userId,
        channel: input.channel,
        kind: input.kind,
        title: input.title,
        body: input.body,
        href: input.href,
      },
    });
    const to =
      input.channel === "email"
        ? user?.email || userId
        : input.channel === "sms"
          ? user?.phone || userId
          : userId;
    await this.sender.send({
      channel: input.channel,
      to,
      title: input.title,
      body: input.body,
    });
  }

  list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
  }

  async markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { ok: true, updated: result.count };
  }
}
