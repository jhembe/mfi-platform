# MFI Platform

A multi-tenant, modular SaaS platform for microfinance institutions (MFIs) and SACCOs in Tanzania.
Each institution signs up as a tenant, switches on the modules it needs and runs its operation under its own branding.

> **Status:** MVP about 98% built, then archived. It was never used in production. Treat it as a reference implementation or a starting point.

## Modules

| Module | What it covers |
|---|---|
| Super admin | Tenants, feature flags, subscriptions |
| Tenant onboarding | Modules, roles, branches, branding, loan products |
| Clients and KYC | Client profiles, ID documents, credit scoring |
| Loans | Application, approval, disbursement, repayment schedules, closure |
| Savings | Accounts, deposits, withdrawals, interest |
| Groups / SACCO | Group formation, contributions, group loans |
| Accounting | Double-entry general ledger, chart of accounts |
| Reports | PAR, ageing, officer performance, PDF export |
| Client portal | Borrower self-service (read-only plus top-up requests) |
| Payments | Selcom mobile-money integration (M-Pesa, Tigo Pesa, Airtel Money) |

Loan products (personal, SME, group, asset finance, emergency) are configurable per tenant: rates, fees, tenure, grace period and repayment frequency.

## Architecture

- **Backend** (`backend/`): NestJS 11 and TypeScript, Prisma, PostgreSQL 16, Redis, MinIO (object storage), JWT auth with TOTP.
- **Frontend** (`frontend/`): Next.js and React.
- **Shared** (`shared/`): types shared by both.
- **Multi-tenancy:** one PostgreSQL **schema per tenant**, plus a shared `public` schema for platform tables (`tenants`, `tenant_features`, `subscriptions`, `platform_admins`). The tenant is resolved from the `tenantId` claim in the JWT by middleware on every request. Queries never cross tenant schemas.
- **Infra** (`infra/`): Docker Compose for Postgres, Redis, MinIO, API and web.

More detail is in `VISION.md` (product scope) and `STATUS.md` (what was built, phase by phase).

## Running it

Requires Docker, and Node 20+ for local development.

```bash
# 1. Secrets for the infrastructure containers
cp infra/.env.example infra/.env        # set strong passwords

# 2. Backend and frontend settings (see "Configuration")
#    backend/.env and frontend/.env.local

# 3. Start everything
cd infra && docker compose up -d --build
```

The compose file expects external Docker networks named `edge_net` (reverse proxy) and `mail_net` (SMTP relay). Create them with `docker network create edge_net` and `docker network create mail_net`, or edit the file.

Local development without Docker:

```bash
npm install
npm run build:shared
npm run dev:backend      # http://localhost:3000, API under /api
npm run dev:frontend
```

## Configuration

Backend (`backend/.env`): `NODE_ENV`, `PORT`, `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`,
`MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`,
`JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`, `THROTTLE_TTL`, `THROTTLE_LIMIT`,
`CORS_ORIGIN`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`,
`SELCOM_BASE_URL`, `SELCOM_API_KEY`, `SELCOM_API_SECRET`, `SELCOM_VENDOR_ID`, `SELCOM_CALLBACK_URL`, `FRONTEND_URL`.

Frontend (`frontend/.env.local`): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL`.

Use long random values for every secret. Payments and SMS stay disabled until their credentials are set.

## Tests

```bash
npm test
```

## Licence

No licence has been chosen. Until one is added, all rights are reserved.
