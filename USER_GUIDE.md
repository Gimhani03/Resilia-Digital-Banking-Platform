# RESILIA User Guide

Team **Cybernauts** · Duothan 6.0 · Phase 2 Rebuild

This guide explains how to run RESILIA and how to use each major feature as a **customer** or as a **bank officer**.

---

## 1. Before you start

### What you need

- Node.js 22+
- npm 10+
- Optional: Expo Go on a phone, Docker for Postgres/Redis

### Start the system

```bash
# One-time setup (install, migrate SQLite, seed demo data)
npm run setup

# Terminal 1 — API (required)
npm run dev:api

# Terminal 2 — customer mobile app
npm run dev:mobile

# Terminal 3 — staff / ops web
npm run dev:web
```

| App | How to open |
|-----|-------------|
| API | http://localhost:3001/api/health |
| Customer mobile | Expo Metro (`:8081`) → simulator, emulator, or Expo Go |
| Staff ops web | http://localhost:5173 → `/ops/signin` |

### Demo accounts

| Role | Username | Password | MFA |
|------|----------|----------|-----|
| Customer | `a.perera.2065` | `Resilia2065!` | Authenticator TOTP |
| Officer | `s.jayasuriya` | `OpsConsole2065!` | Authenticator TOTP |

After seeding, the API console prints:

- **TOTP secret:** `JBSWY3DPEHPK3PXP` — add this in Google Authenticator / Authy  
- **Demo OTP** (only if `DEMO_MODE=true`): `482916`

### Phone talking to the API

In `apps/mobile/.env`:

| Device | `EXPO_PUBLIC_API_URL` |
|--------|------------------------|
| iOS Simulator | leave unset or `http://localhost:3001/api` |
| Android emulator | `http://10.0.2.2:3001/api` |
| Physical phone | `http://<your-computer-LAN-IP>:3001/api` |

---

## 2. Customer app (mobile)

The customer app is the everyday banking experience: balances, transfers, bills, loans, security, and notifications.

### 2.1 Sign in

1. Open the app → **Sign in**  
2. Enter customer username and password  
3. Enter the **6-digit TOTP** from your authenticator  
4. You land on the **Dashboard**

If the device is new/untrusted, the system treats that as a security step-up (MFA required).

### 2.2 Dashboard & accounts

- See **available balance** and recent activity  
- Open **Accounts** for account detail, nickname, and freeze status  
- Use quick actions for Transfer, Payments, Loans, etc.

### 2.3 Transfer money

**To someone else (beneficiary / other bank-style transfer)**

1. Go to **Transfer**  
2. Pick or add a beneficiary  
3. Enter amount → review fees  
4. On **Confirm**, complete **step-up MFA**  
5. Submit  

**Between your own accounts**

1. Transfer → **Internal transfer**  
2. Choose from/to accounts, amount  
3. Complete MFA → submit  

**Demo: show fraud hold to judges**

1. On the Confirm transfer screen, **long-press** the top-right / header area until you see hold mode on (demo mode only)  
2. Confirm the transfer  
3. The payment is **HELD** instead of settling immediately  
4. Open the held transaction → **Release** (with MFA) or **Reject & freeze card**

This demonstrates FR-09: suspicious payments can be frozen before settlement.

### 2.4 Pay bills & QR

**Bills**

1. Open **Payments / Bills**  
2. Choose a biller  
3. Enter amount / account hint as required  
4. Complete MFA → pay  

**QR merchant pay**

1. Open **QR Pay**  
2. Allow camera (or pick a demo merchant in demo mode)  
3. Confirm amount → MFA → pay  

### 2.5 Cards

1. Open **Cards**  
2. View debit/credit-style cards  
3. **Freeze** or **Unfreeze** a card  
4. Adjust limits / controls where shown (online, contactless, etc.)

### 2.6 History

1. Open **History**  
2. Filter / browse transactions  
3. Open a transaction for detail  
4. From detail you can **Raise a dispute** if the charge looks wrong  

### 2.7 Freeze & disputes (Security)

Think of this as your emergency toolkit.

**Freeze (stop money moving now)**

1. Profile / More → **Security** (Freeze & dispute)  
2. Under **Cards** or **Accounts**, tap **Freeze**  
3. Status becomes Frozen; tap **Unfreeze** when safe again  

Freezing locks the card/account. It does **not** reverse a past charge by itself.

**Dispute (ask the bank to investigate)**

1. From **Security**, enter a reason (and optional transaction ID), or  
2. From **History → transaction detail → Raise dispute**  
3. Submit → status starts as **OPEN**  
4. Later, when an officer decides, status becomes **RESOLVED** or **REJECTED** and you may see their resolution note  
5. Check **Notifications** for the outcome  

### 2.8 Loans

1. Open **Loans**  
2. Tap **Apply for credit**  
3. Choose product (Personal / Business / Working capital)  
4. Enter amount, tenure, monthly income, purpose  
5. View **eligibility score**, estimated **instalment**, and recommendation  
6. Submit → status **SUBMITTED**  

Open the loan later to see **SUBMITTED**, **APPROVED**, or **REJECTED**.  
If approved, money is disbursed into your account (see Accounts / History).

### 2.9 Profile, devices & notifications

- **Profile** — view/edit basic profile details  
- **Trusted devices** — approve or deny pending devices  
- **Notifications** — security, payment, and loan alerts  
- **Statements** — view statement-style history where available  

### 2.10 Onboarding (new customer)

1. Open **Onboarding**  
2. Follow steps: identity details → document type → upload ID image → password / MFA enrolment  
3. Finish and sign in with the new credentials / TOTP setup shown  

---

## 3. Staff / ops web

Officers use the **full-screen ops console**, not the phone-framed customer login.

### 3.1 Staff sign-in

1. Open http://localhost:5173/ops/signin  
2. Sign in as `s.jayasuriya` / `OpsConsole2065!`  
3. Enter TOTP  
4. You enter the **Ops Console**  

Customer accounts should use the mobile app (or customer web paths), not the staff portal.

### 3.2 Security overview

- Platform uptime / screening volume (demo KPIs)  
- **Active fraud holds** and **open disputes** counts  
- Service health list and alert cards  

### 3.3 Disputes (officer)

1. Sidebar → **Disputes**  
2. Filter **OPEN** (or RESOLVED / REJECTED / ALL)  
3. Select a case — see customer, reason, linked transaction, cards/accounts  
4. Write a **resolution note**  
5. Actions:  
   - **Uphold customer** → mark RESOLVED; optionally **credit refund** (settled outbound txn)  
   - **Reject dispute** → mark REJECTED with note  
   - **Freeze** card or account from the case while reviewing  
6. Customer is notified of the outcome  

### 3.4 Loan officer

1. Sidebar → **Loan officer**  
2. Select an application from the queue  
3. Review amount, eligibility, DTI, AI recommendation, flags  
4. **Approve** (disburses to customer account) or **Reject**  

### 3.5 Audit trail

1. Sidebar → **Audit trail**  
2. Browse tamper-evident events (payments, auth, security, admin, etc.)  
3. Run / view integrity checks on the hash chain  

---

## 4. Suggested demo script (~3 minutes)

1. Start API + mobile + (optional) web  
2. Customer sign-in + TOTP → dashboard  
3. Transfer with **demo hold** → open held txn → release or reject+freeze  
4. Raise a **dispute** from History or Security  
5. Officer login → **Disputes** → uphold (with refund) or reject  
6. Customer applies for a **loan** → officer **Approves** → customer sees credit + notification  
7. Show **Audit trail** for immutable evidence  

---

## 5. Troubleshooting

| Problem | What to try |
|---------|-------------|
| Mobile “Unmatched Route” / blank | Use Metro on **8081**; reload Expo Go; avoid stale port 8082 |
| Web login `ECONNREFUSED` | Start API: `npm run dev:api` |
| MFA fails | Re-seed or confirm authenticator uses secret `JBSWY3DPEHPK3PXP` and phone time is correct |
| Phone can’t reach API | Set LAN IP in `apps/mobile/.env`; same Wi‑Fi as the computer |
| EMFILE / Metro watcher errors | Install Watchman (`brew install watchman`) |
| No demo hold switch | Ensure `EXPO_PUBLIC_DEMO_MODE=true` in mobile `.env` |

---

## 6. Roles at a glance

| Task | Customer (mobile) | Officer (ops web) |
|------|-------------------|-------------------|
| View balances / transfer / pay bills | Yes | — |
| Freeze own card/account | Yes | Yes (from dispute case) |
| Raise dispute | Yes | — |
| Resolve dispute / refund | — | Yes |
| Apply for loan | Yes | — |
| Approve / reject loan | — | Yes |
| Release / reject fraud hold | Yes (own txn) | Overview of holds |
| Audit log | — | Yes |

---

## 7. More documentation

- Project setup, stack, and FR summary: [`README.md`](./README.md)  
- API health: `GET /api/health`  

For questions during judging, use the demo accounts above and the walkthrough in section 4.
