import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";
import { RedisService } from "./redis/redis.module";
import { currentRole, ownedRoutes } from "./config/service-role";

const startedAt = Date.now();

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Liveness. Cheap and dependency-free — Container Apps restarts the replica
   * when this fails, so it must not go red because Postgres is briefly slow.
   */
  @Get()
  health() {
    const role = currentRole();
    return {
      status: "ok",
      service: `resilia-api-${role}`,
      role,
      routes: ownedRoutes(),
      // Container Apps injects these; falling back to "unknown" is honest and
      // makes a misconfigured deployment visible instead of silently plausible.
      region: process.env.AZURE_REGION || process.env.REGION || "unknown",
      revision: process.env.CONTAINER_APP_REVISION || "unknown",
      replica: process.env.CONTAINER_APP_REPLICA_NAME || process.env.HOSTNAME || "unknown",
      containerApp: process.env.CONTAINER_APP_NAME || "unknown",
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness. Actually touches the dependencies, and reports degraded rather
   * than ok when Redis has fallen back to the in-process store — that fallback
   * is otherwise invisible and looks like healthy operation.
   */
  @Get("ready")
  async ready() {
    const checks: Record<string, { status: string; detail?: string }> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: "up" };
    } catch (err) {
      checks.database = { status: "down", detail: (err as Error).message };
    }

    checks.redis = this.redis.usingMemory
      ? { status: "degraded", detail: "in-process fallback store — cache is replica-local" }
      : { status: "up" };

    const degraded = Object.values(checks).some((c) => c.status === "degraded");
    const down = Object.values(checks).some((c) => c.status === "down");

    return {
      status: down ? "down" : degraded ? "degraded" : "ok",
      role: currentRole(),
      revision: process.env.CONTAINER_APP_REVISION || "unknown",
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
