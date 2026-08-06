import { controllersFor } from "../config/service-role";
import { Module } from "@nestjs/common";
import { CardsService } from "./cards.service";
import { CardsController } from "./cards.controller";
import { AuthGuard } from "../identity/auth.guard";

@Module({
  providers: [CardsService, AuthGuard],
  controllers: controllersFor("cards", [CardsController]),
  exports: [CardsService],
})
export class CardsModule {}
