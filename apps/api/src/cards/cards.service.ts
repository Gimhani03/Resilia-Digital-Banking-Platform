import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { EventBusService } from "../event-bus/event-bus.service";

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly bus: EventBusService,
  ) {}

  list(userId: string) {
    return this.prisma.card.findMany({ where: { userId } });
  }

  async freeze(userId: string, cardId: string) {
    const card = await this.prisma.card.findFirst({
      where: { id: cardId, userId },
    });
    if (!card) throw new BadRequestException("Card not found");
    const updated = await this.prisma.card.update({
      where: { id: cardId },
      data: { frozen: true },
    });
    await this.audit.record({
      category: "Security",
      action: "card.frozen",
      actor: userId,
      detail: `Card ${card.mask} frozen by customer`,
    });
    await this.bus.publish({
      type: "security.freeze",
      userId,
      target: "card",
      targetId: cardId,
    });
    return updated;
  }

  async unfreeze(userId: string, cardId: string) {
    const card = await this.prisma.card.findFirst({
      where: { id: cardId, userId },
    });
    if (!card) throw new BadRequestException("Card not found");
    const updated = await this.prisma.card.update({
      where: { id: cardId },
      data: { frozen: false },
    });
    await this.audit.record({
      category: "Security",
      action: "card.unfrozen",
      actor: userId,
      detail: `Card ${card.mask} unfrozen by customer`,
    });
    return updated;
  }

  async setPin(userId: string, cardId: string, pin: string) {
    if (!/^\d{4}$/.test(pin)) {
      throw new BadRequestException("PIN must be exactly 4 digits");
    }
    const card = await this.prisma.card.findFirst({
      where: { id: cardId, userId },
    });
    if (!card) throw new BadRequestException("Card not found");
    const updated = await this.prisma.card.update({
      where: { id: cardId },
      data: { pinSet: true },
    });
    await this.audit.record({
      category: "Security",
      action: "card.pin_set",
      actor: userId,
      detail: `PIN set for card ${card.mask}`,
    });
    return updated;
  }

  async updateControls(
    userId: string,
    cardId: string,
    data: Partial<{
      dailyLimit: number;
      online: boolean;
      contactless: boolean;
      international: boolean;
    }>,
  ) {
    const card = await this.prisma.card.findFirst({
      where: { id: cardId, userId },
    });
    if (!card) throw new BadRequestException("Card not found");
    return this.prisma.card.update({ where: { id: cardId }, data });
  }
}
