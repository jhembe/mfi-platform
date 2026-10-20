# MFI Platform — Build Status

> Quick-reference for resuming work. Update this file at the end of every session.
> Last updated: 2026-06-25 (Session 3)

---

## Overall Progress: ~98% of planned MVP

Phases 1, 2, 3, and deferred enhancements are complete.

---

## Phase 1A — Foundation (100% ✅)

All auth, tenant infrastructure, super admin, Docker stack, and shared types are live.

---

## Phase 1B — Client & Loan Core (100% ✅)

Clients, KYC, loan products, full loan lifecycle (DRAFT → ACTIVE → CLOSED), repayment schedule, ledger entries.

---

## Phase 1C — Visibility (100% ✅)

KPI dashboard (PAR30/90, collections, disbursements), loan list with filters.

---

## Phase 2 — Extended Modules (100% ✅)

| Item | Status | Notes |
|------|--------|-------|
| Savings module | ✅ Done | Products, accounts, deposit/withdraw/close/freeze |
| Groups/SACCO module | ✅ Done | Groups, members, contributions |
| Accounting module | ✅ Done | COA (26 seeded accounts), journal entries, trial balance |
| Reports module | ✅ Done | Portfolio, disbursements, collections, savings, clients, BoT |
| Selcom mobile money | ✅ Done | USSD push + HMAC callback reconciliation |

---

## Phase 3 — Admin Operations & Self-Service (100% ✅)

| Item | Status | Notes |
|------|--------|-------|
| Staff user management | ✅ Done | `/dashboard/users` — CRUD, roles, activate/deactivate, password reset |
| Credit scoring engine | ✅ Done | 6-factor scorecard, 100pts, grade A–F, `GET /api/credit-scoring/loans/:id` |
| Client portal | ✅ Done | Phone+PIN auth, read-only loans/savings at `/portal/[slug]/...` |

---

## UI / Frontend Redesign (Session 3 — 2026-06-25) ✅

| Item | Status | Notes |
|------|--------|-------|
| Light mode forced | ✅ Done | Dark mode OS preference overridden in `globals.css`; `color-scheme: light` on `:root` and `html` |
| Design system refresh | ✅ Done | New secondary color `#0D9488` (teal); background `#F7F8FA`; card shadow utility; updated border/success/warning/destructive tokens |
| Login page redesign | ✅ Done | Split panel: navy+teal gradient left (abstract circles + feature checklist), clean white right |
| Sidebar redesign | ✅ Done | White bg, teal left-border active state, teal avatar initial, hover-red sign out |
| Dashboard top bar | ✅ Done | Sticky 60px header with tenant name, date, avatar — replaces the kanga-pattern header block |
| Dashboard KPI cards | ✅ Done | Colored left borders, 30px bold numbers, no icon-dominance, hover shadow |
| Dashboard charts | ✅ Done | `recharts@3.9.0` installed; area chart (8-month collections trend) + PAR donut (grade A–F center label) |
| Mobile layout | ✅ Done | 2-col KPI grid on mobile, full-width charts stacking, hamburger drawer with backdrop blur |
| Onboarding: welcome modal | ✅ Done | First-login only; localStorage key `mfi_welcome_shown_v1`; navy→teal gradient header + 3 feature tiles |
| Onboarding: getting started | ✅ Done | Persistent dashboard checklist; 5 steps; auto-detects client/loan completion from live stats; localStorage key `mfi_onboarding_v1` |

## Deferred / Future

| Item | Priority | Notes |
|------|----------|-------|
| E2E testing with live data | ✅ Done | Full smoke test completed session 2; 19 bugs fixed (see E2E Bringup Bugs memory) |
| Loan officer view | ✅ Done | `GET /loans?officerId=`, `GET /loans/officer-stats` · "My Loans" toggle on loans list · officer KPI section on dashboard (role-aware) |
| SMS push notifications | ✅ Done | Africa's Talking integration (`SmsModule`) · SMS on loan disbursement (Swahili) · manual "Send Reminder" button on active loans |
| Printable portfolio report | ✅ Done | "Print" button on reports page → browser print dialog with print CSS · "CSV" export button (client-side) |
| Credit bureau integration | Medium | Creditinfo Tanzania / CRB Africa API — plug in as extra scoring factor |
| tenant_features in localStorage | Medium | After login, store feature list so sidebar shows all nav items. Currently sidebar only shows Dashboard + Staff until page reload or feature population. |

---

## What's on Disk

### Backend modules (`backend/src/`)

| Module | Key endpoints |
|--------|---------------|
| `auth/` | POST /login, POST /refresh, GET /auth/tenant/:slug |
| `super-admin/` | /super-admin/tenants, /super-admin/platform-admins |
| `clients/` | CRUD + KYC upload/verify |
| `loans/` | Products + full lifecycle + stats |
| `savings/` | Products + accounts + transactions + stats |
| `groups/` | Groups + members + contributions + stats |
| `accounting/` | Accounts + journal entries + trial balance + statements |
| `reports/` | portfolio, disbursements, collections, savings, clients, bot |
| `payments/` | Selcom USSD push + POST /payments/callback (public, @Public) |
| `users/` | Staff CRUD — TENANT_ADMIN only |
| `credit-scoring/` | GET /credit-scoring/loans/:id |
| `client-portal/` | POST /portal/register, POST /portal/login, GET /portal/me,loans,savings |
| `storage/` | MinIO presigned URLs |

### Tenant Schema Tables (`backend/prisma/tenant-schema-template.sql`)

clients, kyc_documents, loan_products, loan_accounts, repayment_schedule, ledger_entries,
savings_products, savings_accounts, savings_transactions,
groups, group_members, group_contributions,
accounts (26 seeded COA entries), journal_entries, journal_entry_lines,
payment_requests, portal_users

### Shared Enums (`shared/src/enums/index.ts`)

LoanStatus, FeatureKey, UserRole, PaymentChannel, InterestMethod, RepaymentFrequency,
GroupType, GroupMemberRole, GroupStatus, AccountType, JournalEntryStatus,
PaymentRequestStatus, SavingsAccountStatus, SavingsTransactionType, InterestFrequency

### Frontend pages (`frontend/app/`)

```
(auth)/login, forgot-password, reset-password
dashboard/
  page.tsx                        ← KPI dashboard
  clients/     [list, new, [id]]
  loan-products/ [list, new]
  loans/       [list, new, [id]]  ← Overview + Credit Score + Schedule + Ledger tabs
  savings/     [list, new, [id]]
  groups/      [list, new, [id]]
  accounting/  [page, journal-entries/new, journal-entries/[id]]
  reports/
  users/       [list, new]        ← staff management
  portal/                         ← portal admin page (link + instructions)
portal/[slug]/
  login/
  register/
  dashboard/
  loans/[loanId]/
```

### Frontend API clients (`frontend/lib/api/`)

auth, clients, loan-products, loans, savings, groups, accounting, reports,
payments, users, credit-scoring, portal, super-admin

---

## Critical Conventions

- `@RequireFeature` is in `src/common/decorators/feature.decorator.ts` (NOT require-feature.decorator)
- Portal public endpoints (register/login): accept `tenantSlug` in body, resolve tenant directly via PrismaService — no TenantContextService
- Portal JWT: `{ sub, clientId, tenantId, isPortalUser: true }` — tenant middleware sets context from it for authenticated portal routes
- Financial amounts: bigint in DB, `Number()` in API responses, `formatTZS()` in UI
- `Input` component: `label` prop renders label above; `className` targets the inner `<input>` element
- Selcom callback: `rawBody: true` in NestFactory.create, `@Public()` on the endpoint
- New tenant provisioning runs `tenant-schema-template.sql` inside Docker network (see infra-context memory)

---

## Super Admin Bootstrap (first time setup)

```bash
# 1. Create first platform admin
curl -X POST https://mfi.mahembega.com/api/super-admin/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mahembega.com","password":"<strongpassword>","firstName":"System","lastName":"Admin"}'

# 2. Login
curl -X POST https://mfi.mahembega.com/api/super-admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mahembega.com","password":"<password>"}'

# 3. Create first tenant
curl -X POST https://mfi.mahembega.com/api/super-admin/tenants \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo SACCO","slug":"demo-sacco","brandPrimary":"#1E3A5F"}'
```

---

## Start the Stack

```bash
cd /opt/apps/MFI/infra && docker compose up -d mfi_db mfi_redis mfi_minio
cd /opt/apps/MFI/backend && npm run start:dev
cd /opt/apps/MFI/frontend && npm run dev
```

## Production Deployment (live at mfi.mahembega.com)

```bash
# Build frontend (run from monorepo root — Dockerfile uses monorepo context)
cd /opt/apps/MFI && docker build -f frontend/Dockerfile -t mfi_web:latest .

# Start frontend container (mfi_web runs standalone, NOT via compose)
docker stop mfi_web && docker rm mfi_web
docker run -d --name mfi_web --network mfi_internal \
  -e NEXT_PUBLIC_API_URL=https://mfi.mahembega.com/api \
  -e PORT=3001 \
  --restart unless-stopped mfi_web:latest

# If Caddy can't reach mfi_web (502), ensure Caddy is on mfi_internal:
docker network connect mfi_internal caddy
```

## Known Credentials (Demo SACCO)

| Role | Email / Phone | Password / PIN |
|------|--------------|----------------|
| Super Admin | admin@mahembega.com | Admin@12345! |
| Tenant Admin | manager@demo-sacco.com | Manager@12345! |
| Client Portal | +255712345678 | PIN: 1234 |

Org code for login: `demo-sacco`
