import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
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
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException("Invalid token");
    }
  }
}
