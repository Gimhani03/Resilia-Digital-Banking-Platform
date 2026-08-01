import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { IsIn, IsNumber, IsString, Min } from "class-validator";
import { LoansService } from "./loans.service";
import { AuthGuard } from "../identity/auth.guard";
import { OfficerGuard } from "../identity/roles.guard";

class EstimateDto {
  @IsNumber() @Min(1000) amount!: number;
  @IsNumber() @Min(1) tenureMonths!: number;
  @IsNumber() @Min(1) monthlyIncome!: number;
}

class ApplyDto extends EstimateDto {
  @IsIn(["PERSONAL", "BUSINESS", "WORKING_CAPITAL"])
  product!: "PERSONAL" | "BUSINESS" | "WORKING_CAPITAL";
  @IsString() purpose!: string;
}

class DecideDto {
  @IsIn(["APPROVED", "REJECTED"]) status!: "APPROVED" | "REJECTED";
}

@Controller("loans")
@UseGuards(AuthGuard)
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Post("estimate")
  estimate(@Body() body: EstimateDto) {
    return this.loans.estimate(body.amount, body.tenureMonths, body.monthlyIncome);
  }

  @Post("apply")
  apply(@Req() req: { user: { sub: string } }, @Body() body: ApplyDto) {
    return this.loans.apply(req.user.sub, body);
  }

  @Get("mine")
  mine(@Req() req: { user: { sub: string } }) {
    return this.loans.listForUser(req.user.sub);
  }

  @Get("mine/:id")
  mineOne(
    @Req() req: { user: { sub: string } },
    @Param("id") id: string,
  ) {
    return this.loans.getOne(req.user.sub, id);
  }

  @UseGuards(OfficerGuard)
  @Get("queue")
  queue() {
    return this.loans.queue();
  }

  @UseGuards(OfficerGuard)
  @Post(":id/decide")
  decide(
    @Req() req: { user: { username: string } },
    @Param("id") id: string,
    @Body() body: DecideDto,
  ) {
    return this.loans.decide(id, body.status, req.user.username || "officer");
  }
}
