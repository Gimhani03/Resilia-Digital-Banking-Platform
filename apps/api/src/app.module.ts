import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { EventBusModule } from "./event-bus/event-bus.module";
import { RedisModule } from "./redis/redis.module";
import { IdentityModule } from "./identity/identity.module";
import { AccountsModule } from "./accounts/accounts.module";
import { PaymentsModule } from "./payments/payments.module";
import { FraudModule } from "./fraud/fraud.module";
import { LoansModule } from "./loans/loans.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { AuditModule } from "./audit/audit.module";
import { OpsModule } from "./ops/ops.module";
import { CardsModule } from "./cards/cards.module";
import { HealthController } from "./health.controller";
import { FeeConfig } from "./config/fee.config";
import { ProvidersModule } from "./providers/providers.module";

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    ProvidersModule,
    EventBusModule,
    IdentityModule,
    AuditModule,
    AccountsModule,
    PaymentsModule,
    FraudModule,
    LoansModule,
    NotificationsModule,
    OpsModule,
    CardsModule,
  ],
  controllers: [HealthController],
  providers: [FeeConfig],
  exports: [FeeConfig],
})
export class AppModule {}
