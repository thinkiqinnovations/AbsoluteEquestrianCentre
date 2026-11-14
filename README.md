# Absolute Equestrian Scheduler

Absolute Equestrian Scheduler is a TypeScript monorepo for managing school horses, riders, coaches, lessons, and daily and weekly riding schedules.

## Development Status

**Iteration 2 adds the weekly calendar and availability management.** The daily schedule, horse/rider/coach management, ranked horse preferences, part-board placeholder, and Render/Supabase deployment path remain available.

Implemented through Iteration 2:

- React, Vite, Material UI, React Router, and TanStack Query frontend
- Express and TypeScript API with Zod request validation
- Prisma-backed PostgreSQL persistence for Supabase, including an initial migration
- Seeded no-database development fallback for local inspection when `DATABASE_URL` is absent
- Single-service production build: Express serves the React/Vite build and API from one Render web service
- Render Blueprint (`render.yaml`) and Supabase connection variable template
- CRUD endpoints and UI for horses, riders, and coaches
- Lesson creation, date navigation, daily workload summaries, and workload progress states
- Backend conflict rules for horse/rider/coach double booking, workload limit, rider suitability, and jumping capability
- Conflict-rule unit tests
- Weekly calendar with coach, horse, rider, and discipline filters, and lesson creation from calendar time slots
- Lesson editing, recurring availability, date overrides, and server-side availability validation

Authentication, recurring lessons, automatic scheduling, and billing functionality are deferred.

- [x] Billing feature capability flag
- [x] Provider-independent billing interface
- [x] Disabled billing provider
- [x] Client-safe application config endpoint
- [x] Tests proving billing remains disabled
- [ ] Billing database models
- [ ] Billing account management
- [ ] Price catalogue
- [ ] Active billing provider
- [ ] Checkout
- [ ] Invoices
- [ ] Refunds
- [ ] Webhook processing
- [ ] Billing administration UI

## Repository layout

```text
apps/web       React user interface
apps/api       Express API and scheduling rules
packages/shared Shared enums, Zod schemas, and domain configuration
prisma         PostgreSQL Prisma schema
```

## Run locally

Requirements: Node.js 20+ and pnpm.

```bash
pnpm install
pnpm prisma:generate
pnpm --filter @absolute/shared build
pnpm dev
```

The web app runs at `http://localhost:5173` and proxies API requests to `http://localhost:3001`. Without a `DATABASE_URL`, the API uses disposable seeded data. With `DATABASE_URL` and `DIRECT_URL`, it uses PostgreSQL.

## Verification commands

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

## Database and deployment

The production deployment is one Render Node.js web service, using Supabase PostgreSQL:

```text
Namecheap domain/DNS → Render web service (Express + React build) → Supabase Postgres
```

See [deployguide.md](deployguide.md) for the full Supabase, Render, verification, and Namecheap DNS procedure.

1. In Supabase, create a project and obtain:
   - the Session Pooler connection string for `DATABASE_URL`;
   - the direct connection string for `DIRECT_URL`.
2. In Render, create a Blueprint from this GitHub repository. `render.yaml` supplies the build (including the Prisma migration), start, health-check, and Node environment configuration.
3. Enter `DATABASE_URL` and `DIRECT_URL` as secret Render environment variables. Do not commit them.
4. The Blueprint uses Render's `free` plan for a no-cost pilot. It sleeps after inactivity; use a paid always-on plan before staff depend on the service day to day.
5. Point the Namecheap domain to the Render service according to Render’s custom-domain instructions. Express serves both the application and its API under that domain, so `CORS_ORIGIN` is optional. Set it only if a separate frontend origin is introduced.

For local database development, copy `.env.example` to `.env`, add the two Supabase URLs, then run:

```bash
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm dev
```

Prisma migrations are stored in `prisma/migrations/`. Apply the availability migration before running Iteration 2 against an existing PostgreSQL database. Existing lessons require no data conversion.

## Scheduling and availability

- To book a shared session, add one lesson per rider and horse with the same coach, date, start and end times, discipline, and lesson type. Choose **Semi-private** for up to two riders or **Group** for a larger session. Each rider and horse still has its own booking, availability checks, and workload rules. Other overlapping sessions with the same coach are rejected.

- `APP_TIME_ZONE` defaults to `America/Toronto`. The scheduler exchanges barn-local dates (`YYYY-MM-DD`) and wall-clock times (`HH:mm`). The API supplies the configured time zone to the web app. Date navigation and weekly rules use civil calendar arithmetic.
- Switch between **Day** and **Week** on the Schedule page. The Material UI weekly grid defaults to 8 AM–9 PM and expands for lessons outside those hours. Select a lesson to edit it or select a time slot to open Add Lesson with that date and time filled in.
- Open **Availability** for a rider, coach, or horse to manage multiple weekly windows and dated overrides. Overrides take precedence over recurring rules. When available and unavailable windows of the same precedence overlap, unavailable wins. The editor rejects redundant overlapping windows of the same type.
- A resource with recurring rules is unavailable outside its configured windows unless an override opens the requested period. A resource without recurring rules is unspecified outside any applicable override. Unspecified availability produces a warning and permits scheduling. An unavailable period blocks new bookings and edits to active lessons. Availability is independent of existing bookings and horse workload.
- Intervals are half-open. A lesson may end where an unavailable interval begins. Times must be in increasing order on the same date. Overnight windows are unsupported.
- `GET /api/schedule/week?start=YYYY-MM-DD` and `GET /api/availability/:resourceType/:resourceId/week?start=YYYY-MM-DD` require a valid Monday and return HTTP 400 otherwise. The weekly schedule includes rider, horse, and coach projections. The lesson form requests a single availability preview for the proposed interval, and the API validates again on create or update. The existing lesson PUT endpoint still accepts a full replacement. PATCH accepts partial lesson edits.
- Weekly rules and overrides use separate indexed tables keyed by resource type and ID. The API validates resource references because a single PostgreSQL foreign key cannot target all three resource tables. Seeded local mode includes example rules and overrides. PostgreSQL starts with no availability configured for existing resources.

### Production launch note

This iteration intentionally does **not** include authentication or authorization. Do not expose real rider, coach, or operational data to users until authentication, role-based access, and Supabase Row Level Security are implemented.

## Feature Flags

`BILLING_ENABLED=false` remains the API default in Iteration 2. The API rejects invalid values and refuses to start with `BILLING_ENABLED=true` because no active provider is installed. Set environment variables in the API process or hosting environment. `GET /api/config` exposes only the public capability, `{"features":{"billing":false}}`.

## Deferred Billing Architecture

Billing remains unavailable and the application collects no financial data. Scheduling runs independently of billing. `DisabledBillingProvider` rejects every charge operation with `BILLING_DISABLED`. A later iteration may integrate Stripe through the provider interface. The current application has no Stripe SDK or payment integration.

### Future Billing Architecture

The following models are proposed for a later iteration. Billing owns its statuses and references scheduling records by internal ID.

| Proposed model | Responsibility |
| --- | --- |
| `BillingAccount` | Optional unique rider ID, provider, unique provider customer ID, default CAD currency, and timestamps |
| `BillingCharge` | Billing account ID, typed reference and internal reference ID, integer amount, currency, charge status, unique provider payment ID and idempotency key, description, and timestamps |
| `BillingInvoice` and `BillingInvoiceLine` | Invoice lifecycle and line items |
| `BillingCredit` | Credits applied to billing accounts |
| `BillingWebhookEvent` | Verified provider events and idempotent processing records |

Index charges by reference type and ID, and by billing account and status. The billing service validates references to lessons, part-board agreements, and other records. A polymorphic charge reference has no direct foreign key to Lesson. Future charge states may include pending, requires action, succeeded, failed, cancelled, refunded, and partially refunded. These models are documentation only.

A future billing service will validate the reference, resolve the rider's billing account, look up the server-owned price, create a pending internal charge, call the provider, and store its reference. It will verify webhook events and process them idempotently to update charge state. A future client request can submit a reference type, reference ID, and price code such as `PRIVATE_LESSON_60_MIN`. The backend determines the authoritative amount.

## Decisions / Assumptions

- Billing and scheduling are separate bounded contexts. Lessons and other scheduling records contain no payment-provider fields.
- Billing defaults to disabled. Enabling it without a configured provider stops API startup.
- Prices use integer minor units. The intended initial currency is CAD, where $75.00 is stored as 7500.
- Part-board free rides are scheduling entitlements. A future agreement can track rides allowed, rides used, and period dates, with usage recorded independently of provider availability. A subscription may fund the entitlement in a later iteration.

## Next Iteration

Recurring lessons, waitlists, authentication, role-based access, Supabase Row Level Security, part-board agreements, arena scheduling, notifications, and automatic scheduling remain future work. Billing will have its own later iteration.
