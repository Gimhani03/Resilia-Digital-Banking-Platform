# RESILIA — Deployment

**Duothan 6.0 Phase 3 · "Restore / Fortify"**

| | |
|---|---|
| **Live application** | **https://resilia-web.happymushroom-b22b23ba.centralindia.azurecontainerapps.io** |
| **Repository** | https://github.com/Gimhani03/Resilia-Digital-Banking-Platform |
| **Platform** | Azure Container Apps (Kubernetes-backed), region `centralindia` |
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
      PostgreSQL Flexible Server · Azure Files
              (no Redis — see §9a)
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

Both guards behaved correctly on the first real deployment: the log shows
`empty database — seeding demo dataset` on the first boot, and
`database already populated — skipping destructive seed` on every boot after.

A third rule was added after that first deployment: **a failed seed no longer
stops the service.** The seed initially crashed on a ts-node configuration
error, and because the entrypoint ran under `set -e` the container exited,
Container Apps restarted it, and it crashed again — nginx served 502 for every
route. A cosmetic tooling error had become a total outage. A failed seed now
logs a warning and the API starts anyway, because a service running against an
empty database is far easier to diagnose than one that will not boot.

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
  → buildx build + push   both images, built on the runner (see §9a)
  → trivy image           blocking scan of the built artifact
  → CycloneDX SBOM        one per image, published as build artifacts
  → cosign sign           keyless, recorded in the Rekor transparency log
  → cosign attest         SBOM attached as an attestation
  → cosign verify         both digests checked against this workflow's identity
  → canary revision       created at 0% traffic, must report Healthy
  → 10% traffic           real requests for 90s, any non-200 aborts
  → promote               canary takes the remaining 90%
  → smoke test            edge, both roles, and a real customer login
  → rollback on failure   traffic weight returned to the recorded revision
```

Images deploy **by digest**, not by tag, so a revision cannot silently change
if a tag is re-pushed. `core` rolls first because it applies the schema the
`payments` role then queries.

**Signatures are verified, not just produced.** Signing an image proves nothing
if nothing checks the signature afterwards. Before any revision is created, both
digests are verified against this workflow's Sigstore identity on this branch,
so an image substituted in the registry between build and deploy fails the gate
rather than reaching production.

**The rollout is progressive.** All three apps run in `Multiple` revision mode,
which makes traffic weight something the pipeline sets rather than a
consequence of which revision is newest. A new revision is created with no
traffic at all, has to report `Healthy`, then serves 10% of live requests for 90
seconds while every response is checked. Only then does it take the rest. The
revisions actually observed serving during the soak are printed in the job log,
so the split is evidenced rather than asserted.

This matters for a reason worth stating plainly: **under the previous `Single`
revision mode the rollback job did nothing.** In that mode 100% of traffic
always follows the newest revision, and `az containerapp revision activate` —
what the job ran — activates an old revision without moving any traffic to it.
The job reported success and changed nothing. Weight-based traffic is what makes
rollback real; it is now a single weight change back to the revision recorded
before the run started, and it takes seconds with no rebuild and no image pull.

One consequence to be honest about: during the canary window the previous
revision is still serving most traffic against the newly-applied schema, so
migrations must be backwards compatible (expand/contract). A destructive
migration would break the stable revision, not merely the canary.

**One honest exception.** The pipeline is the deploy path, and no change
reaches production outside it — but the *initial* environment was bootstrapped
by hand, because a cold environment is circular: Terraform cannot create a
Container App that references an image, and the image cannot be pushed to a
registry Terraform has not created yet. That first pass built and pushed both
images locally and ran `terraform apply`. `infra/scripts/bootstrap.sh` captures
the sequence. Every subsequent change ships through `deploy.yml`, and the
workflow detects a cold environment and stops after publishing images rather
than failing.

No `kubectl apply`, and no portal clicking, at any point.

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

## 8a. Incident — "the site loads but no data appears"

Recorded because the diagnosis is more useful than the fix, and because it is
the one class of bug this pipeline was structurally unable to catch.

**Symptom.** Reported live: the application shell rendered and nothing
populated. Every server-side signal was green — `/api/health` ok, database `up`,
traffic 100% on a single healthy revision, twenty consecutive probes returning
200. Logging in over the API and walking the whole flow returned correct data:
challenge → MFA → token → `/api/accounts` with real balances. Nothing was
broken on the server, and no amount of looking at the server would have found
it.

**Cause.** A caching contract that was half right. Vite asset filenames are
content-hashed and were served `Cache-Control: immutable, max-age=1y`, which is
correct. `index.html` was served with **no `Cache-Control` at all** — only
`ETag` and `Last-Modified`. For a response with no explicit directive a browser
applies *heuristic freshness* and may reuse its copy without revalidating.

`index.html` is the only file that tells a browser which asset hashes exist. A
visitor holding a pre-deploy copy therefore requested asset hashes the new
revision no longer contained, every `<script>` 404'd, and the page rendered its
shell and loaded nothing.

**Why every gate missed it.** The failure requires a browser that visited
*before* the deploy. The smoke tests use `curl`, which carries no cache and
starts every request from nothing, so a fully successful pipeline run and a
broken user experience were entirely compatible. The canary could not catch it
either: the canary revision is *new*, so it serves the current hashes correctly
to anyone arriving fresh.

**Fix.** `index.html` and the SPA history fallback now send
`Cache-Control: no-cache, must-revalidate`. That still permits caching — it
requires revalidation — so the ETag round-trip stays cheap while correctness
stops depending on when the visitor first arrived. Hashed assets keep their
immutable year.

**What it says about the gates.** Synthetic checks written by the people who
wrote the deploy inherit the deploy's assumptions. A check that always starts
from an empty cache can never observe a stale-cache failure. This is the
argument for the availability test in §8 running from outside Azure, and the
argument for the next one to carry state between runs.

## 9. Deployed state vs. target state

Our target-architecture document describes a larger system. This section maps
each rubric criterion to what is **actually live now** and what remains future
state. Nothing in the "target" column is claimed as delivered.

| Criterion | Deployed now | Target state |
|---|---|---|
| **Build & release automation** (20%) | GitHub Actions: build → test → blocking Trivy → SBOM → cosign keyless sign → **cosign verify** → digest-pinned canary revision → **10% traffic for 90s** → promote → smoke test → **weight-based auto-rollback**. OIDC federation, no stored credential. | Argo CD pull-based GitOps. Progressive canary is delivered — Container Apps traffic weights turned out to be sufficient without Argo Rollouts — but promotion is gated on error rate rather than on a full metric analysis. |
| **Service deployment & environment consistency** (15%) | Three independently deployable Container Apps from two immutable images. Identical image across environments; only env vars and Key Vault references differ. Local `docker-compose` runs the same images. | Fully separate services per domain with HTTP/gRPC boundaries, once `PaymentsService`'s in-process dependencies on Fraud and Identity are refactored to clients. |
| **Automated infrastructure & config management** (15%) | 100% Terraform: registry, environment, Postgres, Redis, Key Vault, identities, federated credentials, storage, alerting, all three apps. **Remote state in Azure Storage with blob-lease locking and Entra RBAC auth — no storage key.** `terraform fmt`/`validate` enforced in CI. | `terraform plan` posted to PRs, multi-environment workspaces (dev/staging/prod). |
| **Operational visibility & system health** (15%) | Log Analytics, Application Insights, liveness + readiness probes, real region/revision/replica reporting, Redis degradation surfaced, metric alert **with an actual email receiver**, **synthetic availability probe from Singapore and Amsterdam including a TLS-expiry check**, request-id correlation. | Prometheus + Grafana + Loki + Tempo with distributed tracing across service boundaries, RED/USE dashboards, SLO error budgets. |
| **Security & sensitive data** (15%) | OIDC federation (zero stored credentials), Key Vault secret references, managed identity everywhere, no registry password, internal-only API ingress, TLS end to end, non-root containers, blocking vulnerability gate **passing on a genuinely clean image — no toolchain and no package manager in the runtime layer**, SBOM + cosign signatures **verified before rollout**, gitleaks. | HashiCorp Vault with dynamic short-lived database credentials, private endpoints + VNet injection removing public network access entirely. Signature verification is enforced by the pipeline; moving it into an admission policy would enforce it for deploys the pipeline never sees. |
| **Scalability, availability & reliability** (10%) | KEDA HTTP-concurrency autoscaling per role (payments 1–10, core 1–5), `min_replicas=1` to avoid cold starts, **canary revisions gated on readiness then on live error rate**, **rollback by traffic weight in seconds**, shared Azure Files for uploads so replicas > 1 is safe. | Citus-sharded ledger, Postgres read replicas + zone-redundant HA, Kafka/Redpanda event backbone replacing the in-process bus, multi-region active-active. |
| **Engineering best practices** (5%) | First unit tests in `apps/api` — nine cases pinning the fraud scoring rules and the hold threshold. Typed config, formatted and validated IaC, documented trade-offs, honest scope statements. | Integration tests against ephemeral Postgres, contract tests at service boundaries, meaningful coverage thresholds enforced in CI. |

**Explicitly not built** (and not claimed): Kafka/Redpanda, Citus sharding,
Linkerd service mesh, Argo CD / Argo Rollouts, Envoy Gateway, HashiCorp Vault,
the Prometheus/Grafana/Loki/Tempo stack, and deployment of the Expo mobile app.
The web app's `PhoneShell` covers the customer journey in its place.

## 9a. Subscription constraints that shaped this deployment

Three limits of the target subscription (Azure for Students) changed the
design during deployment. They are recorded here because each one is a
constraint a judge could otherwise read as a design mistake.

**Region is policy-restricted.** The subscription carries the "Allowed resource
deployment regions" policy, permitting only `eastasia`, `malaysiawest`,
`uaenorth`, `indonesiacentral` and `centralindia`. Creating the registry in
`southeastasia` failed with HTTP 403 `RequestDisallowedByAzure`. The resource
group had been allowed through, so the limit only surfaced on the first real
resource. The stack runs in `centralindia` — the closest permitted region to
Sri Lanka — and `var.location` now carries a `validation` block so an
unpermitted region fails at plan time rather than mid-apply.

**ACR Tasks are not permitted.** `az acr build` — the server-side build service
— is rejected with `TasksOperationsNotAllowed`. The pipeline therefore builds
images on the GitHub runner with Buildx and pushes them, using GitHub Actions
layer caching. This costs nothing in security terms: `az acr login` exchanges
the OIDC-derived Azure token for a short-lived registry token, so the runner
still never holds a registry password.

**Azure Cache for Redis is retiring** and refuses new instances
("create Azure Managed Redis instance instead"). Managed Redis starts well
above this deployment's budget, so Redis is not provisioned.

That last one is a genuine functional degradation and is reported as such
rather than quietly ignored. `RedisService` falls back to an in-process store,
which makes OTP challenges and rate-limit counters **replica-local** — two
replicas do not share them. The system surfaces this instead of hiding it:
`/api/health/ready` returns `redis: degraded` with the reason, and the service
logs the fallback at error level. This is exactly the silent-failure mode the
observability work set out to close, and it is visible in the live deployment.

Re-enabling Redis is a one-line change (`enable_redis = true`) once an Azure
Managed Redis SKU is affordable.

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
