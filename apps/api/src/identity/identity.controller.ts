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
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { IdentityService } from "./identity.service";
import { AuthGuard } from "./auth.guard";

class LoginDto {
  @IsString() username!: string;
  @IsString() password!: string;
  @IsString() deviceFingerprint!: string;
  @IsOptional() @IsString() deviceName?: string;
  @IsOptional() @IsString() platform?: string;
  @IsOptional() @IsString() location?: string;
}

class VerifyMfaDto {
  @IsString() challengeId!: string;
  @IsString() code!: string;
  @IsString() method!: string;
  @IsString() deviceFingerprint!: string;
}

class OnboardDto {
  @IsString() fullName!: string;
  @IsString() nationalId!: string;
  @IsString() username!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() documentType!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() documentBase64?: string;
  @IsOptional() @IsString() documentMimeType?: string;
}

class DeviceDecisionDto {
  @IsBoolean() approve!: boolean;
}

class ProfileDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
}

class ChangePasswordDto {
  @IsString() currentPassword!: string;
  @IsString() @MinLength(8) newPassword!: string;
}

class ForgotPasswordDto {
  @IsString() username!: string;
}

class ResetPasswordDto {
  @IsString() username!: string;
  @IsString() token!: string;
  @IsString() @MinLength(8) newPassword!: string;
}

class StepUpDto {
  @IsIn(["TRANSFER", "BILL", "RELEASE", "FREEZE", "DISPUTE"])
  purpose!: "TRANSFER" | "BILL" | "RELEASE" | "FREEZE" | "DISPUTE";
  @IsOptional() @IsObject() meta?: Record<string, unknown>;
}

class RefreshDto {
  @IsString() refreshToken!: string;
}

class LogoutDto {
  @IsOptional() @IsString() refreshToken?: string;
}

class KycUploadDto {
  @IsString() documentType!: string;
  @IsString() mimeType!: string;
  @IsString() base64!: string;
  @IsOptional() @IsString() fileName?: string;
}

@Controller("auth")
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post("login")
  login(@Body() body: LoginDto) {
    return this.identity.login(body);
  }

  @Post("mfa/verify")
  verify(@Body() body: VerifyMfaDto) {
    return this.identity.verifyMfa(body);
  }

  @Post("refresh")
  refresh(@Body() body: RefreshDto) {
    return this.identity.refresh(body.refreshToken);
  }

  @Post("onboard")
  onboard(@Body() body: OnboardDto) {
    return this.identity.onboard(body);
  }

  @Post("forgot-password")
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.identity.forgotPassword(body.username);
  }

  @Post("reset-password")
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.identity.resetPassword(body);
  }

  @UseGuards(AuthGuard)
  @Get("me")
  me(@Req() req: { user: { sub: string } }) {
    return this.identity.me(req.user.sub);
  }

  @UseGuards(AuthGuard)
  @Patch("profile")
  updateProfile(
    @Req() req: { user: { sub: string } },
    @Body() body: ProfileDto,
  ) {
    return this.identity.updateProfile(req.user.sub, body);
  }

  @UseGuards(AuthGuard)
  @Post("change-password")
  changePassword(
    @Req() req: { user: { sub: string } },
    @Body() body: ChangePasswordDto,
  ) {
    return this.identity.changePassword(
      req.user.sub,
      body.currentPassword,
      body.newPassword,
    );
  }

  @UseGuards(AuthGuard)
  @Post("logout")
  logout(
    @Req() req: { user: { sub: string; jti?: string } },
    @Body() body: LogoutDto,
  ) {
    return this.identity.logout(req.user.sub, req.user.jti, body.refreshToken);
  }


  @UseGuards(AuthGuard)
  @Post("kyc/upload")
  uploadKyc(
    @Req() req: { user: { sub: string } },
    @Body() body: KycUploadDto,
  ) {
    return this.identity.uploadKycDocument(req.user.sub, body);
  }

  @UseGuards(AuthGuard)
  @Post("mfa/step-up")
  stepUp(
    @Req() req: { user: { sub: string } },
    @Body() body: StepUpDto,
  ) {
    return this.identity.createStepUp(req.user.sub, body.purpose, body.meta);
  }

  @UseGuards(AuthGuard)
  @Get("devices")
  devices(@Req() req: { user: { sub: string } }) {
    return this.identity.listDevices(req.user.sub);
  }

  @UseGuards(AuthGuard)
  @Post("devices/:id/decide")
  decide(
    @Req() req: { user: { sub: string } },
    @Param("id") id: string,
    @Body() body: DeviceDecisionDto,
  ) {
    return this.identity.decideDevice(req.user.sub, id, body.approve);
  }

  @UseGuards(AuthGuard)
  @Post("devices/:id/revoke")
  revoke(
    @Req() req: { user: { sub: string } },
    @Param("id") id: string,
  ) {
    return this.identity.revokeDevice(req.user.sub, id);
  }
}
