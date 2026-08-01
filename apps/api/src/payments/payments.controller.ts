import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { PaymentsService } from "./payments.service";
import { AuthGuard } from "../identity/auth.guard";

class TransferDto {
  @IsString() accountId!: string;
  @IsString() counterparty!: string;
  @IsNumber() @Min(1) amount!: number;
  @IsString() mfaChallengeId!: string;
  @IsOptional() @IsString() beneficiaryId?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsBoolean() forceHold?: boolean;
}

class BillDto {
  @IsString() accountId!: string;
  @IsString() biller!: string;
  @IsNumber() @Min(1) amount!: number;
  @IsString() method!: "BILL" | "QR";
  @IsString() mfaChallengeId!: string;
  @IsOptional() @IsString() billerCode?: string;
  @IsOptional() @IsString() accountRef?: string;
  @IsOptional() @IsBoolean() forceHold?: boolean;
}

class InternalTransferDto {
  @IsString() fromAccountId!: string;
  @IsString() toAccountId!: string;
  @IsNumber() @Min(1) amount!: number;
  @IsString() mfaChallengeId!: string;
  @IsOptional() @IsString() note?: string;
}

class PayeeDto {
  @IsString() name!: string;
  @IsString() bankName!: string;
  @IsString() accountNumber!: string;
  @IsOptional() @IsString() nickname?: string;
  @IsOptional() @IsBoolean() favorite?: boolean;
}

class PayeePatchDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() accountNumber?: string;
  @IsOptional() @IsString() nickname?: string;
  @IsOptional() @IsBoolean() favorite?: boolean;
}

class DisputeDto {
  @IsOptional() @IsString() transactionId?: string;
  @IsString() reason!: string;
}

class RejectDto {
  @IsOptional() @IsBoolean() freezeCard?: boolean;
}

class ReleaseDto {
  @IsString() mfaChallengeId!: string;
}

@Controller("payments")
@UseGuards(AuthGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get("history")
  history(
    @Req() req: { user: { sub: string } },
    @Query("category") category?: string,
    @Query("q") q?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.payments.history(req.user.sub, {
      category,
      q,
      from,
      to,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get("statement")
  statement(
    @Req() req: { user: { sub: string } },
    @Query("accountId") accountId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.payments.statement(req.user.sub, accountId, from, to);
  }

  @Get("billers")
  billers() {
    return this.payments.listBillers();
  }

  @Get("payees")
  payees(@Req() req: { user: { sub: string } }) {
    return this.payments.listPayees(req.user.sub);
  }

  @Post("payees")
  createPayee(
    @Req() req: { user: { sub: string } },
    @Body() body: PayeeDto,
  ) {
    return this.payments.createPayee(req.user.sub, body);
  }

  @Patch("payees/:id")
  updatePayee(
    @Req() req: { user: { sub: string } },
    @Param("id") id: string,
    @Body() body: PayeePatchDto,
  ) {
    return this.payments.updatePayee(req.user.sub, id, body);
  }

  @Delete("payees/:id")
  deletePayee(
    @Req() req: { user: { sub: string } },
    @Param("id") id: string,
  ) {
    return this.payments.deletePayee(req.user.sub, id);
  }

  @Get("disputes")
  listDisputes(@Req() req: { user: { sub: string } }) {
    return this.payments.listDisputes(req.user.sub);
  }

  @Get("disputes/:id")
  getDispute(
    @Req() req: { user: { sub: string } },
    @Param("id") id: string,
  ) {
    return this.payments.getDispute(req.user.sub, id);
  }

  @Post("disputes")
  dispute(@Req() req: { user: { sub: string } }, @Body() body: DisputeDto) {
    return this.payments.raiseDispute(req.user.sub, body);
  }

  @Post("transfer")
  transfer(
    @Req() req: { user: { sub: string } },
    @Body() body: TransferDto,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.payments.initiateTransfer(req.user.sub, {
      ...body,
      idempotencyKey,
    });
  }

  @Post("bill")
  bill(
    @Req() req: { user: { sub: string } },
    @Body() body: BillDto,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.payments.payBill(req.user.sub, { ...body, idempotencyKey });
  }

  @Post("internal-transfer")
  internalTransfer(
    @Req() req: { user: { sub: string } },
    @Body() body: InternalTransferDto,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.payments.internalTransfer(req.user.sub, {
      ...body,
      idempotencyKey,
    });
  }

  @Post(":id/release")
  release(
    @Req() req: { user: { sub: string } },
    @Param("id") id: string,
    @Body() body: ReleaseDto,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.payments.releaseHeld(
      req.user.sub,
      id,
      body.mfaChallengeId,
      idempotencyKey,
    );
  }

  @Post(":id/reject")
  reject(
    @Req() req: { user: { sub: string } },
    @Param("id") id: string,
    @Body() body: RejectDto,
  ) {
    return this.payments.rejectHeld(req.user.sub, id, body.freezeCard);
  }

  @Get(":id")
  getOne(@Req() req: { user: { sub: string } }, @Param("id") id: string) {
    return this.payments.getOne(req.user.sub, id);
  }
}
