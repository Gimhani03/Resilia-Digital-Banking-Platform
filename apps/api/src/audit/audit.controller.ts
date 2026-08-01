import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { Roles, RolesGuard } from "../identity/roles.guard";

@Controller("audit")
@UseGuards(RolesGuard)
@Roles("OFFICER")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query("category") category?: string) {
    return this.audit.list(category);
  }

  @Get("integrity")
  integrity() {
    return this.audit.integrity();
  }
}
