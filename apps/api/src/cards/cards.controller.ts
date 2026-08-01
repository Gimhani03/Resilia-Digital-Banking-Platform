import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { IsBoolean, IsNumber, IsOptional, IsString, Matches } from "class-validator";
import { CardsService } from "./cards.service";
import { AuthGuard } from "../identity/auth.guard";

class ControlsDto {
  @IsOptional() @IsNumber() dailyLimit?: number;
  @IsOptional() @IsBoolean() online?: boolean;
  @IsOptional() @IsBoolean() contactless?: boolean;
  @IsOptional() @IsBoolean() international?: boolean;
}

class PinDto {
  @IsString()
  @Matches(/^\d{4}$/, { message: "PIN must be exactly 4 digits" })
  pin!: string;
}

@Controller("cards")
@UseGuards(AuthGuard)
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get()
  list(@Req() req: { user: { sub: string } }) {
    return this.cards.list(req.user.sub);
  }

  @Post(":id/freeze")
  freeze(@Req() req: { user: { sub: string } }, @Param("id") id: string) {
    return this.cards.freeze(req.user.sub, id);
  }

  @Post(":id/unfreeze")
  unfreeze(@Req() req: { user: { sub: string } }, @Param("id") id: string) {
    return this.cards.unfreeze(req.user.sub, id);
  }

  @Post(":id/pin")
  setPin(
    @Req() req: { user: { sub: string } },
    @Param("id") id: string,
    @Body() body: PinDto,
  ) {
    return this.cards.setPin(req.user.sub, id, body.pin);
  }

  @Patch(":id")
  update(
    @Req() req: { user: { sub: string } },
    @Param("id") id: string,
    @Body() body: ControlsDto,
  ) {
    return this.cards.updateControls(req.user.sub, id, body);
  }
}
