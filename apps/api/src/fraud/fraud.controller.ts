import { Controller, Get, UseGuards } from "@nestjs/common";
import { FraudService } from "./fraud.service";
import { Roles, RolesGuard } from "../identity/roles.guard";

@Controller("fraud")
@UseGuards(RolesGuard)
@Roles("OFFICER")
export class FraudController {
  constructor(private readonly fraud: FraudService) {}

  @Get("holds")
  holds() {
    return this.fraud.activeHolds();
  }
}
