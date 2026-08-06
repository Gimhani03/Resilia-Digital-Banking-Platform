import { controllersFor } from "../config/service-role";
import { Global, Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { AuditController } from "./audit.controller";
import { RolesGuard } from "../identity/roles.guard";

@Global()
@Module({
  providers: [AuditService, RolesGuard],
  controllers: controllersFor("audit", [AuditController]),
  exports: [AuditService],
})
export class AuditModule {}
