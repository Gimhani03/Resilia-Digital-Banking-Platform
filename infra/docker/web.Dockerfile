# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# RESILIA web — Vite bundle served by nginx, which also reverse-proxies /api to
# the internal API roles. Built from the monorepo root; @resilia/shared is
# resolved through the Vite alias, so the shared package needs no build step.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/

RUN npm ci --workspace @resilia/web --workspace @resilia/shared --include-workspace-root --ignore-scripts

COPY packages/shared packages/shared
COPY apps/web apps/web

RUN npm run build --workspace @resilia/web

# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

RUN apk add --no-cache curl gettext

COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY infra/docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY infra/docker/proxy-common.inc /etc/nginx/conf.d/proxy-common.inc

# Sensible defaults so the image also runs under docker-compose, where the API
# is a single all-roles container.
ENV API_CORE_HOST=resilia-api-core \
    API_PAYMENTS_HOST=resilia-api-payments

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/healthz || exit 1

# The stock nginx entrypoint envsubst's /etc/nginx/templates/*.template into
# /etc/nginx/conf.d/ at start, which is how the Terraform-supplied upstream
# hostnames reach the config.
