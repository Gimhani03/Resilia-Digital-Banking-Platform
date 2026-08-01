import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import helmet from "helmet";
import { randomUUID } from "crypto";
import { AppModule } from "./app.module";
import { isDemoMode } from "./config/fee.config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger("Bootstrap");

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use((req: any, res: any, next: () => void) => {
    const id = (req.headers["x-request-id"] as string) || randomUUID();
    req.requestId = id;
    res.setHeader("x-request-id", id);
    next();
  });

  const origins = (process.env.CORS_ORIGINS || "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.includes("*") ? true : origins,
    credentials: true,
  });

  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidUnknownValues: false }),
  );

  if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET required in production");
  }

  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
  logger.log(`RESILIA API on :${port} · demoMode=${isDemoMode()}`);
}

bootstrap();
