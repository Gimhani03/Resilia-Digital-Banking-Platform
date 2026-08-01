# RESILIA

**A secure digital banking platform for post-crisis recovery**  
Duothan 6.0 · Phase 2 Rebuild · Team **Cybernauts**

RESILIA restores everyday banking — accounts, payments, credit, fraud controls, and staff operations — with security and auditability built in from the start. Phase 1’s service-oriented design is delivered here as a modular monorepo: independently owned NestJS domains, a customer mobile app, and a staff ops web console.

**How to use the apps:** see the [User Guide](./USER_GUIDE.md).

---

## Features

| Area | What you can do |
|------|-----------------|
| **Identity** | e-KYC-style onboarding, password + TOTP MFA, trusted devices, step-up for money moves |
| **Accounts** | Live balances, nicknames, freeze / unfreeze |
| **Payments** | Own-account transfers, beneficiary transfers, bill pay, QR merchant pay |
| **Fraud** | Real-time rule screening, held transactions, release or reject (+ optional card freeze) |
| **Loans** | Apply with eligibility estimate; officers approve / reject with disbursement |
| **Security** | Freeze cards/accounts, raise disputes; ops uphold / reject / refund |
| **Ops** | Health overview, dispute queue, loan desk, tamper-evident audit trail |
| **Notifications** | In-app alerts for payments, security, and loan decisions |

---

## Stack

| Layer | Technology |
|-------|------------|
| Customer app | Expo · React Native · TypeScript |
| Staff / web | React · Vite · Tailwind CSS |
| API | NestJS · modular feature services |
| Data | Prisma · SQLite (local) or Postgres + Redis (Docker) |
| Tooling | npm workspaces · GitHub Actions CI |

---

## Repository layout

```text
apps/
  api/        NestJS backend
              Identity · Accounts · Payments · Fraud · Loans
              Cards · Audit · Ops · Notifications · Providers
  mobile/     Expo customer banking app
  web/        Ops console + customer web shells
packages/
  shared/     Shared types and demo constants
scripts/      Local tooling
.github/      CI workflows
docker-compose.yml
```

Module boundaries mirror the Phase 1 architecture so domains can grow into separately deployable services later.

---

## Prerequisites

- **Node.js** 22+
- **npm** 10+
- **Expo Go** (optional, for a physical device)
- **Docker** (optional, for Postgres + Redis)

---

## Quick start

```bash
# Install dependencies, migrate SQLite, seed demo users
npm run setup

# Terminal 1 — API (required)
npm run dev:api

# Terminal 2 — customer mobile
npm run dev:mobile

# Terminal 3 — staff / ops web
npm run dev:web
```

| Surface | Where |
|---------|--------|
| API health | http://localhost:3001/api/health |
| Ops web | http://localhost:5173 · staff sign-in `/ops/signin` |
| Mobile | Expo Metro on `:8081` (simulator, emulator, or Expo Go) |

### Environment

```bash
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
```

| Mobile target | `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` |
|---------------|-----------------------------------------------|
| iOS Simulator | leave unset, or `http://localhost:3001/api` |
| Android emulator | `http://10.0.2.2:3001/api` |
| Physical device | `http://<your-lan-ip>:3001/api` |

### Optional: Postgres + Redis

```bash
npm run db:up
# Point apps/api/.env DATABASE_URL at Postgres (see .env.example)
# Align Prisma datasource provider with postgresql, then migrate + seed
```

---

## Demo credentials

| Role | Username | Password | MFA |
|------|----------|----------|-----|
| Customer | `a.perera.2065` | `Resilia2065!` | Authenticator TOTP |
| Officer | `s.jayasuriya` | `OpsConsole2065!` | Authenticator TOTP |

After `npm run setup` / seed, the console prints:

- **TOTP secret:** `JBSWY3DPEHPK3PXP` — add in Google Authenticator / Authy  
- **Demo OTP** (only when `DEMO_MODE=true`): `482916`

---

## Judge walkthrough (~3 minutes)

1. Start **API** + **mobile** → open Expo  
2. Sign in as customer → complete **TOTP MFA** → dashboard  
3. **Transfer** → on confirm, long-press the header (demo mode) until hold is on → confirm  
4. Open the **held** payment → release with MFA, or reject & freeze card  
5. Try **bills / QR**, **cards**, **freeze & dispute**, **devices**  
6. Open ops web → `/ops/signin` as officer → **Disputes**, **Loan officer**, **Audit trail**

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run setup` | Install, build shared, migrate, seed |
| `npm run dev:api` | NestJS API (watch) |
| `npm run dev:mobile` | Expo Metro |
| `npm run dev:web` | Vite web app |
| `npm run build` | Build shared + API + web |
| `npm run db:up` / `db:down` | Start / stop Postgres + Redis |
| `npm run db:migrate` / `db:seed` | Prisma migrate / seed |

---

## Engineering practices

- **Modular monorepo** — clear ownership under `apps/*` and `packages/*`  
- **Domain modules** — NestJS folders match Phase 1 capabilities  
- **CI** — GitHub Actions builds shared, validates Prisma, builds API, typechecks mobile  
- **Secrets** — local `.env` and databases are gitignored; only `.env.example` templates are committed  

---

## Functional requirements (Phase 1 → Phase 2)

| ID | Coverage |
|----|----------|
| FR-01 | Onboarding with camera ID + selfie · pending officer KYC review |
| FR-02 / FR-03 | MFA login + device step-up |
| FR-04 | Balances + categorised history |
| FR-05 | Internal + beneficiary transfers |
| FR-06 | Bills + QR payments |
| FR-07 / FR-08 | Loan apply + officer decision |
| FR-09 | Fraud hold + customer release / reject |
| FR-10 | Notification inbox (push / SMS / email channels) |
| FR-11 | USSD / agent demo shell |
| FR-12 | Ops console overview |
| FR-13 | Hash-chained audit trail |
| FR-15 | Freeze + disputes (customer + ops resolve) |

Phase 1 production targets such as Kafka, Kubernetes, HSM/Vault, and automated multi-region failover remain for the deployment phase. This rebuild proves the product journeys and module boundaries.

---

## Team

**Cybernauts** — Gimhani Samanalee · Tharushka Dinujaya · Zenith Coonghe · Ruwithma Peiris

---

## License

Hackathon demonstration project for Duothan 6.0.
