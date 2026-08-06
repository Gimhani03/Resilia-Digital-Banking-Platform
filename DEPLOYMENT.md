# RESILIA — Deployment

**Duothan 6.0 Phase 3 · "Restore / Fortify"**

| | |
|---|---|
| **Live application** | `<<LIVE_URL>>` |
| **Repository** | https://github.com/Gimhani03/Resilia-Digital-Banking-Platform |
| **Platform** | Azure Container Apps (Kubernetes-backed), region `southeastasia` |
| **Provisioned by** | Terraform — `infra/terraform/` |
| **Released by** | GitHub Actions — `.github/workflows/deploy.yml` |

`DEPLOYMENT_PLAN.md` is the plan of record and explains *why* each decision was
made. This document records *what is actually running*, and — in §9 — exactly
where the deployed state stops and the target architecture begins.

---

## 1. Demo walkthrough

Everything below is served from the single public URL.

**Customer journey** — open the app root.

| Field | Value |
|---|---|
| Username | `a.perera.2065` |
| Password | `Resilia2065!` |
| OTP | `482916` (deterministic while `DEMO_MODE=true`) |

Sign in → the account dashboard loads balances from `resilia-api-core`. Make a
transfer → the request is served by `resilia-api-payments`, scored by the fraud
engine in-process, and written to the ledger. A transfer at or above LKR 50,000
to a new payee crosses the 70-point threshold and is **held** for review.

**Ops console** — go to `/ops/signin`.

| Field | Value |
|---|---|
| Username | `s.jayasuriya` |
| Password | `OpsConsole2065!` |
| TOTP secret | `JBSWY3DPEHPK3PXP` |

The held transaction appears in the review queue, and the audit trail shows the
hash-chained event written by the fraud service.

**Health endpoints** (proxied through the edge to the internal API):

- `GET /healthz` — nginx edge liveness
- `GET /api/health` — API liveness; reports real region, revision, replica, role
- `GET /api/health/ready` — readiness; queries Postgres, reports Redis state

## 2. What is deployed

```
                    Internet
                       │  HTTPS (managed certificate)
                       ▼
        ┌──────────────────────────────┐
        │  resilia-web   (external)    │
        │  nginx + Vite bundle         │
        │  proxies /api by route prefix│
        └───────┬──────────────┬───────┘
                │              │
   /api/auth    │              │  /api/payments
   /api/accounts│              │  /api/fraud
   /api/audit   │              │  /api/cards
   /api/notifi… │              │  /api/loans
                ▼              ▼  /api/ops
     ┌────────────────┐  ┌──────────────────┐
     │ resilia-api-   │  │ resilia-api-     │
     │ core (internal)│  │ payments (int.)  │
     │ 1–5 replicas   │  │ 1–10 replicas    │
     │ owns migrations│  │                  │
     └───────┬────────┘  └────────┬─────────┘
             └──────────┬─────────┘
                        ▼
      PostgreSQL Flexible Server · Redis · Azure Files
                        │
              Key Vault (secret references)
                        │
        Log Analytics + Application Insights
```

Only `resilia-web` has external ingress. Both API apps are internal-only and
are not reachable from the public internet.

## 3. Service topology — stated precisely

Every container runs the **same image** and loads **every Nest module**. This is
deliberate: `PaymentsService` injects `FraudService` through `forwardRef` and
`IdentityService` directly, so separating them into different processes breaks
dependency injection at boot.

`SERVICE_ROLE` decides which controllers a container mounts
(`apps/api/src/config/service-role.ts`):

| App | Role | Routes | Replicas | Migrations |
|---|---|---|---|---|
| `resilia-api-core` | `core` | `auth`, `accounts`, `audit`, `notifications` | 1–5 | **owns** |
| `resilia-api-payments` | `payments` | `payments`, `fraud`, `cards`, `loans`, `ops` | 1–10 | no |
| `resilia-web` | — | static + `/api` proxy | 1–5 | no |

**Real:** independently deployable and independently scalable services;
disjoint, non-overlapping route ownership; separate revision histories;
separate restart and failure domains; a single service owning schema changes.

**Not real:** separate codebases, separate images, or network calls between
domains. Payments calls Fraud in-process, not over HTTP. Scaling the payments
role also scales an idle copy of the identity code.

We describe it this way because the overclaim would not survive a judge running
`az containerapp show`, and the honest version costs nothing.

## 4. Routing and CORS

`apps/web/src/lib/api.ts` sets `const API = "/api"` — a relative, same-origin
path. Rather than rewrite the client and open a cross-origin surface, nginx runs
inside the web container and reverse-proxies `/api` by route prefix to the
owning internal API role (`infra/docker/nginx.conf.template`).

Consequences:

- The browser only ever talks to one origin, so **CORS is not part of the
  deployed architecture at all**.
- The API apps keep internal-only ingress.
- A request to an `/api` path that no role owns returns a JSON 404 rather than
  `index.html`, so a routing mistake fails loudly instead of the SPA trying to
  parse HTML as JSON.
- SPA history fallback is handled at the edge, so `/ops/signin` and the
  `PhoneShell` routes deep-link correctly.

## 5. Schema management

`prisma/schema.prisma` uses `provider = "postgresql"`.

Schema is applied with **`prisma db push`**, not `migrate deploy`. The only
committed migrations are SQLite-era and cannot be replayed against Postgres.
Generating a proper Postgres migration history is correct and is listed as
future work in §9 — under the delivery deadline it was an avoidable source of
failure.

**Seeding.** `prisma/seed.ts` opens with a cascade of `deleteMany()`. Run on
every container start, or concurrently across replicas, it would wipe live data
mid-demo. Two independent guards, both in `infra/docker/api-entrypoint.sh`:

1. Only the app deployed with `RUN_MIGRATIONS=true` — the `core` role — touches
   schema or seed at all.
2. The entrypoint seeds only when `prisma.user.count() === 0`, and **refuses to
   seed** if it cannot determine the count.

## 6. Build and release automation

`.github/workflows/ci.yml` (every push and PR):

| Job | What it does |
|---|---|
| `build & typecheck` | api, web, shared, mobile |
| `unit tests` | fraud scoring rules; uploads coverage |
| `dependency & IaC scan` | Trivy **blocking** on CRITICAL/HIGH; Trivy IaC; SARIF to Security tab; gitleaks |
| `terraform validate` | `fmt -check`, `init -backend=false`, `validate` |

`.github/workflows/deploy.yml` (push to `main`):

```
verify (build + tests + blocking Trivy gate)
  → az acr build          both images, built inside ACR
  → trivy image           blocking scan of the built artifact
  → CycloneDX SBOM        one per image, published as build artifacts
  → cosign sign           keyless, recorded in the Rekor transparency log
  → cosign attest         SBOM attached as an attestation
  → deploy by digest      core first (owns migrations), then payments, then web
  → smoke test            edge, both roles, and a real customer login
  → rollback on failure   traffic shifted to the last healthy revision
```

Images deploy **by digest**, not by tag, so a revision cannot silently change
if a tag is re-pushed. `core` rolls first because it applies the schema the
`payments` role then queries.

There is no other path to production. No `kubectl apply`, no portal clicking,
no local `docker push`.

## 7. Security

**No long-lived Azure credential exists in the repository.** GitHub
authenticates by **OIDC federation** against a user-assigned managed identity
(`infra/terraform/github-oidc.tf`). The federated credential's `subject` is
pinned to this repository and branch, so no other workflow can assume it. The
three repository secrets — `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
`AZURE_SUBSCRIPTION_ID` — are identifiers, not secrets; the access token is
minted per run and expires with the job.

| Control | Implementation |
|---|---|
| Runtime secrets | Key Vault, surfaced as Container Apps secret *references* bound to a user-assigned identity — plaintext never enters the app definition, `az containerapp show`, or the portal |
| Registry access | `AcrPull` via managed identity; admin user disabled; no registry password anywhere |
| Deploy permissions | Contributor scoped to the resource group only, never the subscription |
| Secret generation | Postgres password and JWT secret generated by Terraform, written straight to Key Vault, never printed |
| Network exposure | Only the web app has external ingress; both API apps are internal-only |
| Transport | Managed TLS at the edge; internal calls over the environment's mTLS; Postgres requires `sslmode=require`; Redis TLS-only on 6380 |
| Supply chain | Blocking Trivy gate on dependencies *and* built images, CycloneDX SBOMs, cosign keyless signatures + attestations |
| Secret scanning | gitleaks in CI; Trivy SARIF published to the Security tab |
| Container hardening | API runs as a non-root user; no writable application directories |
| Committed config | `.env.production` deleted — deployed configuration comes from Key Vault only |

## 8. Operational visibility

`/api/health` previously returned a hardcoded `region: "A"`. It now reports the
real values injected by the platform:

```json
{
  "status": "ok",
  "service": "resilia-api-core",
  "role": "core",
  "routes": ["auth", "accounts", "audit", "notifications"],
  "region": "southeastasia",
  "revision": "resilia-api-core--s3f9c2a1b0d4",
  "replica": "resilia-api-core--s3f9c2a1b0d4-5d8f9c7b64-x2k9p",
  "uptimeSeconds": 412
}
```

`/api/health/ready` performs real dependency checks and reports `degraded`
rather than `ok` when a dependency is impaired.

**The silent-Redis problem.** `RedisService` fell back to an in-process `Map`
when the connection failed, without logging — a Redis outage was
indistinguishable from healthy operation, and OTP challenges silently became
replica-local. It now logs at **error** level (not warn — an operator scanning
for problems must see it), tracks a fallback operation counter, and surfaces
`redis: degraded` through the readiness endpoint.

Also live:

- **Log Analytics** — container stdout/stderr and the Container Apps system
  log stream, queryable with KQL.
- **Application Insights** — request traces, failure analytics, live metrics.
- **Metric alert** — fires on sustained API failures via an action group.
- **Request correlation** — `x-request-id` is generated at the API, propagated
  by nginx, and returned on every response.

## 9. Deployed state vs. target state

Our target-architecture document describes a larger system. This section maps
each rubric criterion to what is **actually live now** and what remains future
state. Nothing in the "target" column is claimed as delivered.

| Criterion | Deployed now | Target state |
|---|---|---|
| **Build & release automation** (20%) | GitHub Actions: build → test → blocking Trivy → SBOM → cosign keyless sign → `az acr build` → digest-pinned revision deploy → smoke test → auto-rollback. OIDC federation, no stored credential. | Argo CD pull-based GitOps with Argo Rollouts progressive canary and automated metric-based promotion. |
| **Service deployment & environment consistency** (15%) | Three independently deployable Container Apps from two immutable images. Identical image across environments; only env vars and Key Vault references differ. Local `docker-compose` runs the same images. | Fully separate services per domain with HTTP/gRPC boundaries, once `PaymentsService`'s in-process dependencies on Fraud and Identity are refactored to clients. |
| **Automated infrastructure & config management** (15%) | 100% Terraform: registry, environment, Postgres, Redis, Key Vault, identities, federated credentials, storage, alerting, all three apps. `terraform fmt`/`validate` enforced in CI. | Remote state in Azure Storage with locking, `terraform plan` posted to PRs, multi-environment workspaces (dev/staging/prod). |
| **Operational visibility & system health** (15%) | Log Analytics, Application Insights, liveness + readiness probes, real region/revision/replica reporting, Redis degradation surfaced, metric alert, request-id correlation. | Prometheus + Grafana + Loki + Tempo with distributed tracing across service boundaries, RED/USE dashboards, SLO error budgets. |
| **Security & sensitive data** (15%) | OIDC federation (zero stored credentials), Key Vault secret references, managed identity everywhere, no registry password, internal-only API ingress, TLS end to end, non-root containers, blocking vulnerability gate, SBOM + cosign signatures, gitleaks. | HashiCorp Vault with dynamic short-lived database credentials, private endpoints + VNet injection removing public network access entirely, admission policy enforcing signature verification at deploy time. |
| **Scalability, availability & reliability** (10%) | KEDA HTTP-concurrency autoscaling per role (payments 1–10, core 1–5), `min_replicas=1` to avoid cold starts, rolling revision deploys gated on readiness, automatic rollback, shared Azure Files for uploads so replicas > 1 is safe. | Citus-sharded ledger, Postgres read replicas + zone-redundant HA, Kafka/Redpanda event backbone replacing the in-process bus, multi-region active-active. |
| **Engineering best practices** (5%) | First unit tests in `apps/api` — nine cases pinning the fraud scoring rules and the hold threshold. Typed config, formatted and validated IaC, documented trade-offs, honest scope statements. | Integration tests against ephemeral Postgres, contract tests at service boundaries, meaningful coverage thresholds enforced in CI. |

**Explicitly not built** (and not claimed): Kafka/Redpanda, Citus sharding,
Linkerd service mesh, Argo CD / Argo Rollouts, Envoy Gateway, HashiCorp Vault,
the Prometheus/Grafana/Loki/Tempo stack, and deployment of the Expo mobile app.
The web app's `PhoneShell` covers the customer journey in its place.

## 10. Reproducing this deployment

```bash
# 1. Provision. Postgres takes ~10 minutes.
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # optional; defaults are fine
terraform init
terraform apply

# 2. Wire GitHub -> Azure. These are identifiers, not secrets.
gh secret set AZURE_CLIENT_ID       -b "$(terraform output -raw github_oidc_client_id)"
gh secret set AZURE_TENANT_ID       -b "$(terraform output -raw azure_tenant_id)"
gh secret set AZURE_SUBSCRIPTION_ID -b "$(terraform output -raw azure_subscription_id)"

# 3. Release. Everything after this point goes through the pipeline.
git push origin main

terraform output app_url
```

Terraform owns the topology; the pipeline owns image tags. The container image
fields carry `lifecycle { ignore_changes }` so a later `terraform apply` cannot
roll back a deployment.

## 11. Screenshots

| # | Evidence | File |
|---|---|---|
| 1 | GitHub Actions run, green, showing the blocking Trivy gate | `docs/screenshots/01-pipeline.png` |
| 2 | Container Apps revisions in the portal | `docs/screenshots/02-revisions.png` |
| 3 | Application Insights live metrics | `docs/screenshots/03-appinsights.png` |
| 4 | Key Vault secret references, values hidden | `docs/screenshots/04-keyvault.png` |
| 5 | Live app, successful customer login | `docs/screenshots/05-login.png` |
| 6 | Ops console audit trail | `docs/screenshots/06-audit.png` |
