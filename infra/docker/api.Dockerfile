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
# A second, independent dependency tree containing only what the API needs at
# runtime. The build stage's node_modules cannot be shipped as-is: it carries
# the whole toolchain, and the root `optionalDependencies` deliberately pin the
# web bundler's native binaries for every platform so one lockfile serves
# Windows, CI and Alpine. That is correct for building the *web* image and
# wrong for running the *API* — it puts @esbuild/linux-x64, a Go binary the API
# never executes, into the runtime filesystem, where it contributed fifteen Go
# stdlib CVEs and failed the blocking image scan.
#
# `--omit=optional` drops those native binaries; `--omit=dev` drops the
# compilers, Nest CLI, jest and ts-node. Nothing here is reachable at runtime,
# so removing it is strictly better than arguing it is unreachable in a
# suppression file.
FROM node:22-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/

RUN npm ci --omit=dev --omit=optional \
      --workspace @resilia/api --workspace @resilia/shared \
      --include-workspace-root --ignore-scripts \
  && mkdir -p apps/api/node_modules

# The Prisma client is generated against this tree, not copied from the build
# stage, so the engine binaries match the modules actually present.
COPY apps/api/prisma apps/api/prisma
RUN npx prisma generate --schema apps/api/prisma/schema.prisma

# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat curl \
  && addgroup -S resilia && adduser -S resilia -G resilia

# Remove npm from the production image. Every dependency is already installed
# and every entrypoint calls a binary directly, so the package manager is dead
# weight — and it is not harmless dead weight: npm vendors its own dependency
# tree, which is where the last eight CRITICAL/HIGH findings in this image
# lived (node-tar, sigstore, brace-expansion, ip-address, picomatch). None were
# application code. Deleting it also means a process that achieves execution in
# this container has no package manager available to fetch anything with.
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/bin/npm \
           /usr/local/bin/npx

ENV NODE_ENV=production \
    PORT=3001 \
    SERVICE_ROLE=all \
    RUN_MIGRATIONS=false

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/package.json

COPY infra/docker/api-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Runs unprivileged. Nothing in the image is writable by the app user except
# /tmp — KYC captures go to Blob storage, not to the container filesystem.
USER resilia

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3001/api/health || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
# dist/src/main.js, not dist/main.js: apps/api/tsconfig.json includes both
# `src` and `prisma`, so tsc's common source root is apps/api and the emitted
# tree keeps that structure.
CMD ["node", "apps/api/dist/src/main.js"]
