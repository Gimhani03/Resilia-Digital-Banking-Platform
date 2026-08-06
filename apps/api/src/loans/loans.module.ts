import { controllersFor } from "../config/service-role";
import { Module } from "@nestjs/common";
import { LoansService } from "./loans.service";
import { LoansController } from "./loans.controller";
import { IdentityModule } from "../identity/identity.module";

@Module({
  imports: [IdentityModule],
  providers: [LoansService],
  controllers: controllersFor("loans", [LoansController]),
  exports: [LoansService],
})
export class LoansModule {}
