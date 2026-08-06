import { controllersFor } from "../config/service-role";
import { Module } from "@nestjs/common";
import { OpsService } from "./ops.service";
import { OpsController } from "./ops.controller";
import { RolesGuard } from "../identity/roles.guard";

@Module({
  providers: [OpsService, RolesGuard],
  controllers: controllersFor("ops", [OpsController]),
})
export class OpsModule {}
