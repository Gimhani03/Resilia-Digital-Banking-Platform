import { controllersFor } from "../config/service-role";
import { Module, forwardRef } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { PaymentsController } from "./payments.controller";
import { FraudModule } from "../fraud/fraud.module";
import { IdentityModule } from "../identity/identity.module";
import { AuthGuard } from "../identity/auth.guard";
import { FeeConfig } from "../config/fee.config";

@Module({
  imports: [forwardRef(() => FraudModule), IdentityModule],
  providers: [PaymentsService, AuthGuard, FeeConfig],
  controllers: controllersFor("payments", [PaymentsController]),
  exports: [PaymentsService],
})
export class PaymentsModule {}
