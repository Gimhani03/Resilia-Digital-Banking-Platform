import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  health() {
    return {
      status: "ok",
      service: "resilia-api-gateway",
      region: "A",
      timestamp: new Date().toISOString(),
    };
  }
}
