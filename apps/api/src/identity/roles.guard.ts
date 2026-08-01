import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";

export const ROLES_KEY = "roles";
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Authenticates JWT (and session) then enforces @Roles(...).
 * Use as @UseGuards(RolesGuard) @Roles("OFFICER") on officer-only routes.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    if (!req.user) {
      const header = req.headers.authorization as string | undefined;
      if (!header?.startsWith("Bearer ")) {
        throw new UnauthorizedException("Missing token");
      }
      try {
        const payload = this.jwt.verify(header.slice(7)) as {
          sub: string;
          username: string;
          role: string;
          name: string;
          jti?: string;
        };
        if (payload.jti) {
          const session = await this.prisma.session.findUnique({
            where: { tokenJti: payload.jti },
          });
          if (session?.revoked) {
            throw new UnauthorizedException("Session revoked");
          }
          if (session && session.expiresAt < new Date()) {
            throw new UnauthorizedException("Session expired");
          }
        }
        req.user = payload;
      } catch (err) {
        if (err instanceof UnauthorizedException) throw err;
        throw new UnauthorizedException("Invalid token");
      }
    }

    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenException("Officer role required");
    }
    return true;
  }
}

/** Convenience alias for officer-only routes used with AuthGuard. */
@Injectable()
export class OfficerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (req.user?.role !== "OFFICER") {
      throw new ForbiddenException("Officer role required");
    }
    return true;
  }
}
