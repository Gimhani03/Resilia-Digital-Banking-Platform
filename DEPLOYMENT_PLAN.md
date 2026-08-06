# RESILIA — Phase 3 Deployment Plan

**Duothan 6.0 Phase 3 · "Restore / Fortify" · IEEE Student Branch of NSBM**

This is the plan of record for taking the Phase 2 platform to Azure. It states
what we are building, why each choice was made, and — just as importantly —
what we deliberately are not building. `DEPLOYMENT.md` records what ended up
actually running.

---

## 1. Objective

Three things must be true at submission:

1. A public GitHub repository containing application code, infrastructure
   definitions and pipeline configuration.
2. A **live, reachable, functional** deployed URL.
3. Deployment documentation with screenshots.

The live URL is a gate, not a criterion. Without it most of the rubric scores
zero regardless of how good the infrastructure code is. Every sequencing
decision below follows from that.

## 2. Target platform — and why not Kubernetes

**Azure Container Apps.**

Container Apps runs on Kubernetes (AKS-managed infrastructure) underneath, and
gives us KEDA-based autoscaling, revision-based rollout and traffic splitting,
managed TLS, internal-only ingress with mTLS between apps, and Log Analytics
integration — none of which need configuring.

A raw AKS cluster would need node pools, an ingress controller, cert-manager,
a service mesh and a GitOps controller before the first request is served. A
half-configured cluster demonstrates less than a cleanly operated managed
platform, and the time cost is not recoverable inside the delivery window.

## 3. Service topology

The Phase 2 API is a single NestJS process whose modules call each other
in-process: `PaymentsService` injects `FraudService` through `forwardRef`, and
injects `IdentityService` directly. Splitting those into separate processes
breaks Nest dependency injection at boot; converting the call sites to HTTP
clients is a refactor, not a deployment task.

**The approach: one image, role-partitioned routing.**

Every container loads every Nest module, so the dependency graph stays intact.
A `SERVICE_ROLE` environment variable decides which controllers that container
mounts (`apps/api/src/config/service-role.ts`). Each role is deployed as its
own Container App with its own scaling rules and its own revision history.

| Container App | `SERVICE_ROLE` | Routes owned | Ingress | Scale |
|---|---|---|---|---|
| `resilia-api-core` | `core` | `/api/auth`, `/api/accounts`, `/api/audit`, `/api/notifications` | internal | 1–5 |
| `resilia-api-payments` | `payments` | `/api/payments`, `/api/fraud`, `/api/cards`, `/api/loans`, `/api/ops` | internal | 1–10 |
| `resilia-web` | — | static bundle + `/api` reverse proxy | **external** | 1–5 |

**What this genuinely is:** independently deployable services, independently
scalable, with a partitioned and non-overlapping route space, separate
revision histories, and separate failure/restart domains.

**What it is not:** separate codebases, separate images, or network calls
between domains. Payments still calls Fraud in-process. We document this
plainly rather than describing it as a microservice split, because the claim
would not survive inspection and the honest version costs nothing.

## 4. The routing problem

`apps/web/src/lib/api.ts` sets `const API = "/api"` — a relative path. The web
app assumes the API is same-origin.

Rather than rewrite the client and open a CORS surface, **nginx ships inside
the web container** and reverse-proxies `/api` by route prefix to the matching
internal API role. The browser only ever talks to one origin, CORS never
enters the picture, and the two API apps keep internal-only ingress so they
are unreachable from the public internet.

This was identified up front as the single highest-risk item, and it is why
the web container is nginx rather than a static-site service.

## 5. Data layer

- **Azure Database for PostgreSQL Flexible Server**, Burstable B1ms.
- `prisma/schema.prisma` moves from `sqlite` to `postgresql`.
- Schema is applied with **`prisma db push`**, not `migrate deploy`. The only
  committed migrations are SQLite-era and cannot be replayed against Postgres.
  Generating a clean Postgres migration history is correct, and is future work
  — under this deadline it is an unnecessary source of failure.
- `Decimal` columns port to Postgres without change.

**Seeding is the sharp edge.** `prisma/seed.ts` opens with a cascade of
`deleteMany()`. Run on every container start, or concurrently across replicas,
it would wipe the demo mid-judging. Two guards:

1. Only the container with `RUN_MIGRATIONS=true` (the `core` role) runs schema
   or seed at all.
2. The entrypoint seeds only when `prisma.user.count() === 0`, and refuses to
   seed if it cannot determine the count.

Without seed data there is no demo — judges cannot log in — so this path is
verified explicitly by the pipeline's post-deploy smoke test.

## 6. Pipeline

Extends the existing `.github/workflows/ci.yml`; adds `.github/workflows/deploy.yml`.

```
push to main
  → build & typecheck (api, web, shared, mobile)
  → unit tests (fraud scoring rules) + coverage artifact
  → Trivy dependency scan  [BLOCKING on CRITICAL,HIGH]
  → Trivy IaC scan + SARIF to the Security tab + gitleaks
  → terraform fmt -check / validate
  → az acr build  (both images, built inside ACR)
  → Trivy image scan  [BLOCKING]
  → CycloneDX SBOM per image
  → cosign keyless sign + SBOM attestation
  → deploy new Container App revision, by digest
  → smoke test: edge, both roles, real customer login
  → automatic rollback to last healthy revision on failure
```

**Authentication is OIDC federation**, not a stored publish profile or service
principal password. A user-assigned managed identity carries federated
credentials whose `subject` is pinned to this repository and branch. GitHub
holds three identifiers (client / tenant / subscription id) and no secret;
the access token is minted per run and expires with the job. Zero long-lived
Azure credentials exist in the repository.

`.env.production` is deleted. Deployed configuration comes from Key Vault.

## 7. Infrastructure as code

All Azure resources are defined in `infra/terraform/`:

| Resource | Purpose |
|---|---|
| Container Registry | image store; CI builds directly into it |
| Container Apps Environment | shared runtime for all three apps |
| Log Analytics workspace | container stdout/stderr, system log stream |
| Application Insights | traces, live metrics, failure analytics |
| PostgreSQL Flexible Server B1ms | primary datastore |
| Azure Cache for Redis Basic C0 | OTP challenges, rate-limit counters |
| Key Vault + user-assigned identity | every runtime secret, by reference |
| Storage account + Files share | KYC uploads, mounted at `/mnt/uploads` |
| Managed identity + federated credentials | GitHub → Azure, no stored secret |
| Metric alert + action group | fires on sustained API failures |

Terraform owns the topology; the pipeline owns image tags. Container image
fields carry `lifecycle { ignore_changes }` so a later `terraform apply` cannot
roll back a deployment.

## 8. Operational visibility

- `/api/health` — liveness. Reports the **real** region, revision, replica and
  role from the Container Apps environment, replacing the hardcoded
  `region: "A"`.
- `/api/health/ready` — readiness. Actually queries Postgres and reports
  `degraded` when Redis has fallen back to its in-process store.
- `RedisService` previously fell back to an in-memory `Map` on connection
  failure **silently** — a Redis outage looked identical to healthy operation.
  It now logs at error level and exposes the fallback state and an operation
  counter, surfaced through the readiness endpoint.
- Log Analytics + Application Insights are wired at the environment level, so
  every replica ships logs and traces without in-process instrumentation.

## 9. Scalability & availability

- KEDA HTTP concurrency scale rules per role; payments scales hardest (1–10)
  because it carries the transaction path.
- `min_replicas = 1` everywhere — cold starts during judging are not acceptable.
- Rolling revision deploys: the old revision drains only after the new one
  passes its readiness probe.
- KYC uploads moved off container-local disk to a shared Azure Files mount,
  which is what makes replica count greater than one actually safe.

## 10. Deliberately out of scope

These are in the target-architecture document and stay there as future state.
Claiming them would not survive inspection:

| Not built | Substituted by |
|---|---|
| Kafka / Redpanda event backbone | in-process `EventBusModule` |
| Citus sharded ledger | single PostgreSQL Flexible Server |
| Linkerd service mesh | Container Apps built-in mTLS |
| Argo CD / Argo Rollouts | Container Apps revisions + GitHub Actions |
| Envoy Gateway | nginx in the web container + Container Apps ingress |
| HashiCorp Vault | Azure Key Vault |
| Prometheus / Grafana / Loki / Tempo | Application Insights + Log Analytics |
| Expo mobile app deployment | web `PhoneShell` covers the customer journey |

## 11. Sequence

| Phase | Work |
|---|---|
| 1 | Write Terraform, `terraform apply` immediately — Postgres takes ~10 min, let it provision in the background |
| 2 | Dockerfiles, nginx proxy, guarded entrypoint, `SERVICE_ROLE` gating, schema → postgresql |
| 3 | `deploy.yml` with OIDC, Trivy, SBOM, cosign, `az acr build`, revision deploy |
| 4 | Health probes, scale rules, region/revision reporting, Redis visibility, shared upload storage, fraud unit tests |
| 5 | `DEPLOYMENT.md` + screenshots |

**Fallback:** if Terraform stalls, `az containerapp up --source .` gets
something live immediately and the Terraform is reconciled afterwards. A
working URL with imperfect IaC beats perfect IaC with nothing deployed.

## 12. Definition of done

Not "the pipeline is green" — verified against the live URL:

- [ ] `/healthz` and `/api/health` return 200 with the real region and revision
- [ ] `/api/health/ready` reports database `up`
- [ ] Customer `a.perera.2065` logs in successfully
- [ ] One transfer completes end to end
- [ ] Ops console `/ops/signin` opens and the audit trail renders
- [ ] No secret is committed anywhere in the repository
