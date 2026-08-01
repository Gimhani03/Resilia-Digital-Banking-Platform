import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { IsString } from "class-validator";
import { AccountsService } from "./accounts.service";
import { AuthGuard } from "../identity/auth.guard";

class NicknameDto {
  @IsString() nickname!: string;
}

@Controller("accounts")
@UseGuards(AuthGuard)
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  list(@Req() req: { user: { sub: string } }) {
    return this.accounts.list(req.user.sub);
  }

  @Get("dashboard")
  dashboard(@Req() req: { user: { sub: string } }) {
    return this.accounts.dashboard(req.user.sub);
  }

  @Get(":id")
  detail(@Req() req: { user: { sub: string } }, @Param("id") id: string) {
    return this.accounts.detail(req.user.sub, id);
  }

  @Patch(":id")
  update(
    @Req() req: { user: { sub: string } },
    @Param("id") id: string,
    @Body() body: NicknameDto,
  ) {
    return this.accounts.updateNickname(req.user.sub, id, body.nickname);
  }

  @Post(":id/freeze")
  freeze(@Req() req: { user: { sub: string } }, @Param("id") id: string) {
    return this.accounts.freezeAccount(req.user.sub, id);
  }

  @Post(":id/unfreeze")
  unfreeze(@Req() req: { user: { sub: string } }, @Param("id") id: string) {
    return this.accounts.unfreezeAccount(req.user.sub, id);
  }
}
