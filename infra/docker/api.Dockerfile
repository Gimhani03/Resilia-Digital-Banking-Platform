# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# RESILIA API — one image, every Nest module, role selected at runtime by
# SERVICE_ROLE. Built from the monorepo root so the @resilia/shared workspace
# link resolves the same way it does locally.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/

# --ignore-scripts keeps the mobile workspace's postinstall out of the build.
RUN npm ci --workspace @resilia/api --workspace @resilia/shared --include-workspace-root --ignore-scripts

# ---------------------------------------------------------------------------
FROM deps AS build
WORKDIR /app

COPY packages/shared packages/shared
COPY apps/api apps/api

RUN npm run build --workspace @resilia/shared
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build --workspace @resilia/api

# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat curl \
  && addgroup -S resilia && adduser -S resilia -G resilia

ENV NODE_ENV=production \
    PORT=3001 \
    SERVICE_ROLE=all \
    RUN_MIGRATIONS=false

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules

COPY infra/docker/api-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Runs unprivileged. Nothing in the image is writable by the app user except
# /tmp — KYC captures go to Blob storage, not to the container filesystem.
USER resilia

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3001/api/health || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "apps/api/dist/main.js"]
