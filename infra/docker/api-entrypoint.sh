#!/bin/sh
# ---------------------------------------------------------------------------
# API container entrypoint.
#
# Schema and seed are owned by exactly one service — the role deployed with
# RUN_MIGRATIONS=true. Every other replica and every other role starts straight
# into the app. This matters because prisma/seed.ts opens with a cascade of
# deleteMany(): running it on each container start, or concurrently across
# replicas, would wipe live data mid-demo.
# ---------------------------------------------------------------------------
set -e

log() { echo "[entrypoint] $*"; }

if [ "$RUN_MIGRATIONS" = "true" ]; then
  log "role=${SERVICE_ROLE:-all} owns schema — applying with prisma db push"

  # `db push` rather than `migrate deploy`: the committed migration history is
  # SQLite-era and cannot be replayed against Postgres. See DEPLOYMENT.md.
  npx prisma db push \
    --schema apps/api/prisma/schema.prisma \
    --skip-generate \
    --accept-data-loss

  log "schema in sync — checking whether seed data already exists"

  # The guard lives here rather than in seed.ts so that the destructive seed is
  # never even loaded on an already-populated database.
  SEED_NEEDED=$(node -e "
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    p.user.count()
      .then(n => { console.log(n === 0 ? 'yes' : 'no'); return p.\$disconnect(); })
      .catch(e => { console.error(e.message); console.log('error'); process.exit(0); });
  ")

  case "$SEED_NEEDED" in
    yes)
      log "empty database — seeding demo dataset"
      npx ts-node --transpile-only apps/api/prisma/seed.ts
      log "seed complete"
      ;;
    no)
      log "database already populated — skipping destructive seed"
      ;;
    *)
      log "WARNING: could not determine seed state; refusing to run destructive seed"
      ;;
  esac
else
  log "role=${SERVICE_ROLE:-all} does not own schema — skipping migrate/seed"
fi

log "starting API · role=${SERVICE_ROLE:-all} · revision=${CONTAINER_APP_REVISION:-local}"
exec "$@"
