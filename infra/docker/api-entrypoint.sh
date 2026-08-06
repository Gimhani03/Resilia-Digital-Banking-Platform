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
  #
  # Invoked through the installed binary rather than `npx`, because npm is
  # deleted from the production image — see api.Dockerfile.
  ./node_modules/.bin/prisma db push \
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
      # The compiled seed, not ts-node against the .ts source. apps/api's
      # tsconfig includes `prisma` alongside `src`, so `nest build` already
      # emits dist/prisma/seed.js — the TypeScript toolchain was never actually
      # needed at runtime, only assumed to be. Running the compiled artefact
      # lets the runtime image drop every dev dependency, and removes the
      # ts-node config resolution that caused the TS5109 crash loop in the
      # first place.
      #
      # A seed failure must still not take the service down. Without `|| ...`
      # the `set -e` above turns it into a crash loop, which is how a cosmetic
      # error becomes a total outage — the API never starts, and nginx serves
      # 502 for every route.
      if node apps/api/dist/prisma/seed.js; then
        log "seed complete"
      else
        log "WARNING: seed failed — starting API anyway against an empty database"
      fi
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
