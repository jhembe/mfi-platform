# MFI SaaS Platform — Project Vision

**Last updated:** 2026-06-24  
**Status:** Pre-development — architecture & planning phase

---

## What We Are Building

A **multi-tenant, modular SaaS platform** for microfinance institutions (MFIs) in Tanzania.  
Any MFI — from a small community SACCO to a large institution — can sign up, choose the modules they need, and run their entire operation from one platform, branded with their own identity.

---

## Core Principles

1. **Modular** — tenants activate only the features they need. No bloat.
2. **White-label** — every tenant gets their own brand (logo, colors). Feels like their own product.
3. **Tanzania-first** — TZS currency, M-Pesa / Tigopesa / Airtel Money, Bank of Tanzania compliance built in from day one.
4. **Configurable, not rigid** — roles, branches, loan products, repayment schedules are all configurable per tenant at onboarding time.
5. **Stunning design** — not a boring grey admin panel. Fintech-grade UI with warmth.
6. **Solid backbone** — financial-grade reliability. Every transaction is auditable. No silent failures.

---

## Who Uses This

### Platform Level (us)
| Role | Responsibility |
|---|---|
| Super Admin | Manage all tenants, feature flags, billing, system health, platform analytics |

### Tenant Level (MFI staff — configurable per tenant)
| Role | Responsibility |
|---|---|
| Tenant Admin / Manager | Configure the MFI — products, staff, branches, reports |
| Branch Manager | Oversee a specific branch's portfolio and staff |
| Loan Officer / Field Agent | Onboard clients, process applications, collect repayments |
| Cashier / Teller | Handle cash transactions, deposits, withdrawals |
| Custom roles | Any additional roles the MFI defines at onboarding |

### Client Level (borrowers/members)
| User | Access |
|---|---|
| Borrower / Member | Web portal — view balance, statements, repayment schedule, apply for top-up |

> Mobile app for borrowers is a **future phase** — not in current scope.

---

## Platform Modules

Each module can be toggled on/off per tenant at onboarding.

| # | Module | Description |
|---|---|---|
| 1 | **Super Admin Panel** | Tenant management, billing, feature flags, system monitoring |
| 2 | **Tenant Onboarding** | MFI setup wizard — modules, roles, branches, branding, products |
| 3 | **Client Onboarding & KYC** | Client profiles, ID document upload, AML screening, credit scoring |
| 4 | **Loan Management** | Full loan lifecycle — application, appraisal, approval, disbursement, schedule, repayment, closure |
| 5 | **Savings & Deposits** | Member savings accounts, deposits, withdrawals, interest calculation |
| 6 | **SACCO / Group Management** | Group formation, contributions, group loans, joint liability tracking |
| 7 | **Accounting & General Ledger** | Double-entry bookkeeping, chart of accounts, vault/cash management |
| 8 | **Reports & Analytics** | BoT reports, PAR (Portfolio at Risk), aging, officer performance, dashboards |
| 9 | **Client Web Portal** | Borrower self-service — read-only + loan top-up requests |

---

## Loan Products

| Type | Description |
|---|---|
| Personal / Consumer | Short-term individual loans for personal needs |
| Business / SME | Loans for small businesses with cash flow appraisal |
| Group / Solidarity | Loans disbursed to groups with joint liability |
| Asset Financing | Tied to a specific asset (motorcycle, solar panel, phone, equipment) |
| Emergency / Quick Loans | Fast small loans, minimal process, mobile-friendly |

All loan products are **configurable per tenant** — interest rates, fees, tenure, grace periods, repayment frequency (daily / weekly / monthly).

---

## Repayment Channels

- Mobile money: **M-Pesa, Tigopesa, Airtel Money** (webhook integration + auto-reconciliation)
- **Cash** — field officer records in system, tied to vault
- **Bank transfer** — manual or automated matching
- **Automatic deduction** — standing order / scheduled pull

---

## Multi-Tenancy Architecture

**Strategy: Separate PostgreSQL schema per tenant**

- Each MFI tenant gets their own isolated schema (`tenant_abc`, `tenant_xyz`)
- Shared schema holds platform-level data (tenants, billing, feature flags)
- Strong data isolation — no cross-tenant leakage risk
- Clean per-tenant migrations and backups
- Scales well up to hundreds of tenants

---

## Branch Management

Configurable per tenant at onboarding:
- **Full branch management** — each branch has its own staff, vault, portfolio, and reports rolled up to HQ
- **Simple branch tagging** — clients/loans tagged to a branch, no separate ledger
- **Single branch / no branches** — small MFIs with one office

---

## Technology Stack

| Layer | Choice | Reason |
|---|---|---|
| Backend | **NestJS** (Node.js + TypeScript) | Modular by design, enterprise-grade, strong DI, guards/interceptors for auth & audit |
| Frontend | **Next.js** (React + TypeScript) | SSR + CSR, great for dashboards, SEO-friendly admin & client portal |
| Database | **PostgreSQL** | ACID compliant, schema-per-tenant multi-tenancy, rock-solid for ledger data |
| Caching / Queues | **Redis** | Sessions, background jobs (disbursements, statements), mobile money webhooks |
| File Storage | **MinIO** (self-hosted S3-compatible) | KYC documents, reports — stays on our server |
| ORM | **Prisma** | Type-safe, great migrations, works perfectly with PostgreSQL |
| Auth | **JWT + Refresh Tokens** | Stateless auth with role-based access control (RBAC) per tenant |
| API Style | **REST + WebSockets** | REST for CRUD operations, WebSocket for real-time dashboard updates |

---

## Design System

- **Default theme:** Clean professional fintech — blues, whites, sharp typography, trust-inspiring
- **White-label:** Each tenant configures their own primary color, logo, and brand name
- **Dark mode:** Supported as a toggle
- **Mobile-first:** All views optimized for tablets and phones (field officers use mobile browsers)
- **Component library:** Shadcn/ui + Tailwind CSS — fast, consistent, highly customizable

---

## Compliance & Regulatory (Tanzania)

| Requirement | Implementation |
|---|---|
| **Bank of Tanzania (BoT) reporting** | Built-in report templates matching BoT MFI reporting formats |
| **KYC / AML** | ID verification workflow, suspicious transaction flags, blacklist screening |
| **Data Privacy** | PII encryption at rest, access logs, consent management, data export |
| **Audit Trail** | Every action logged — who did what, when, on which record |
| **Interest rate disclosure** | Loan agreements auto-generated with APR, fees, total cost of credit |

---

## MVP Scope (Phase 1)

Build and ship in this order:

### Phase 1A — Foundation
- [ ] Project scaffolding (monorepo: backend + frontend)
- [ ] Database setup with schema-per-tenant multi-tenancy
- [ ] Super Admin: tenant onboarding wizard
- [ ] Authentication system (login, RBAC, session management)

### Phase 1B — Core Lending
- [ ] Client onboarding — profiles, ID upload, KYC workflow
- [ ] Credit scoring — basic scorecard model
- [ ] Loan product configuration (per tenant)
- [ ] Loan application → appraisal → approval workflow
- [ ] Disbursement (manual + mobile money)
- [ ] Repayment schedule generation
- [ ] Repayment recording (cash + mobile money)
- [ ] Loan account statements

### Phase 1C — Visibility
- [ ] Tenant dashboard (portfolio overview, PAR, collections today)
- [ ] Loan officer dashboard (my clients, overdue, today's collections)
- [ ] Basic BoT-style portfolio report

---

## Future Phases

- **Phase 2:** Savings accounts, SACCO/group management, accounting ledger
- **Phase 3:** Advanced analytics, officer performance scoring, predictive PAR
- **Phase 4:** Client web portal (borrower self-service)
- **Phase 5:** Mobile app for borrowers (smartphone + USSD)
- **Phase 6:** Open API for third-party integrations (credit bureaus, insurance, etc.)

---

## Hosting & Infrastructure

**Current (development):**
- Self-hosted server at `/opt/apps/MFI/`
- Docker Compose for local services (PostgreSQL, Redis, MinIO)

**Future (production):**
- VPS (Hetzner or DigitalOcean) or Tanzania/East Africa data center for BoT data residency
- Docker + Nginx reverse proxy
- Automated backups to off-site storage

---

## Project Structure (planned)

```
/opt/apps/MFI/
├── VISION.md           ← This file
├── CLAUDE.md           ← Developer guide for AI-assisted development
├── docs/               ← Architecture decisions, API specs, data models
├── backend/            ← NestJS API server
├── frontend/           ← Next.js web app (admin + client portal)
├── infra/              ← Docker Compose, Nginx config, scripts
└── shared/             ← Shared TypeScript types (used by both backend & frontend)
```
