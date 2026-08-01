import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { OpsService } from "./ops.service";
import { Roles, RolesGuard } from "../identity/roles.guard";

class DecideDisputeDto {
  @IsIn(["RESOLVED", "REJECTED"])
  status!: "RESOLVED" | "REJECTED";

  @IsString()
  @MinLength(3)
  resolution!: string;

  @IsOptional()
  @IsBoolean()
  refund?: boolean;
}

class FreezeFromDisputeDto {
  @IsIn(["card", "account"])
  target!: "card" | "account";

  @IsString()
  targetId!: string;
}

class DecideKycDto {
  @IsIn(["VERIFIED", "REJECTED"])
  status!: "VERIFIED" | "REJECTED";

  @IsString()
  @MinLength(3)
  note!: string;
}

@Controller("ops")
@UseGuards(RolesGuard)
@Roles("OFFICER")
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  @Get("overview")
  overview() {
    return this.ops.overview();
  }

  @Get("kyc")
  listKyc(@Query("status") status?: string) {
    return this.ops.listKyc(status);
  }

  @Get("kyc/:userId")
  getKyc(@Param("userId") userId: string) {
    return this.ops.getKyc(userId);
  }

  @Post("kyc/:userId/decide")
  decideKyc(
    @Param("userId") userId: string,
    @Body() body: DecideKycDto,
    @Req() req: { user: { sub: string; username?: string } },
  ) {
    return this.ops.decideKyc(
      userId,
      body,
      req.user.username || req.user.sub || "officer",
    );
  }

  @Get("disputes")
  listDisputes(@Query("status") status?: string) {
    return this.ops.listDisputes(status);
  }

  @Get("disputes/:id")
  getDispute(@Param("id") id: string) {
    return this.ops.getDispute(id);
  }

  @Post("disputes/:id/decide")
  decide(
    @Param("id") id: string,
    @Body() body: DecideDisputeDto,
    @Req() req: { user: { sub: string; username?: string } },
  ) {
    return this.ops.decide(
      id,
      body,
      req.user.username || req.user.sub || "officer",
    );
  }

  @Post("disputes/:id/freeze")
  freeze(
    @Param("id") id: string,
    @Body() body: FreezeFromDisputeDto,
    @Req() req: { user: { sub: string; username?: string } },
  ) {
    return this.ops.freezeFromDispute(
      id,
      body,
      req.user.username || req.user.sub || "officer",
    );
  }
}
