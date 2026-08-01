import { Module } from "@nestjs/common";
import { CardsService } from "./cards.service";
import { CardsController } from "./cards.controller";
import { AuthGuard } from "../identity/auth.guard";

@Module({
  providers: [CardsService, AuthGuard],
  controllers: [CardsController],
  exports: [CardsService],
})
export class CardsModule {}
