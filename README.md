# Absolute Equestrian Scheduler

Absolute Equestrian Scheduler is a TypeScript monorepo for managing school horses, riders, coaches, lessons, and daily and weekly riding schedules.

## Development Status

**Iteration 4 is complete.** It includes explainable horse recommendations in Add/Edit Lesson, plus Day, Week, and Month scheduling, availability, shared-coach bookings, part boarding, recurring lessons, and manual payment-status records.

Implemented through Iteration 4:

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
- Part-board agreements, ranked ride preferences, weekly and monthly entitlements, and linked horse and rider profiles
- Weekly lesson and self-ride templates with persisted occurrences, generation reports, and duplicate prevention
- Deterministic horse eligibility, ranking, and explanations in Add/Edit Lesson

Authentication, automatic schedule generation, and active billing are deferred.

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

## User documentation

- [User Guide](docs/USER_GUIDE.md) — day-to-day staff workflow and feature guidance.
- [Light Test Cases](docs/TEST_CASES.md) — Iteration 4 manual smoke tests and release checks.

## Demo Data

All demo data is fictional. The same core fixtures provide demo names, schedules, availability, and part-board records for seeded-memory mode and the PostgreSQL seed in `prisma/seed.ts`. PostgreSQL also starts with persisted examples of both kinds of recurring occurrence. Billing stays disabled.

The fixtures use the current barn-local date in `APP_TIME_ZONE` (default `America/Toronto`). The seed fills today, every day of the current and next weeks, and extra dates in the current and following months. Stable fixture IDs allow reseeding to refresh demo dates and values without inserting a duplicate set.

The dataset includes:

- Four horses, three riders, two coaches, and ranked horse preferences. Flat and Jump lessons show light workload, near capacity, and at-capacity horses.
- Recurring availability for all three resource types, plus dated exceptions. Some resources demonstrate unconfigured availability.
- Active and ended part-board agreements, ranked ride preferences, and available, partially used, and exhausted entitlements.
- Regular and part-board recurring templates with persisted occurrences. Select **Generate lessons** for Emma's recurring ride to see a failed occurrence caused by Sassy's rest override.
- Fictional paid, unpaid, and unrecorded examples for lesson, monthly, and part-board payment status.
- Recommendation fixtures for Emma Roberts include ranked preferences, recent completed assignments on Sassy, and a Sassy farrier override two days after seeding from 4–5 PM.

To try recommendations, open Add Lesson for Emma. Choose a **Flat** private lesson tomorrow at **3–4 PM** for **0.75 ride units** to see Sassy's preference and history score. Move it to **4–5 PM two days after seeding** to see the farrier exclusion and Lindon as an eligible alternative. Try **Jump** to see the jump-capability and rider-level exclusions. Today's workload excludes horses when a proposed ride would push them above their capacity. For a **Part-board ride**, choose tomorrow at **3–4 PM** and clear the free-ride entitlement checkbox if the demo allowance is exhausted. Sassy is the only linked horse for Emma.

### Populate or refresh a PostgreSQL demo

Create an empty disposable development database. In PowerShell, replace the example connection string with your local credentials. Set the variables in the same terminal used to run the commands.

```powershell
$env:DATABASE_URL = 'postgresql://postgres:YOUR_LOCAL_PASSWORD@localhost:5432/aec_demo'
$env:DIRECT_URL = $env:DATABASE_URL
$env:APP_TIME_ZONE = 'America/Toronto'
$env:BILLING_ENABLED = 'false'
$env:DEMO_SEED = '1'
pnpm install
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm db:seed
pnpm build
pnpm start
```

Open [the local scheduler](http://localhost:3001/). Use another port via the `PORT` environment variable if 3001 is in use. To refresh the demo, stop the app and run `pnpm db:seed` again with the same environment, then start the app. Reseeding updates fixture records and leaves bookings you added through the app in place.

### Reset the disposable demo database

The following command clears all records in the configured database. Use it only with your disposable development database. Stop the app before resetting.

```powershell
pnpm exec prisma migrate reset --force --skip-seed --schema prisma/schema.prisma
pnpm db:seed
pnpm start
```

Without `DATABASE_URL`, the local app uses recurring, date-aware seeded-memory fixtures and resets them on restart.

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

Prisma migrations are stored in `prisma/migrations/`. Apply pending migrations before starting the updated API against an existing PostgreSQL database. Existing lessons require no manual data conversion.

## Scheduling and availability

- To book a shared session, add one lesson per rider and horse with the same coach, date, start and end times, discipline, and lesson type. Choose **Semi-private** for up to two riders or **Group** for a larger session. Each rider and horse still has its own booking, availability checks, and workload rules. Other overlapping sessions with the same coach are rejected.

- `APP_TIME_ZONE` defaults to `America/Toronto`. The scheduler exchanges barn-local dates (`YYYY-MM-DD`) and wall-clock times (`HH:mm`). The API supplies the configured time zone to the web app. Date navigation and weekly rules use civil calendar arithmetic.
- Switch between **Day** and **Week** on the Schedule page. The Material UI weekly grid defaults to 8 AM–9 PM and expands for lessons outside those hours. Select a lesson to edit it or select a time slot to open Add Lesson with that date and time filled in.
- Open **Availability** for a rider, coach, or horse to manage multiple weekly windows and dated overrides. Overrides take precedence over recurring rules. When available and unavailable windows of the same precedence overlap, unavailable wins. The editor rejects redundant overlapping windows of the same type.
- A resource with recurring rules is unavailable outside its configured windows unless an override opens the requested period. A resource without recurring rules is unspecified outside any applicable override. Unspecified availability produces a warning and permits scheduling. An unavailable period blocks new bookings and edits to active lessons. Availability is independent of existing bookings and horse workload.
- Intervals are half-open. A lesson may end where an unavailable interval begins. Times must be in increasing order on the same date. Overnight windows are unsupported.
- `GET /api/schedule/week?start=YYYY-MM-DD` and `GET /api/availability/:resourceType/:resourceId/week?start=YYYY-MM-DD` require a valid Monday and return HTTP 400 otherwise. The weekly schedule includes rider, horse, and coach projections. The lesson form requests a single availability preview for the proposed interval, and the API validates again on create or update. The existing lesson PUT endpoint still accepts a full replacement. PATCH accepts partial lesson edits.
- Weekly rules and overrides use separate indexed tables keyed by resource type and ID. The API validates resource references because a single PostgreSQL foreign key cannot target all three resource tables. Seeded local mode includes example rules and overrides. PostgreSQL starts with no availability configured for existing resources.

## Schedule Views

Day, Week, and Month are projections over the same lessons. Availability, workload, compatibility, double booking, and validation rules remain in the API. The selected date and view can be bookmarked, for example `/schedule?view=month&date=2026-11-14`.

- **Day** shows detailed lessons, horse workload, and scheduling notices. It uses `GET /api/schedule?date=YYYY-MM-DD`.
- **Week** shows seven days of lesson blocks for short-term resource planning. It uses `GET /api/schedule/week?start=YYYY-MM-DD`.
- **Month** shows lesson counts, compact previews, and labelled conflict, availability, and workload indicators. It loads the month from `GET /api/schedule/month?year=YYYY&month=MM`. Select a date or **+N more** to open Day view, or select a lesson to edit it in place. On phones the month appears as a scrollable agenda. Adjacent dates in the desktop grid are muted and link to Day view.

Day, Week, and Month share coach, horse, rider, discipline, and lesson-type filters. Month workload indicators reflect the full daily workload of horses represented by the filtered lessons. Coach-less part-board rides are labelled in all three views.

## Part Boarding

A `PartBoardAgreement` links a rider and horse through foreign keys. It records inclusive start and end dates, status, configurable entitlement terms, priority, and notes. The Part Board page shows active agreements by default and can filter by status, rider, and horse. Staff can create, edit, pause, or end agreements while retaining their history. A `PartBoardPreferredRideTime` is a ranked weekly preference. Only scheduled lessons and explicit availability rules affect bookings.

### Horse Profiles

**Part Boarders** lists the horse's linked riders, agreement statuses and dates, entitlements, and preferred times, with links to the agreements.

### Rider Profiles

**Part Board Horses** lists the rider's linked horses, current entitlement balances, and preferred times, with links to the agreements.

## Free-Ride Entitlements

Agreements define a free-ride allowance per Monday–Sunday week or calendar month in the barn timezone. Remaining rides equal the allowance minus usage within that period, with a minimum displayed balance of zero. Free rides are operational entitlements independent of billing. Seeded allowances are demo values. The school can set its actual allowance per agreement.

Part-board rides use the existing Lesson model and allow a coach-less self ride. Booking requires an effective agreement and passes normal rider and horse availability, compatibility, double-booking, and workload checks. By default a ride consumes one entitlement. Staff may explicitly schedule a ride without using an entitlement. An exhausted allowance blocks attempted consumption. Saving a booking and its usage is atomic in PostgreSQL. Cancelling a ride before completion reverses usage while retaining its record. Completed rides keep their entitlement details.

## Recurring Lessons

A `RecurringLessonTemplate` stores a weekly rule and can reference a part-board agreement. Use **Generate lessons** in Part Board to create persisted occurrences through the standard lesson validator. The generation report lists successful, skipped, and failed dates. An occurrence's original template/date pair stays unique even if staff later move the lesson. Pausing, ending, or editing a template only affects future generation. The seeded preview includes regular and part-board templates, an exhausted weekly balance, and a horse-rest override that blocks the first demo self-ride occurrence.

## Scheduling Priority

Part-board recurring rides default to 100 and other recurring lessons default to 80. Standard lessons and flexible requests have defaults of 50 and 25. Within the generation horizon, a valid upcoming part-board occurrence takes priority when a new or rescheduled ordinary booking would block the ride or use up its horse's daily workload. This applies to active recurring templates with effective agreements. Preferred ride times alone do not hold a slot. Existing bookings stay in place, and priority never bypasses availability, entitlement, workload, booking conflicts, or compatibility.

## Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_TIME_ZONE` | `America/Toronto` | Barn-local operational date |
| `MAX_ACTIVE_PART_BOARDERS_PER_HORSE` | `1` | Maximum concurrent active agreements per horse |
| `RECURRING_LESSON_GENERATION_WEEKS` | `8` | Forward horizon from the current barn date |
| `HORSE_RECOMMENDATION_HISTORY_DAYS` | `30` | Lookback for prior rider assignments, from 1 to 365 days |
| `BILLING_ENABLED` | `false` | Disabled billing capability |

## Planning API and database

- `GET /api/part-board` returns agreements, preferences and entitlement summaries. Optional parameters are `date`, `riderId`, and `horseId`.
- `POST /api/part-board` creates an agreement. `PUT /api/part-board/:id` edits its terms and status.
- `GET /api/recurring-lessons`, `POST /api/recurring-lessons`, and `PUT /api/recurring-lessons/:id` list, create, and edit weekly templates.
- `POST /api/recurring-lessons/:id/generate` persists valid occurrences and returns the generation report.
- Lesson creation and edits accept optional `consumeEntitlement` and a nullable coach on part-board rides.

Apply the additive Prisma migration before starting the updated API against PostgreSQL. It adds agreements, preferred times, entitlement usage, and templates with relational foreign keys and lookup indexes. It makes the Lesson coach nullable and adds agreement and recurrence references while retaining existing data. Entitlement usage is unique per lesson, and recurring occurrences are unique per template and original date. Planning writes use a PostgreSQL transaction and a transaction-scoped lock to coordinate capacity and entitlement checks.

## Horse Recommendation Engine

Add/Edit Lesson sends the rider, barn-local date and time, lesson type, discipline, and proposed ride units to the API. It also sends the coach when selected, the entitlement choice for part-board rides, and the booking ID when editing. The API loads the day's schedule, availability, preferences, agreements, and recent rider history in batches. It calculates advisory scores for all horses and flags bookings that require review. Staff can select any horse from the cards or grouped selector, while save still enforces the scheduling rules.

### Hard Eligibility Rules

Eligibility requires an active horse that supports the requested discipline and rider level. The existing half-open booking rules, horse workload ceiling, explicitly unavailable windows, rider conflicts, and selected-coach conflicts still apply. Unspecified availability is a warning. Protected recurring part-board rides and part-board agreement and entitlement requirements are checked through the same domain rules used on save. When editing, the current booking is excluded from overlap, workload, and entitlement calculations. A preview does not reserve the horse. Save validates again against current state.

### Recommendation Scoring

These weights are initial development assumptions. No score changes eligibility.

| Factor | Points |
| --- | ---: |
| Base | 50 |
| Rider preference ranks 1, 2, 3, and 4+ | +25, +15, +10, +5 |
| Active rider–horse part-board agreement | +30 |
| Part-board ride fully inside its preferred window | +10 |
| Prior assignment within the lookback | +8 |
| Same horse for the last three assignments, excluding part-board rides | −5 |
| Projected workload at most 50% | +10 |
| Projected workload above 50% and below 75% | +5 |
| Projected workload from 75% to below 100% | 0 |
| Projected workload at or above 100% | −10 |

Workload uses current daily units plus the proposed ride. History counts confirmed or completed assignments before the requested slot, through the current barn-local date. Prior assignment records do not establish how a ride went. Ranking uses score, lower projected utilization, higher rider preference, alphabetical horse name, then stable horse ID.

### Recommendation Explanations and Ruleset

Eligible horses return a base score, score impacts with reason codes and descriptions, an overall score, a rank, a workload projection, and separate warnings. Horses with booking concerns also return a score, workload, and separate score impacts alongside the blocking reasons. API responses include `rulesetVersion` (`1.1`) to identify the current scoring rules and `evaluatedAt` to identify when the preview was calculated. Payment status and billing are independent of recommendations.

### Recommendation API

`POST /api/recommendations/horses` accepts JSON. For example

```json
{
  "riderId": "rider-emma",
  "date": "2026-11-15",
  "startTime": "15:00",
  "endTime": "16:00",
  "lessonType": "PRIVATE",
  "discipline": "FLAT",
  "rideUnits": 0.75
}
```

Optional fields are `coachId`, `excludeLessonId`, and `consumeEntitlement`. The response echoes the request and rider ID and includes ranked `recommendations` and `ineligible` entries. Each entry has `horseId`, `horseName`, `eligible`, `score`, `reasons`, and `warnings`. All entries have `baseScore` and `workload`. Recommendations include a `rank`. Review entries include `scoreReasons` separately from their booking concerns.

## Known Limitations

Recurrence is weekly and generated on demand. Failed dates require staff review and can be retried after resolving the conflict. Historical occurrences stay on the calendar after a template ends. Recommendations are calculated per rider, including shared-coach lessons. A part-board ride requires an eligible linked horse. Weights still need review by school staff. Authentication, automatic scheduling, and active billing remain deferred.

### Production launch note

This iteration intentionally does **not** include authentication or authorization. Do not expose real rider, coach, or operational data to users until authentication, role-based access, and Supabase Row Level Security are implemented.

## Manual Payment Status

Daily Schedule and Riders support manual payment status for payments recorded outside the scheduler. Lesson status follows the individual booking. Monthly and part-board status are separate records keyed by rider and barn-local calendar month. Status can be paid, unpaid, or unrecorded. These indicators do not affect bookings or entitlement usage. The billing configuration remains independent.

## Feature Flags

`BILLING_ENABLED=false` remains the API default. The API rejects invalid values and refuses to start with `BILLING_ENABLED=true` because no active provider is installed. Set environment variables in the API process or hosting environment. `GET /api/config` exposes only the public capability, `{"features":{"billing":false}}`.

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
- Part-board agreements link existing rider and horse records. Ranked preferred times guide planning, while persisted lessons and explicit overrides determine bookings and availability.
- Part-board free rides are scheduling entitlements. Usage is recorded independently of billing, and every part-board ride counts toward horse workload.
- Weekly templates generate persisted lessons through normal validation. Generated bookings retain their original occurrence date for duplicate prevention.

## Next Iteration

Iteration 5 should focus on generating draft schedules from rider requests, availability, workload, recommendations, part-board priority, and recurring commitments. Drafts should explain unresolved requests and require manual approval before publishing.
