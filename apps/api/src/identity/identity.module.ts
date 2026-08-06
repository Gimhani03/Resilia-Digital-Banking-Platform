import { controllersFor } from "../config/service-role";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { IdentityService } from "./identity.service";
import { IdentityController } from "./identity.controller";
import { AuthGuard } from "./auth.guard";
import { RolesGuard } from "./roles.guard";

const jwtSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === "production" && !jwtSecret) {
  throw new Error("JWT_SECRET is required in production");
}

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: jwtSecret || "resilia-dev-jwt-secret-change-me",
      signOptions: { expiresIn: "15m" },
    }),
  ],
  providers: [IdentityService, AuthGuard, RolesGuard],
  controllers: controllersFor("auth", [IdentityController]),
  exports: [IdentityService, AuthGuard, RolesGuard],
})
export class IdentityModule {}
