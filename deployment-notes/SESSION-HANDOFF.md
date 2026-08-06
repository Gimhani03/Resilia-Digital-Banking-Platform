# Session Handoff — RESILIA Azure Deployment

**Status: live and verified.** Everything below reflects the deployed state as of
2026-08-06.

**Live URL:** https://resilia-web.happymushroom-b22b23ba.centralindia.azurecontainerapps.io

Read this before touching anything. Most of it is traps that already cost time
once.

---

## 1. Read this first — three things that will bite you

### 1.1 Terraform state is LOCAL and NOT committed

`infra/terraform/terraform.tfstate` lives only on the machine that ran the
apply. It is gitignored, deliberately — it contains the generated Postgres
password and the JWT secret in plaintext.

**Consequence:** a different machine, or a fresh clone, cannot manage the
existing infrastructure. `terraform apply` there would try to *create*
resources that already exist and fail.

If you need to work from elsewhere, either:

- copy `infra/terraform/terraform.tfstate` across by hand (treat it as a
  secret), or
- migrate to a remote backend — the right long-term fix:

```hcl
# infra/terraform/providers.tf
terraform {
  backend "azurerm" {
    resource_group_name  = "rg-resilia-prod"
    storage_account_name = "stresiliac4630"
    container_name       = "tfstate"
    key                  = "prod.terraform.tfstate"
  }
}
```

Then `terraform init -migrate-state`. The storage account already exists.

### 1.2 `az` and `terraform` are NOT on the system PATH

They are installed but not resolvable from a fresh shell. Every command in this
document assumes this prefix:

```bash
export PATH="/c/Program Files/Microsoft SDKs/Azure/CLI2/wbin:/c/Users/ASUS/AppData/Local/Microsoft/WinGet/Packages/Hashicorp.Terraform_Microsoft.Winget.Source_8wekyb3d8bbwe:$PATH"
```

Docker, if needed:

```bash
export PATH="/c/Program Files/Docker/Docker/resources/bin:$PATH"
```

Docker Desktop must be running: `C:\Program Files\Docker\Docker\Docker Desktop.exe`

### 1.3 PowerShell mangles `-target=` arguments

`terraform apply -target=azurerm_resource_group.main` fails in PowerShell with
"Too many command line arguments". **Use the Bash tool for Terraform.**

---

## 2. What is deployed

Subscription **Azure for Students** `df89efab-e4ea-485e-94cb-2f4066c3d60b`
Tenant `1ccc9ed2-9906-4a99-8c0d-5d2d0d71f8fb`
Resource group **`rg-resilia-prod`**, region **`centralindia`**

| Resource | Name |
|---|---|
| Container Registry | `crresiliac4630` (`crresiliac4630.azurecr.io`) |
| Container Apps Env | `cae-resilia-prod` |
| Container App — web (external) | `resilia-web` · 1–5 replicas |
| Container App — API core (internal) | `resilia-api-core` · 1–5 replicas |
| Container App — API payments (internal) | `resilia-api-payments` · 1–10 replicas |
| PostgreSQL Flexible Server 16 | `psql-resilia-c4630` · B1ms · 32 GB |
| Key Vault | `kv-resilia-c4630` |
| Storage (Azure Files, KYC) | `stresiliac4630` · share `kyc-uploads` |
| Log Analytics | `log-resilia-prod` |
| Application Insights | `appi-resilia-prod` |
| Metric alert + action group | `alert-resilia-api-5xx` · `ag-resilia-ops` |
| Workload identity | `id-resilia-prod` · client `06a971e2-9b97-4664-9f93-4b4adf1f2c04` |
| GitHub OIDC identity | `id-resilia-github` · client `a748f1d1-f0fa-41ac-8423-73087020b0e2` |

**Not deployed:** Redis (see §5.4).

Internal ingress hostnames (used by the nginx proxy):

```
resilia-api-core.internal.happymushroom-b22b23ba.centralindia.azurecontainerapps.io
resilia-api-payments.internal.happymushroom-b22b23ba.centralindia.azurecontainerapps.io
```

Key Vault secrets: `database-url`, `jwt-secret`, `redis-url`.
**Never print these into a file, a commit, or a terminal that gets pasted.**

GitHub repo: `Gimhani03/Resilia-Digital-Banking-Platform`
Repo secrets set: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
(identifiers, not secrets — the OIDC token is minted per run).

---

## 3. How it was deployed, in order

This is the actual sequence, not the idealised one.

1. **Installed the toolchain.** `az` and `terraform` were absent. Azure CLI via
   direct MSI (winget was slow); Terraform via winget.
2. **`terraform apply -target`** for resource group + registry only.
3. **Built both images** and pushed to ACR. Locally with Docker — see §5.3 for
   why not `az acr build`.
4. **`terraform apply -target=...`** for everything that does not depend on an
   image (Postgres, Key Vault, Log Analytics, App Insights, Container Apps
   Environment, identities, role assignments, storage, alert). Run in parallel
   with the image builds — Postgres takes ~10 minutes and is the long pole.
5. **Full `terraform apply`** — creates the three Container Apps.
6. **Seeded the database** (see §4.3) and restarted the API revisions.
7. **Fixed and redeployed** the API and web images (§5.5, §5.6).
8. **Verified** health, both roles, customer + officer login, route
   partitioning.

`infra/scripts/bootstrap.sh` encodes steps 2–5 for a clean environment.

**Why bootstrapping is manual:** a cold environment is circular. Terraform
cannot create a Container App that references an image, and the image cannot be
pushed to a registry Terraform has not created. `deploy.yml` detects this — if
the apps do not exist it publishes the images and stops, rather than failing.

---

## 4. Common operations

All assume the PATH prefix from §1.2.

### 4.1 Check health

```bash
URL="https://resilia-web.happymushroom-b22b23ba.centralindia.azurecontainerapps.io"
curl -s "$URL/healthz"                # nginx edge
curl -s "$URL/api/health"             # core role: region, revision, replica
curl -s "$URL/api/health/ready"       # dependency checks
```

`ready` returns `degraded` — that is correct, Redis is not deployed (§5.4).

### 4.2 Logs

```bash
az containerapp logs show -n resilia-api-core     -g rg-resilia-prod --tail 40 --type console
az containerapp logs show -n resilia-api-payments -g rg-resilia-prod --tail 40 --type console
az containerapp logs show -n resilia-web          -g rg-resilia-prod --tail 40 --type console
```

`--type system` shows platform events (image pulls, probe failures, scaling).

### 4.3 Re-seed the database

The entrypoint seeds only when the database is empty, so this is for a manual
reset. It connects from your machine, which needs a temporary firewall rule.

```bash
MYIP=$(curl -s https://api.ipify.org)
az postgres flexible-server firewall-rule create \
  -g rg-resilia-prod --server-name psql-resilia-c4630 \
  --name tempseed --start-ip-address "$MYIP" --end-ip-address "$MYIP"

export DATABASE_URL=$(az keyvault secret show --vault-name kv-resilia-c4630 -n database-url --query value -o tsv)
npx prisma generate --schema apps/api/prisma/schema.prisma
npx ts-node --transpile-only \
  --compiler-options '{"module":"commonjs","moduleResolution":"node","esModuleInterop":true,"target":"ES2021"}' \
  apps/api/prisma/seed.ts

# ALWAYS remove the rule afterwards
az postgres flexible-server firewall-rule delete \
  -g rg-resilia-prod --server-name psql-resilia-c4630 --name tempseed --yes
```

Note the argument names: `--server-name` is the server, `--name` is the rule.
Getting these backwards just prints help text.

The seed is **destructive** — it opens with a cascade of `deleteMany()`.

### 4.4 Deploy a change

Push to `main`. `deploy.yml` builds, scans, signs and rolls new revisions.

Manually, if needed:

```bash
DIGEST=$(az acr repository show -n crresiliac4630 --image resilia-api:latest --query digest -o tsv)
az containerapp update -n resilia-api-core -g rg-resilia-prod \
  --image "crresiliac4630.azurecr.io/resilia-api@$DIGEST" \
  --revision-suffix "r$(date +%H%M%S)"
```

Revision suffixes must be unique and lowercase alphanumeric.

### 4.5 Roll back

```bash
az containerapp revision list -n resilia-api-core -g rg-resilia-prod -o table
az containerapp revision activate -n resilia-api-core -g rg-resilia-prod --revision <name>
```

### 4.6 Tear down

```bash
cd infra/terraform && terraform destroy
```

**Do this after judging.** ~$3.90/day against a $100 credit ≈ 25 days.

---

## 5. Traps already hit — do not rediscover these

### 5.1 Region is policy-restricted

The subscription enforces "Allowed resource deployment regions":
`eastasia`, `malaysiawest`, `uaenorth`, `indonesiacentral`, `centralindia`.

`southeastasia` fails with HTTP 403 `RequestDisallowedByAzure`. The resource
group is allowed through, so the limit only appears on the first real resource.
`var.location` now has a `validation` block that catches this at plan time.

### 5.2 `Microsoft.App` needed registering

It was `NotRegistered`. Without it the Container Apps Environment cannot be
created.

```bash
az provider register -n Microsoft.App
```

### 5.3 ACR Tasks are not permitted

`az acr build` fails with `TasksOperationsNotAllowed` on this subscription
class. Server-side builds are unavailable. Build with Docker and push instead —
that is what `deploy.yml` does on the runner, and what the bootstrap did
locally.

`az acr login` still works and yields a short-lived token, so no registry
password is stored anywhere.

### 5.4 Azure Cache for Redis is retiring

New instances are refused: *"Azure Cache for Redis is retiring, create Azure
Managed Redis instance instead."* Managed Redis starts well above budget, so
`enable_redis` defaults to `false`.

This is a **real degradation**, not a no-op: OTP challenges and rate-limit
counters become replica-local. It is surfaced deliberately —
`/api/health/ready` reports `redis: degraded` and `RedisService` logs at error
level. Do not "fix" that warning; it is telling the truth.

### 5.5 The API entrypoint path

Nest emits `apps/api/dist/src/main.js`, **not** `dist/main.js`, because
`apps/api/tsconfig.json` includes both `src` and `prisma`, making `apps/api` the
common source root. Getting this wrong is a silent MODULE_NOT_FOUND crash loop.

### 5.6 nginx `upstream` blocks break Host and SNI

With `upstream api_core { server <fqdn>:443; }` and `proxy_pass
https://api_core`, nginx sets `$proxy_host` to the **upstream block name**. Both
the `Host` header and TLS SNI go out as the literal string `api_core`, Container
Apps ingress matches no application, and **every /api request returns 502** —
while the API itself is perfectly healthy.

Fix: `proxy_pass https://${API_CORE_HOST};` directly. envsubst substitutes the
literal FQDN at start, so `$proxy_host` is correct and no `resolver` is needed.

**Do not reintroduce upstream blocks** for keepalive without also pinning
`proxy_set_header Host` and `proxy_ssl_name` to the real FQDN per location.

### 5.7 A failed seed used to take down the whole service

The entrypoint runs under `set -e`. The seed crashed on a ts-node config error
(`TS5109`), the container exited, Container Apps restarted it, and it crashed
again — nginx served 502 for everything. A cosmetic tooling error became a total
outage.

The seed is now non-fatal: it logs a warning and the API starts anyway. Keep it
that way.

### 5.8 Windows lockfiles are not portable to Linux builds

This cost four separate cycles. A `package-lock.json` generated on Windows omits
other platforms' native binaries (npm/cli#4828). Symptoms: `EBADPLATFORM`, or
`Cannot find native binding`, or `The package "@esbuild/linux-x64" could not be
found`.

Now pinned in root `optionalDependencies` for win32 + linux-gnu + linux-musl:
`@rollup/rollup-*`, `@tailwindcss/oxide-*`, `lightningcss-*`, `@esbuild/*`.

**If you add a native-binary dependency, pin every platform variant**, and
regenerate the lock with the stale tree removed — `npm install` will otherwise
rebuild the lock from `node_modules` and silently change nothing:

```bash
rm -rf node_modules/<pkg> package-lock.json
npm install --package-lock-only
```

The web build stage is `node:22-slim` (glibc), not Alpine, because the Vite
toolchain's glibc binaries are the ones this lockfile carries. The runtime stage
is still Alpine nginx.

### 5.9 `.dockerignore` needs a bare `node_modules`

`**/node_modules` alone does not exclude the repository-root `node_modules` in
the tar packer. Without the bare entry the build context is ~640 MB instead of
156 KiB, and the upload looks like a hang.

### 5.10 Trivy action tags are `v`-prefixed

`aquasecurity/trivy-action@0.36.0` does not resolve; `@v0.36.0` does.

### 5.11 A documented Trivy exception exists

`.trivyignore` suppresses `GHSA-qwww-vcr4-c8h2` (react-router RSC-mode CSRF).
Not reachable — this is a client-side SPA with no RSC runtime. It carries a
reachability argument and a **2026-09-30 review date**. Revisit it, don't just
extend it.

---

## 6. State of the repository

17+ commits on `main`. CI is green: `build & typecheck`, `unit tests` (9 fraud
engine specs), `dependency & IaC scan` (blocking Trivy), `terraform validate`.

Files that matter most:

```
infra/terraform/            all Azure resources
infra/docker/               api.Dockerfile, web.Dockerfile, nginx template, entrypoint
infra/scripts/bootstrap.sh  cold-environment provisioning
.github/workflows/ci.yml    quality + security gates
.github/workflows/deploy.yml build, scan, sign, roll revisions
apps/api/src/config/service-role.ts   SERVICE_ROLE route partitioning
```

---

## 7. Outstanding work

| Item | Notes |
|---|---|
| **Screenshots** | The only submission gap. Checklist in `DEPLOYMENT.md` §11. |
| **Remote Terraform state** | See §1.1. Currently a single-machine dependency. |
| **`deploy.yml` end-to-end** | The build/sign/scan path has not yet run a full green pass against live infrastructure — the environment was bootstrapped manually. Push a trivial change to `main` to exercise it. |
| Postgres migration history | Currently `prisma db push`; committed migrations are SQLite-era. |
| Redis | Re-enable if a Managed Redis SKU becomes affordable. |
| API image size | 846 MB — carries dev dependencies because the seed needs `ts-node`. Could be pruned. |
| `terraform destroy` | After judging. |

---

## 8. Demo credentials

Already public in the repo — intended for judges.

| Role | Username | Password |
|---|---|---|
| Customer | `a.perera.2065` | `Resilia2065!` |
| Officer (`/ops/signin`) | `s.jayasuriya` | `OpsConsole2065!` |

Demo OTP `482916` while `DEMO_MODE=true` · TOTP secret `JBSWY3DPEHPK3PXP`
