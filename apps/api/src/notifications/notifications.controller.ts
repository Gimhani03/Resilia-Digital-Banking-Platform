import { Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { AuthGuard } from "../identity/auth.guard";

@Controller("notifications")
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Req() req: { user: { sub: string } }) {
    return this.notifications.list(req.user.sub);
  }

  @Post("read-all")
  readAll(@Req() req: { user: { sub: string } }) {
    return this.notifications.markAllRead(req.user.sub);
  }

  @Post(":id/read")
  read(@Req() req: { user: { sub: string } }, @Param("id") id: string) {
    return this.notifications.markRead(req.user.sub, id);
  }
}
