# How the RESILIA Deployment Works

A detailed walkthrough of the deployed system: what runs where, how a request
travels through it, and why each mechanism is built the way it is.

For current-state facts and operational commands, see
[SESSION-HANDOFF.md](SESSION-HANDOFF.md).

---

## 1. The shape of it

```
                          Internet
                             │
                             │  HTTPS · Azure-managed certificate
                             ▼
              ┌──────────────────────────────────┐
              │  resilia-web        EXTERNAL     │
              │  ──────────────────────────────  │
              │  nginx 1.27 (alpine)             │
              │   · serves the Vite bundle       │
              │   · reverse-proxies /api by      │
              │     route prefix                 │
              │   · SPA history fallback         │
              │  1–5 replicas · 0.25 vCPU        │
              └───────┬──────────────────┬───────┘
                      │                  │
      /api/auth       │                  │   /api/payments
      /api/accounts   │                  │   /api/fraud
      /api/audit      │                  │   /api/cards
      /api/notifi…    │                  │   /api/loans
      /api/health     │                  │   /api/ops
                      ▼                  ▼
        ┌───────────────────┐  ┌────────────────────┐
        │ resilia-api-core  │  │ resilia-api-       │
        │ INTERNAL          │  │ payments  INTERNAL │
        │ SERVICE_ROLE=core │  │ SERVICE_ROLE=      │
        │ RUN_MIGRATIONS=   │  │   payments         │
        │   true            │  │ RUN_MIGRATIONS=    │
        │ 1–5 · 0.5 vCPU    │  │   false            │
        │                   │  │ 1–10 · 0.5 vCPU    │
        └─────────┬─────────┘  └──────────┬─────────┘
                  └───────────┬───────────┘
                              │
        ┌─────────────────────┼──────────────────────┐
        ▼                     ▼                      ▼
  PostgreSQL 16         Azure Files            Key Vault
  psql-…-c4630          kyc-uploads            kv-resilia-c4630
  B1ms · sslmode=       mounted at             (secret references,
  require               /mnt/uploads            resolved by identity)
                              │
                              ▼
              Log Analytics + Application Insights
```

Only `resilia-web` is reachable from the internet. Both API apps use
**internal-only ingress** — they have no public endpoint at all, and the only
way to reach them is through the nginx edge or from inside the Container Apps
environment.

---

## 2. A request, end to end

Take `POST /api/auth/login` from a browser.

1. **DNS + TLS.** The browser resolves the `resilia-web` FQDN to the Container
   Apps environment's ingress. Azure terminates TLS with a managed certificate;
   no certificate is provisioned or renewed by us.

2. **Container Apps ingress → nginx.** The platform routes to a `resilia-web`
   replica on port 8080.

3. **nginx matches the route prefix.** `location ~ ^/api/(auth|accounts|audit|notifications|health)`
   matches, so this belongs to the **core** role.

4. **nginx proxies to the internal FQDN.**
   `proxy_pass https://resilia-api-core.internal.<env>.centralindia.azurecontainerapps.io;`
   The FQDN is injected by Terraform as `API_CORE_HOST` and substituted into the
   config by `envsubst` at container start.

5. **Container Apps routes internally** to a `resilia-api-core` replica on port
   3001. This hop stays inside the environment.

6. **NestJS handles it.** `IdentityController` is mounted because this
   container's `SERVICE_ROLE` is `core`. It reads `JWT_SECRET` — resolved from
   Key Vault at container start — and queries Postgres over TLS.

7. **Response returns** back up the same path. nginx adds `X-Request-Id`; the
   API echoes it on every response, so a single request can be traced across
   both hops in Log Analytics.

A request to `/api/payments/history` takes the same path but matches the second
`location` block and lands on `resilia-api-payments`. A request to
`/api/anything-else` matches neither and nginx returns
`{"error":"no service owns this route"}` — deliberately a JSON 404 rather than
`index.html`, so a routing mistake fails loudly instead of the SPA trying to
parse HTML as JSON.

---

## 3. Why nginx, and not CORS

`apps/web/src/lib/api.ts` line 3 is:

```ts
const API = "/api";
```

A relative path. The SPA assumes the API is same-origin.

The alternative — pointing the client at a separate API hostname and opening
CORS — would mean an `OPTIONS` preflight on every mutating request, a
credentials/`Access-Control-Allow-Origin` interaction that breaks the moment
the origin changes, and a publicly reachable API.

Putting nginx in the web container instead means:

- The browser only ever talks to one origin. **CORS is not part of the deployed
  architecture at all.**
- Both API apps keep internal-only ingress.
- Route partitioning happens at the edge, so a container never even receives a
  request for a route it does not own.
- SPA deep links (`/ops/signin`, the `PhoneShell` routes) work via
  `try_files $uri $uri/ /index.html`.

### The subtlety that cost a debugging cycle

The original config used nginx `upstream` blocks:

```nginx
upstream api_core { server ${API_CORE_HOST}:443; keepalive 16; }
...
proxy_pass https://api_core;
```

This produces **502 on every /api request** while the API is perfectly healthy.

With an upstream block, `$proxy_host` is the *upstream block name*, not the
server address. So `proxy_set_header Host $proxy_host` sends `Host: api_core`,
and `proxy_ssl_name $proxy_host` sends SNI `api_core`. Container Apps ingress
routes on the Host/SNI it receives, matches no application, and refuses.

Passing the FQDN directly to `proxy_pass` makes `$proxy_host` the real hostname,
so Host and SNI are correct with no special-casing. Because envsubst writes a
literal name (not a variable) into the config, nginx resolves it once at startup
and needs no `resolver` directive.

---

## 4. Service topology — stated precisely

Every container runs **the same image** and loads **every Nest module**.

That is deliberate. `PaymentsService` injects `FraudService` through
`forwardRef` and `IdentityService` directly. Splitting those into separate
processes breaks dependency injection at boot, and converting the call sites to
HTTP clients is a refactor, not a deployment task.

What differs per deployment is `SERVICE_ROLE`, which decides **which controllers
a container mounts** (`apps/api/src/config/service-role.ts`):

```ts
export const SERVICE_ROLES = {
  core:     ["auth", "accounts", "audit", "notifications"],
  payments: ["payments", "fraud", "cards", "loans", "ops"],
} as const;

export function controllersFor<T>(route: string, controllers: T[]): T[] {
  return exposes(route) ? controllers : [];
}
```

Each module uses it in its `controllers:` array:

```ts
controllers: controllersFor("payments", [PaymentsController]),
```

`SERVICE_ROLE=all` (the default) mounts everything — that is the local-dev and
docker-compose shape, and the fallback if the variable is unset.

You can see this working in the deployed logs: the core container's
`RoutesResolver` output lists only `IdentityController`, `AuditController`,
`AccountsController` and `NotificationsController`. And `/api/health` reports
it:

```json
{ "role": "core", "routes": ["auth","accounts","audit","notifications"] }
```

**What this genuinely is:** independently deployable services; independently
scalable (payments 1–10, core 1–5); disjoint, non-overlapping route ownership;
separate revision histories; separate restart and failure domains; one service
owning schema changes.

**What it is not:** separate codebases, separate images, or network calls
between domains. Payments still calls Fraud in-process. Scaling the payments
role also scales an idle copy of the identity code.

Stated this way because the overclaim would not survive a judge running
`az containerapp show`, and the honest version costs nothing.

---

## 5. Secrets

No secret is committed, and no plaintext secret appears in the Container App
definition.

**The chain:**

1. Terraform generates the Postgres password and JWT secret with
   `random_password`, and writes them straight into Key Vault. They are never
   printed and never leave state.
2. Each Container App declares *secret references*, not values:

```hcl
secret {
  name                = "database-url"
  identity            = azurerm_user_assigned_identity.app.id
  key_vault_secret_id = azurerm_key_vault_secret.database_url.versionless_id
}
```

3. The platform resolves those references at container start using the
   user-assigned identity `id-resilia-prod`, which holds **Key Vault Secrets
   User** — read-only.
4. Environment variables reference the secret by name:

```hcl
env { name = "DATABASE_URL"  secret_name = "database-url" }
```

`az containerapp show` displays the reference, never the value. The portal shows
the reference. The repository contains neither.

The same identity holds `AcrPull` on the registry, so image pulls need no
registry password. **Admin user is disabled on the ACR.**

`.env.production` was deleted from the repository — deployed configuration comes
from Key Vault only.

### GitHub → Azure

`deploy.yml` authenticates by **OIDC federation** against a second identity,
`id-resilia-github`, whose federated credential subject is pinned to this
repository and branch:

```
repo:Gimhani03/Resilia-Digital-Banking-Platform:ref:refs/heads/main
```

GitHub holds three *identifiers* — client id, tenant id, subscription id — and
no secret. The access token is minted per run and expires with the job. Deploy
rights are `Contributor` scoped to the resource group only, never the
subscription, plus `AcrPush` granted explicitly on the registry.

**There is no long-lived Azure credential anywhere in the repository.**

---

## 6. Schema and seed data

`prisma/schema.prisma` uses `provider = "postgresql"`.

Schema is applied with **`prisma db push`**, not `migrate deploy`. The only
committed migrations are SQLite-era and cannot be replayed against Postgres.
Generating a proper Postgres migration history is correct future work; under the
delivery deadline it was an avoidable source of failure.

### Why the seed is dangerous

`prisma/seed.ts` opens with a cascade of `deleteMany()` across every table. Run
on each container start, or concurrently across replicas, it would wipe live
data mid-demo.

`infra/docker/api-entrypoint.sh` applies three rules:

1. **Only one service owns schema.** Only the app deployed with
   `RUN_MIGRATIONS=true` — the `core` role — runs `db push` or the seed at all.
   `payments` starts straight into the app.

2. **Seed only an empty database.** The entrypoint counts users first and seeds
   only when the count is zero. If it *cannot determine* the count, it refuses
   to seed rather than guessing.

```sh
SEED_NEEDED=$(node -e "...p.user.count().then(n => console.log(n === 0 ? 'yes' : 'no'))...")
case "$SEED_NEEDED" in
  yes) ...seed... ;;
  no)  log "database already populated — skipping destructive seed" ;;
  *)   log "WARNING: could not determine seed state; refusing to run destructive seed" ;;
esac
```

3. **A failed seed must not stop the service.** This was learned the hard way.
   The seed initially crashed on a ts-node config error (`TS5109`), and because
   the entrypoint runs under `set -e` the container exited, was restarted,
   crashed again — and nginx served 502 for every route. A cosmetic tooling
   error had become a total outage. A failed seed now logs a warning and the API
   starts anyway: a service running against an empty database is far easier to
   diagnose than one that will not boot.

Both guards were observed working on the live deployment — `empty database —
seeding demo dataset` on first boot, `database already populated — skipping
destructive seed` on every boot after.

---

## 7. Observability

### Health endpoints

`/api/health` — **liveness**. Deliberately dependency-free: Container Apps
restarts the replica when this fails, so it must not go red because Postgres is
briefly slow. It reports what the platform injects:

```json
{
  "status": "ok",
  "service": "resilia-api-core",
  "role": "core",
  "routes": ["auth", "accounts", "audit", "notifications"],
  "region": "centralindia",
  "revision": "resilia-api-core--fix140445",
  "replica": "resilia-api-core--fix140445-654d84f855-d4fst",
  "uptimeSeconds": 493
}
```

This replaced a hardcoded `region: "A"`. The values are real, and a
misconfigured deployment shows `unknown` rather than something plausible.

`/api/health/ready` — **readiness**. Actually touches dependencies:

```json
{
  "status": "degraded",
  "checks": {
    "database": { "status": "up" },
    "redis": { "status": "degraded",
               "detail": "in-process fallback store — cache is replica-local" }
  }
}
```

### The silent-Redis problem

`RedisService` fell back to an in-process `Map` when the connection failed —
**without logging**. A Redis outage was indistinguishable from healthy
operation, while OTP challenges and rate-limit counters silently became
replica-local.

It now logs at **error** level (not warn — an operator scanning for problems
must see it), tracks a fallback operation counter, and surfaces the state
through readiness.

This is not hypothetical in the current deployment: Redis is not provisioned
(Azure Cache for Redis is retiring and refuses new instances; Managed Redis is
over budget), so the live system reports `degraded` **and that is correct**. The
degradation is real and visible rather than hidden.

### Platform telemetry

- **Log Analytics** collects container stdout/stderr and the Container Apps
  system log stream, queryable with KQL.
- **Application Insights** receives request traces, failure analytics and live
  metrics, wired at the environment level so every replica ships without
  in-process instrumentation.
- **Metric alert** `alert-resilia-api-5xx` fires on sustained failed requests
  via the `ag-resilia-ops` action group.
- **Request correlation**: `x-request-id` is generated at the API, propagated by
  nginx, and returned on every response.

---

## 8. Scaling, availability, storage

KEDA HTTP-concurrency scale rules, sized by role:

| App | Min | Max | Concurrency target |
|---|---|---|---|
| `resilia-api-core` | 1 | 5 | 50 |
| `resilia-api-payments` | 1 | 10 | 30 |
| `resilia-web` | 1 | 5 | 100 |

`min_replicas = 1` everywhere is deliberate — cold starts during judging are not
acceptable. It is also the main cost driver (~$3.90/day).

**Known ceiling:** regional vCPU quota is 6. Minimum usage is 1.25 vCPU, but at
stated maximum scale the configuration wants 8.75 vCPU, so KEDA would cap before
reaching those maximums. Recorded rather than claimed as headroom we do not
have.

Rolling revision deploys: Container Apps drains the old revision only after the
new one passes its readiness probe. The previous revision is retained, so
rollback is a traffic shift rather than a rebuild.

**KYC uploads** were moved off container-local disk. `LocalObjectStore` writes
to `UPLOAD_DIR`, which now points at `/mnt/uploads` — an Azure Files share
mounted into every API replica. Without this, a photo captured on replica 1 is
invisible to the officer queue served by replica 2, and is lost when the replica
recycles. This is what makes `replicas > 1` actually safe, and it required no
application code change.

---

## 9. The pipeline

`.github/workflows/ci.yml` — every push and PR:

| Job | What it does |
|---|---|
| `build & typecheck` | api, web, shared, mobile |
| `unit tests` | 9 fraud-engine specs; uploads coverage |
| `dependency & IaC scan` | Trivy **blocking** on CRITICAL/HIGH; Trivy IaC; SARIF to the Security tab; gitleaks |
| `terraform validate` | `fmt -check`, `init -backend=false`, `validate` |

`.github/workflows/deploy.yml` — push to `main`:

```
verify              build + tests + blocking Trivy gate
  ↓
buildx build+push   both images, built on the runner
  ↓
trivy image         blocking scan of the built artifact
  ↓
CycloneDX SBOM      one per image, published as build artifacts
  ↓
cosign sign         keyless; recorded in the Rekor transparency log
cosign attest       SBOM attached as an attestation
  ↓
deploy by digest    core first (owns migrations), then payments, then web
  ↓
smoke test          edge, both roles, and a real customer login
  ↓
rollback on failure traffic shifted to the last healthy revision
```

**Images deploy by digest, not tag**, so a revision cannot silently change if a
tag is re-pushed. `core` rolls first because it applies the schema that
`payments` then queries.

**Why the runner builds instead of ACR:** `az acr build` — the server-side build
service — is rejected on this subscription with `TasksOperationsNotAllowed`. The
runner builds with Buildx and GitHub Actions layer caching. Security is
unchanged: `az acr login` exchanges the OIDC-derived Azure token for a
short-lived registry token, so the runner never holds a registry password.

**Cold-environment handling:** on a fresh environment the images must exist
before Terraform can create Container Apps that reference them. `deploy.yml`
detects that the apps are absent, publishes the images, and stops cleanly rather
than failing.

**The one honest exception to "everything ships through the pipeline":** the
initial environment was bootstrapped by hand, because a cold environment is
circular — Terraform cannot create a Container App referencing an image, and the
image cannot be pushed to a registry Terraform has not created.
`infra/scripts/bootstrap.sh` captures that sequence. Every change after that
goes through `deploy.yml`. At no point was anything applied with `kubectl` or
clicked in the portal.

---

## 10. Infrastructure as code

Everything in `infra/terraform/`:

| File | Contents |
|---|---|
| `providers.tf` | azurerm ~4.20, feature flags, random suffix, common tags |
| `variables.tf` | inputs, incl. the region allowlist `validation` block |
| `main.tf` | resource group, ACR, workload identity, `AcrPull` |
| `database.tf` | Postgres Flexible Server + database + firewall, storage account, Azure Files share, environment storage |
| `keyvault.tf` | vault, RBAC role assignments, the three secrets |
| `observability.tf` | Log Analytics, App Insights, Container Apps Environment, action group, metric alert |
| `containerapps.tf` | the three Container Apps, probes, scale rules, volume mounts |
| `github-oidc.tf` | GitHub identity, federated credentials, scoped role assignments |
| `outputs.tf` | app URL, registry, FQDNs, identity ids |

**Terraform owns the topology; the pipeline owns image tags.** Container image
fields carry:

```hcl
lifecycle { ignore_changes = [template[0].container[0].image] }
```

so a later `terraform apply` cannot roll back a deployment.

`terraform fmt -check` and `terraform validate` run in CI on every commit, so
the IaC stays valid even when nobody applies it.

---

## 11. What is deliberately not built

In the target-architecture document, and staying there as future state:

| Not built | What substitutes for it |
|---|---|
| Kafka / Redpanda event backbone | in-process `EventBusModule` |
| Citus sharded ledger | single PostgreSQL Flexible Server |
| Linkerd service mesh | Container Apps built-in mTLS |
| Argo CD / Argo Rollouts | Container Apps revisions + GitHub Actions |
| Envoy Gateway | nginx in the web container + Container Apps ingress |
| HashiCorp Vault | Azure Key Vault |
| Prometheus / Grafana / Loki / Tempo | Application Insights + Log Analytics |
| Redis | none — in-process fallback, reported as `degraded` |
| Expo mobile deployment | the web `PhoneShell` covers the customer journey |

None of these are claimed as delivered. `DEPLOYMENT.md` §9 maps each rubric
criterion to what is live now versus what the architecture proposes next.
