import { controllersFor } from "../config/service-role";
import { Module } from "@nestjs/common";
import { AccountsService } from "./accounts.service";
import { AccountsController } from "./accounts.controller";
import { AuthGuard } from "../identity/auth.guard";

@Module({
  providers: [AccountsService, AuthGuard],
  controllers: controllersFor("accounts", [AccountsController]),
  exports: [AccountsService],
})
export class AccountsModule {}
