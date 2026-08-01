import { Module, OnModuleInit } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { AuthGuard } from "../identity/auth.guard";

@Module({
  providers: [NotificationsService, AuthGuard],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule implements OnModuleInit {
  constructor(private readonly notifications: NotificationsService) {}
  onModuleInit() {
    this.notifications.subscribe();
  }
}
