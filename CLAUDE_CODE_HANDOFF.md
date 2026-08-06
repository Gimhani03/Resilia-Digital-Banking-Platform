# RESILIA — Phase 3 Deployment Handoff Prompt

> Paste everything below the line into Claude Code, from the repo root.

---

You are deploying the RESILIA digital banking platform to Azure for the final phase of a hackathon. **I have roughly 90 minutes.** Work fast, prioritise a live URL above all else, and do not ask me to confirm things you can decide yourself. Use your shell access — you have `az`, `docker`, `terraform`, and `gh`. I am already logged in to Azure (`az login` done) with **$100 of credit**.

## The competition

Duothan 6.0 Phase 3 ("Restore / Fortify"), IEEE Student Branch of NSBM. Phase 2 built a working banking platform. Phase 3 requires deploying it to the cloud as independent services with full release automation.

**Submission requires all three:**
1. Public GitHub repository link (must contain app code, infrastructure definitions, and pipeline configuration)
2. **Live deployed application URL or IP — reachable and functional**
3. Brief deployment documentation with screenshots

**Marking rubric — optimise against these weights:**

| Criteria | Weight |
|---|---|
| Build & Release Automation | 20% |
| Service Deployment & Environment Consistency | 15% |
| Automated Infrastructure & Configuration Management | 15% |
| Operational Visibility & System Health | 15% |
| Security Practices & Protection of Sensitive Data | 15% |
| Scalability, Availability & Reliability | 10% |
| Engineering Best Practices | 5% |
| Team contributions | 5% |

Everything except the last row is scored from committed artifacts, the live URL, and screenshots. **Coverage across all criteria beats depth in any one.** A missing live URL fails the submission gate and zeroes most rows.

## The repo

npm-workspaces monorepo, ~17k lines TypeScript.

- `apps/api` — NestJS + Prisma. 12 domain modules: identity, accounts, payments, fraud, loans, cards, audit, ops, notifications, providers, plus `event-bus` (in-process) and `redis`.
- `apps/web` — React + Vite + Tailwind. Serves **both** the ops console (`/ops/signin`) and customer web shells (`PhoneShell.tsx`). This is the demo surface.
- `apps/mobile` — Expo React Native. **Out of deploy scope** — cannot ship in the time available. The web app's `PhoneShell` covers the customer journey.
- `packages/shared` — shared types and demo constants.
- `.github/workflows/ci.yml` — currently only builds. Extend it, don't replace it.

## Verified blockers — I read the code, these are real

Handle each of these; they will otherwise cost you the deploy.

1. **`apps/web/src/lib/api.ts` line 3 is `const API = "/api"` — a relative path.** The web app assumes same-origin. Do **not** try to fix this with CORS env juggling. Put nginx in the web container and reverse-proxy `/api` to the API container app's internal ingress URL. This solves routing and CORS in one move and is the single highest-risk item.

2. **A true microservice split breaks Nest DI.** `PaymentsService` injects `FraudService` (via `forwardRef`) and `IdentityService` directly. Separate processes → DI fails at boot. Converting to HTTP clients is not a 90-minute job.
   **Do this instead:** all modules load in every container (DI intact), but each container exposes only its own controllers, gated by a `SERVICE_ROLE` env var. Deploy as separate Container Apps with independent scaling rules. Document precisely what is real (independent deployables, independent scaling, partitioned routes) and what is not (shared image, in-process calls). Honesty scores better than an overclaim.

3. **`prisma/schema.prisma` is `provider = "sqlite"` and the only migrations are SQLite.** Switch to `postgresql` and use **`prisma db push`**, not `migrate deploy`. Do not try to generate Postgres migrations under time pressure. `Decimal` fields at schema lines 71, 72, 87, 88, 124, 125, 173, 176, 182 port to Postgres fine.

4. **`prisma/seed.ts` opens with a cascade of `deleteMany()` — it is destructive.** If it runs on every container start, or concurrently across replicas, it wipes the demo mid-judging. Guard it: seed only when `prisma.user.count() === 0`, and only on the container with `RUN_MIGRATIONS=true`. Exactly one service should own migrations and seeding.

5. **Without seed data there is no demo** — judges cannot log in. Demo credentials are customer `a.perera.2065` / `Resilia2065!` and officer `s.jayasuriya` / `OpsConsole2065!`, TOTP secret `JBSWY3DPEHPK3PXP`, demo OTP `482916` when `DEMO_MODE=true`. Verify login works against the deployed URL before you call it done.

6. **`main.ts` throws if `NODE_ENV=production` and `JWT_SECRET` is unset.** Wire the secret before first boot or the container crash-loops.

7. **`health.controller.ts` returns `region: "A"` hardcoded.** Two-minute fix — read the real region and container revision from env. Disproportionately credible on the visibility criterion.

8. **`RedisService` silently falls back to an in-process `Map` on connect failure** (`redis.module.ts`). A Redis outage looks like healthy operation. Add a log + a metric so it surfaces.

9. **`UPLOAD_DIR=./uploads` writes KYC photos to local disk.** Blocks replica scaling. Azure Blob, or an Azure Files mount if faster.

10. **Zero `*.spec.ts` files under `apps/api`.** The pipeline's test stage is decorative without them. Write ~6 unit tests on the fraud scoring rules in `fraud.service.ts` (amount thresholds, velocity, new-payee) — 15 minutes, makes the pipeline real, and covers Engineering Best Practices.

## Architecture — decided, do not relitigate

**Azure Container Apps, not AKS.** AKS provisioning plus node pools plus ingress plus a mesh does not fit in 90 minutes, and a half-configured cluster scores worse than a clean deploy. Container Apps runs on Kubernetes underneath (judges can verify), and gives KEDA autoscaling, revision-based traffic splitting for canary, managed HTTPS, internal mTLS between apps, and Log Analytics — all without configuration.

Provision with **Terraform** (this is the 15% IaC row — Terraform is the artifact being graded):

- Azure Container Registry
- Container Apps Environment + Log Analytics workspace + Application Insights
- Azure Database for PostgreSQL Flexible Server (Burstable B1ms)
- Azure Cache for Redis (Basic C0) — or skip if it stalls; the code degrades gracefully
- Azure Key Vault + user-assigned managed identity for secret references
- Container Apps: `resilia-api-*` (role-partitioned, external ingress disabled where internal) + `resilia-web` (external ingress, nginx proxy)

**Pipeline** — extend `.github/workflows/ci.yml`, add `deploy.yml`:

```
push → lint/typecheck → unit tests → Trivy scan (CRITICAL,HIGH) → SBOM (Trivy)
     → cosign keyless sign → az acr build → deploy new Container App revision
```

Authenticate GitHub → Azure with **OIDC federated credentials, not a stored publish profile**. Zero long-lived secrets in the repo is a genuine security differentiator most student teams miss, and it directly serves the 15% security row.

**Cut, deliberately** — these are in our target-architecture document and stay there as future state: Kafka/Redpanda event backbone, Citus sharding, Linkerd service mesh, Argo CD / Argo Rollouts, Envoy Gateway, HashiCorp Vault, the Prometheus/Grafana/Loki/Tempo stack. Container Apps revisions substitute for Argo Rollouts; Application Insights substitutes for the LGTM stack; Key Vault substitutes for Vault.

## Sequence

| Time | Work |
|---|---|
| 0:00–0:15 | Write Terraform, `terraform apply` immediately — Postgres takes ~10 min, let it provision while you work |
| 0:15–0:40 | Dockerfiles (API multi-stage monorepo-aware; web build + nginx proxy), entrypoint with guarded `db push` + seed, `SERVICE_ROLE` route gating, schema → postgresql |
| 0:40–1:05 | `deploy.yml` with OIDC, Trivy, SBOM, cosign, `az acr build`, revision deploy. Push and watch it go green. |
| 1:05–1:20 | App Insights wiring, health probes, KEDA scale rules, the four cheap fixes (region, Redis visibility, blob uploads, fraud tests) |
| 1:20–1:30 | `DEPLOYMENT.md` + screenshots |

**Do not leave me without a URL.** If Terraform stalls past 0:40, fall back to `az containerapp up --source .` to get something live, then reconcile the Terraform afterwards. A working URL with imperfect IaC beats perfect IaC with nothing deployed.

## Documentation deliverable

We already have a detailed target-architecture document (services topology, sharded ledger, event backbone, GitOps pipeline, observability, security). Write `DEPLOYMENT.md` that adds a **"Deployed State vs. Target State"** section mapping each rubric criterion to what is actually live now versus what the architecture document proposes next. Claiming Citus we did not build reads worse than scoping it deliberately.

Screenshot checklist: green Actions run showing the Trivy gate · Container Apps revisions in the portal · Application Insights live metrics · Key Vault secret references (values hidden) · the live app with a successful customer login · the ops console audit trail.

## Rules

- Everything reaches the cloud through the pipeline. No `kubectl apply` or portal clicking as the deploy path.
- No secret is ever committed. `.env.production` stops being a source of truth.
- Verify before declaring done: hit the health endpoint, log in as the customer, complete one transfer, open the ops console.
- Tell me immediately if something is going to blow the timebox. Do not silently burn 20 minutes on a stuck resource.

Start with Terraform so Postgres provisions in the background. Go.
