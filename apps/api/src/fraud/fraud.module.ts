import { controllersFor } from "../config/service-role";
import { Module, forwardRef, OnModuleInit } from "@nestjs/common";
import { FraudService } from "./fraud.service";
import { FraudController } from "./fraud.controller";
import { PaymentsModule } from "../payments/payments.module";
import { RolesGuard } from "../identity/roles.guard";

@Module({
  imports: [forwardRef(() => PaymentsModule)],
  providers: [FraudService, RolesGuard],
  controllers: controllersFor("fraud", [FraudController]),
  exports: [FraudService],
})
export class FraudModule implements OnModuleInit {
  constructor(private readonly fraud: FraudService) {}
  onModuleInit() {
    this.fraud.subscribe();
  }
}
