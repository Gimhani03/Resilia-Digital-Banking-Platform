import { Module } from "@nestjs/common";
import { OpsService } from "./ops.service";
import { OpsController } from "./ops.controller";
import { RolesGuard } from "../identity/roles.guard";

@Module({
  providers: [OpsService, RolesGuard],
  controllers: [OpsController],
})
export class OpsModule {}
