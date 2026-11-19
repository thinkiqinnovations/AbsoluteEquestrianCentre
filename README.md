# Absolute Equestrian Scheduler

Month lesson entries use the weekly entry structure: navy cards with start/end times, full rider and horse names, a per-lesson Conflict or Warning badge when applicable, and coach, discipline, and lesson format details. Cancelled entries remain labelled and visually muted. This applies to both the month grid and mobile agenda, preserving daily summaries, filtering, editing, and the three-entry preview with the more-results link.

Inactive-resource handling: existing lessons retain their assignments and report inactive horses, riders, and coaches as errors in Day, Week, and Month. Weekly grid and mobile agenda entries display Conflict/Warning badges with notice details. Resource edits refresh schedule and horse-recommendation queries. Add Lesson lists active riders and coaches and excludes inactive horses from recommendation choices. Existing records remain available for administration and editing.

Regression verification for these fixes: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `node --env-file=.env scripts/verify-database.mjs`. The database verification applies migrations to an empty isolated development schema, runs the deterministic seed twice, checks duplicates and calendar/resource endpoints, and removes its temporary schema. No migration or demo fixture changes are needed for these validation/display fixes.

Absolute Equestrian Scheduler is a TypeScript monorepo for managing school horses, riders, coaches, lessons, and daily and weekly riding schedules.

## Development Status

**Iteration 5 adds plans, HST-inclusive pricing, rider enrollments, explicit package entitlement usage, and activity reservations.** Existing scheduling, recommendations, availability, part boarding, recurrence, manual payment status, and recent calendar improvements are preserved. The branding follow-up applies the Absolute Equestrian design system throughout the application. Verification is described below.

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
- [x] Operational plans and pricing catalogue
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
2. In Render, create a Blueprint from this GitHub repository. Use `master` for production and `Development` for the isolated development environment; `render.yaml` supplies the build (including the Prisma migration), start, health-check, and Node environment configuration.
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

- New shared sessions use **Add Lesson / Activity**. Select all riders and their horses together. Semi-private requires exactly two riders for 30 minutes. Group requires three to six riders for 60 minutes. Private requires one rider for 30 minutes. Each rider and horse still has its own booking, availability checks, and workload rules. Legacy unassigned bookings retain their original durations and editing behavior.

- `APP_TIME_ZONE` defaults to `America/Toronto`. The scheduler exchanges barn-local dates (`YYYY-MM-DD`) and wall-clock times (`HH:mm`). The API supplies the configured time zone to the web app. Date navigation and weekly rules use civil calendar arithmetic.
- Switch between **Day** and **Week** on the Schedule page. The Material UI weekly grid defaults to 8 AM–9 PM and expands for lessons outside those hours. Select a lesson to edit it or select a time slot to open Add Lesson with that date and time filled in.
- Open **Availability** for a rider, coach, or horse to manage multiple weekly windows and dated overrides. Overrides take precedence over recurring rules. When available and unavailable windows of the same precedence overlap, unavailable wins. The editor rejects redundant overlapping windows of the same type.
- A resource with recurring rules is unavailable outside its configured windows unless an override opens the requested period. A resource without recurring rules is unspecified outside any applicable override. Unspecified availability produces a warning and permits scheduling. An unavailable period blocks new bookings and edits to active lessons. Availability is independent of existing bookings and horse workload.
- Intervals are half-open. A lesson may end where an unavailable interval begins. Times must be in increasing order on the same date. Overnight windows are unsupported.
- `GET /api/schedule/week?start=YYYY-MM-DD` and `GET /api/availability/:resourceType/:resourceId/week?start=YYYY-MM-DD` require a valid Monday and return HTTP 400 otherwise. The weekly schedule includes rider, horse, and coach projections. The lesson form requests a single availability preview for the proposed interval, and the API validates again on create or update. The existing lesson PUT endpoint still accepts a full replacement. PATCH accepts partial lesson edits.
- Weekly rules and overrides use separate indexed tables keyed by resource type and ID. The API validates resource references because a single PostgreSQL foreign key cannot target all three resource tables. Seeded local mode includes example rules and overrides. PostgreSQL starts with no availability configured for existing resources.

## Schedule Views

Day, Week, and Month are projections over the same lessons. Availability, workload, compatibility, double booking, and validation rules remain in the API. The selected date and view can be bookmarked, for example `/schedule?view=month&date=2026-11-14`.

- **Day** groups lessons under colored `Coach: Name (ride time)` headings. Each rider row has a `Rider:` label, status above ride units, editing, and manual payment indicators. Scheduling Attention displays unique message/severity pairs. It uses `GET /api/schedule?date=YYYY-MM-DD`.
- **Week** shows seven days of lesson blocks for short-term resource planning, with a scrollable daily agenda on phones and smaller tablets. It uses `GET /api/schedule/week?start=YYYY-MM-DD`.
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

## Iteration 5 plans and activities

An **activity type** describes what happens, such as an assessment, group lesson, or practice ride. A **plan** defines the published offering and its HST-inclusive price. A **rider plan enrollment** links a rider to an effective package. A **plan entitlement** defines an allowed monthly quantity. An **activity booking** is the dated reservation, with explicit participants and financial classification. Mounted participants link to the existing `Lesson` rows so horse workload, availability, recommendations, conflicts, and calendars continue using the same scheduling rules.

The new Prisma models are `Plan`, `PlanEntitlement`, `RiderPlanEnrollment`, `ActivityBooking`, `ActivityParticipant`, and `PlanUsage`. All additions are nullable relationships from existing records. Existing lessons, part-board agreements, historical preferences, manual payment statuses, and recurring templates remain usable as legacy/unassigned records.

### Current price configuration

All prices are CAD and include HST. Integer cents are stored in PostgreSQL. The UI reads prices through the API. No tax is added to the supplied totals.

| Offering | HST-inclusive price | Includes |
| --- | --- | --- |
| Monthly Group | $215/month | 4 Group Lessons |
| Monthly Semi-Private | $215/month | 4 Semi-Private Lessons |
| Monthly Private | $256/month | 4 Private Lessons |
| 1 Day Part Board, Group / Semi-Private | $269/month | 4 Group or Semi-Private Lessons in a shared allowance |
| 1 Day Part Board, Private | $310/month | 4 Private Lessons |
| 2 Day Part Board, Lessons + Practice Rides | $440/month | 4 Group Lessons and 4 Practice Rides |
| 2 Day Part Board, Lessons Only | $538/month | 8 Group Lessons |
| 3 Day Part Board, Lessons + Practice Rides | $645/month | 8 Group Lessons and 4 Practice Rides |
| 3 Day Part Board, Lessons Only | $807/month | 12 Group Lessons |
| Half Hour Assessment | $60 | 30 minutes, one rider |
| Single Lesson | $75 | Private, Semi-Private, or Group format |
| Grooming & Tacking | $30 | 90 minutes, CASH ONLY |
| Birthday Party | $430 base | Up to 6 riders, 1 hour lesson and 1 hour barn/party room |
| Seasonal Camp | $678/week | A service/program reservation |

The **Plans & Pricing** screen is read-only. Administrators can update configuration through the database. Future pricing edits should use effective-dated plan versions when historical package allocations must be preserved. Booked participants keep published-price, applicable-amount, HST, and payment-rule snapshots.

Grooming & Tacking stores `CASH_ONLY` and the instruction **Cash only - exact change please.** as configuration. A database check and backend validation enforce that rule.

Birthday pricing stores the base price, included quantity of six, and additional-unit price of $60. The backend calculates $430 for six, $490 for seven, and $550 for eight, with the additional quantity clamped to zero below six. Party bookings reserve the registered riders, coach, and optional room/location for two hours. Individual horse assignments during a party are outside this iteration's party reservation workflow.

Camps store a start/end date, selected riders, capacity, and reservation status. A reservation covers at most seven consecutive dates, with a daily start/end time and a $678 weekly classification per rider. A one-day camp reservation also uses the weekly price. Staff should confirm this assumption before adopting a separate partial-week price. Camp registration administration, seasonal rosters, and payments remain future work.

### Add Lesson and activity workflow

1. Select an activity type. Lesson formats have separate Group, Semi-Private, and Private choices. Assessments default to 30 minutes, lessons to 60/30/30, practice rides to 60, grooming to 90, parties to 120, and camps to an eight-hour daily window.
2. Set the date, riding time, coach, and optional arena/location. For mounted activities select discipline, ride units, riders, and a recommended horse for each rider.
3. Select all participants together. The backend validates private, semi-private, and group capacity and enforces activity duration.
4. The form finds effective enrollments for each rider and automatically selects an applicable available entitlement. Select another valid entitlement source or individual purchase when appropriate.
5. Review the monthly allocation, used quantity, and remaining balance. A new booking preview shows the balance before and after one use. Editing a booking retains its original source. If an entitlement is exhausted, staff must enter an override reason to continue.
6. Save the activity. All participant bookings and consumption records are written atomically under the existing PostgreSQL scheduling lock. Editing uses a version number to reject stale changes. A completed activity keeps its financial/usage history.

Assessments, lessons, and practice rides create linked `Lesson` rows. Grooming, party, and camp reservations appear as activity cards in Day, Week, and Month and reserve their riders, coach, and location. Service reservations also participate in legacy lesson conflicts and horse recommendation eligibility. Calendar activities can be opened for editing. The desktop weekly time range expands for service reservations outside normal hours.

An individual lesson is classified at $75 per rider. Assessment and grooming prices apply per participant. Party pricing applies once to the reservation, recorded against its first registered rider, and extra riders have no separate duplicate base charge. No package or service operation charges a payment method.

### Enrollment and entitlement behavior

Use **Riders → Plans & Entitlements → Enroll in a plan** for a lesson package. Set effective dates, ACTIVE/PAUSED/ENDED status, and notes. Profiles show the plan, price, dates, current monthly quantities, part-board relationships, preferred times, and upcoming recurring ride templates.

For a part-board package use **Part Board → New/Edit agreement**. Select the rider, horse, package, dates, preferences, priority, and status. Saving creates or updates the matching package enrollment. Package changes end the old enrollment and create a new one. Used enrollments retain their rider/plan identity. Legacy agreements can remain unassigned and keep their existing free-ride configuration. Horse-focused profiles show package identity and days per week without package prices.

Package periods are calendar months in `APP_TIME_ZONE`. A `PlanUsage` identifies the activity participant, rider enrollment, entitlement, service date, quantity, status, and exhaustion-override reason. Its participant links to the actual lesson when mounted. Quantities come from these explicit records. Unassigned legacy lessons are not inferred as package consumption.

`USED` and `CANCELLED` records consume allowance. `RESTORED` records release it. Cancelling an activity presents **Restore package entitlements for this cancellation**. The default retains usage until a staff member explicitly chooses restoration. This provides a mechanism without defining a school cancellation policy. Cancelling can restore usage even after an enrollment or plan has expired. Repeated stale edits are rejected.

Part-board package practice rides reserve the mapped horse, pass horse/rider/coach availability, consume horse workload, and respect protected recurring slots. An administrator may enter a horse-relationship override reason where required. Legacy recurring practice rides automatically use the effective matching package allowance when a package enrollment exists. Legacy unassigned recurrence continues using its original free-ride ledger. Group and semi-private recurring templates retain their existing per-rider model and are not converted into new multi-rider package activities.

### API additions

| Method and route | Behavior |
| --- | --- |
| `GET /api/plans` | Database-backed catalogue, including entitlements and payment rules |
| `GET /api/plans/:id/quote?quantity=N` | Safe integer-cent published pricing, including birthday extras |
| `GET /api/enrollments?date=YYYY-MM-DD&riderId=ID&agreementId=ID` | Effective enrollment and monthly balance projections |
| `POST /api/enrollments` | Create an operational enrollment |
| `PUT /api/enrollments/:id` | Edit dates, status, or unused enrollment details |
| `GET /api/activities?start=YYYY-MM-DD&end=YYYY-MM-DD&riderId=ID` | Activity reservations and participant classifications |
| `POST /api/activities` | Validate and atomically create a reservation and consumption |
| `PUT /api/activities/:id` | Version-checked edit or cancellation/restoration |

Part-board POST/PUT now accepts optional `planId`. Existing APIs remain available for legacy callers. Editing a linked activity lesson through the legacy lesson endpoint returns `ACTIVITY_EDIT_REQUIRED` so package usage and multi-rider sessions remain consistent.

### Migration, seed, and verification workflow

The additive migration is `20261117000000_plans_activities`. It adds the six models, foreign keys, indexes, and checks for non-negative currency, positive allowances, valid usage/enrollment statuses, and cash-only grooming. It leaves existing scheduling rows in place.

Configure the development `.env` with `DATABASE_URL` and `DIRECT_URL`. For a small Supabase Session Pooler, set `connection_limit=3&pool_timeout=20` on the application connection string to avoid exhausting the shared session pool. A reachable Session Pooler may be used for `DIRECT_URL` when direct IPv6 access is unavailable.

The tested commands for an existing development database are below. `CATALOG_ONLY=1` loads pricing without updating existing rider, horse, lesson, or agreement fixtures.

```powershell
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm exec prisma validate
pnpm prisma:migrate:deploy
$env:DEMO_SEED = '1'
$env:CATALOG_ONLY = '1'
$env:BILLING_ENABLED = 'false'
node --env-file=.env --import tsx prisma/seed.ts
Remove-Item Env:CATALOG_ONLY
pnpm build
node --env-file=.env apps/api/dist/server.js
```

Use the existing full demo seed only in a disposable development database/schema. The script refreshes stable fictional fixture IDs and leaves non-fixture records in place. It includes all 14 plans, five enrollment scenarios, 12 activity bookings, 18 participants, and 10 usage records. Emma has 3/4 group lessons and 2/4 practice rides used, Olivia has 1/4 group lessons used, and Noah's private allowance is exhausted at 4/4. Existing fixture names and horse identities are preserved. The horse with stable ID `horse-jasper` is currently named Sassy.

All demo dates are anchored to the current barn-local date. Historical current-period examples are clamped to the start of the current month. Previous calendar, availability, workload, preference, part-board, and recurrence fixtures remain populated.

The following command was tested against a new isolated schema on the configured development PostgreSQL database. It applies every migration, seeds twice, checks for duplicates, verifies PostgreSQL API writes/restoration/agreements/calendars, and removes only the generated verification schema.

```powershell
node --env-file=.env scripts/verify-database.mjs
```

To explicitly reset a disposable demo database, stop its server, set both connection variables to that disposable database, and run the existing reset commands. This clears all records in that configured database.

```powershell
$env:DEMO_SEED = '1'
$env:BILLING_ENABLED = 'false'
pnpm exec prisma migrate reset --force --skip-seed --schema prisma/schema.prisma
node --env-file=.env --import tsx prisma/seed.ts
node --env-file=.env apps/api/dist/server.js
```

Verification includes type checking, lint, frontend/backend builds, Prisma validation, 52 backend tests, and the isolated PostgreSQL workflow. The branding follow-up expands the frontend suite to 10 tests. API tests explicitly set an empty `DATABASE_URL` so Prisma's `.env` loading cannot accidentally connect a memory-mode test to the development database. Browser checks for the branding follow-up are described below. Non-failing React `act` warnings and the Vite bundle-size warning remain visible in verification output.

### Deferred billing and future work

Billing stays disabled. The existing provider interface and disabled implementation remain intact. Plan and service classification now records the offering, published price, HST flag, rider, activity, entitlement source, applicable amount, and payment-method rule. A future provider can use those records through the existing billing boundary. No card processing, automatic invoices, payment webhooks, accounting integration, or tax-calculation logic is enabled.

Future work includes authenticated staff roles, policy-approved cancellation rules, optional effective-dated pricing administration, detailed camp registrations, party horse allocation, and package-aware multi-rider recurring templates. Draft schedule generation remains a separate future feature.

## Absolute Equestrian branding

The application uses a shared navy, gold, ivory, and white design system. All colors are centralized in `apps/web/src/theme.ts` through `brandColors`, the Material UI palette, and generated `--color-*` CSS custom properties. Component files reference theme tokens. The palette is explicitly light, and the document uses `color-scheme: light` so system dark preferences do not switch the branded surfaces.

| Token | Value | Use |
| --- | --- | --- |
| `--color-navy` | `#062862` | Header, primary buttons, navigation, prices |
| `--color-navy-dark` | `#061A4D` | Main text and darker navy states |
| `--color-gold` | `#D5AC35` | Active navigation, header rule, restrained accents |
| `--color-background` | `#F7F5EE` | Warm ivory page and form background |
| `--color-surface` | `#FFFFFF` | Cards, inputs, dialog headers/actions |
| `--color-surface-muted` | `#EEF0F3` | Muted surfaces and workload tracks |
| `--color-text-primary` | `#061A4D` | Main text |
| `--color-text-secondary` | `#374151` | Secondary text |
| `--color-border` | `#D3D6DC` | Card, field, and secondary button borders |
| `--color-success` | `#078239` | Confirmed, active, eligible, and available states |
| `--color-warning` | `#B98A13` | Warning indicators |
| `--color-warning-text` | `#805B00` | Readable warning text on light surfaces |
| `--color-error` | `#B42318` | Errors and destructive actions |

The supplied logo is stored unchanged at `apps/web/public/images/absolute-equestrian-logo.png` and served at `/images/absolute-equestrian-logo.png`. It is also the favicon. The supplied asset is 150 × 150 pixels with its original navy background. The header displays it at 88 pixels on desktop and 64 pixels on compact layouts, with automatic height and `object-fit: contain`. The footer reuses it decoratively at 44 pixels.

`AppShell`, `AppHeader`, and `AppFooter` live in `apps/web/src/AppShell.tsx`. The header contains the supplied logo, registered business name, ThinkIQ credit, and navigation. The active page has bold light text and a three-pixel gold underline. Below 1200 pixels, a labelled keyboard-accessible button opens the navigation. A skip link targets the main content. The footer stacks on small screens.

`FormSection` in `apps/web/src/FormSection.tsx` supplies white form cards with navy serif headings and a gold accent. Add/Edit Activity uses Activity, Lesson format, Schedule, Riders, Horse, Package / Entitlement, and activity-detail sections. Part Board uses Rider & Horse, Plan, Agreement Details, Entitlements, and Schedule Preferences. Pricing cards use a gold top border, navy titles/prices, HST labels, and semantic status indicators.

Shared Material UI theme overrides apply across the existing screens, profiles, dialogs, availability editor, recurring templates, payment-status forms, services, cards, inputs, tables, loading indicators, validation alerts, and buttons. Georgia supplies the existing serif heading family. Arial/Helvetica supplies body text, labels, navigation, and controls. Desktop page headings are 44 pixels and compact headings are 32 pixels. Cards have subtle borders/shadows and twelve-pixel corners. Inputs and buttons have nine-pixel corners. Primary saves are navy, secondary actions are white, and destructive actions use the error token.

Responsive conventions preserve the working calendars. Week and Month use their existing mobile agendas below 900 pixels. The desktop weekly grid can scroll within its card. Pricing cards use one column on mobile, two from 900 pixels, and three from 1536 pixels. Profile actions stack below the details on phones. Form rows stack on compact screens, long select options wrap, and dialog content scrolls independently of its action buttons.

Branding verification includes the 10 frontend tests, type checking, lint, and the production build. New tests check the supplied logo path, navigation expansion and active-page behavior, explicit light mode, and AA text contrast for the principal text, navigation, success, warning, and error combinations. The existing calendar test now recognizes the Schedule Preferences section name. Browser inspection covers desktop, tablet, and mobile layouts, the logo's square proportions, page widths, keyboard focus, validation, pricing, activity forms, Part Board forms, availability, profiles, and the calendars. The existing isolated migration/seed verification was rerun successfully with zero duplicate records. No pricing or scheduling data is changed by the visual update.

## ThinkIQ application theme

The application now follows https://thinkiqinnovations.com/ across shared screens and controls: dark background (#020713), dark panels (#0a152b), cyan accents (#18d7f5), light text (#f7fbff), and muted text (#a8b7d2). Shared tokens and Material UI overrides remain in apps/web/src/theme.ts. Existing navy/gold token names are retained for compatibility and now resolve to the ThinkIQ accent colors. Inter is the body font and Space Grotesk the heading font, loaded through Google Fonts with local sans-serif fallbacks. The explicit dark color scheme applies regardless of system preference. Green success, amber warnings, and red errors retain semantic meanings. Layouts and scheduling behavior are unchanged.

The transparent ThinkIQ logo is apps/web/public/images/thinkiq-innovations-logo.png and is used in the header, favicon, and Apple touch icon. Absolute Equestrian Centre remains the secondary header identity; its existing footer asset is preserved. This section supersedes the earlier ivory/navy/gold visual specification above. Theme verification uses frontend tests (including AA text contrast and header navigation), lint, TypeScript checking through the frontend production build, and browser inspection of the Schedule page. No database changes or new demo fixtures are required for this visual-only update.

Light and dark themes: light is the default for new visitors. The theme button above page content switches modes and saves the preference locally under thinkiq-ui-theme. The header remains dark and identical in both modes. createAppTheme in theme.ts shares typography and component styling across the two palettes; ThemePreference.tsx owns the preference and toggle. Storage restrictions fall back to a working, session-only toggle. No scheduling data or demo fixtures change.

Outlined warning badges, including unpaid payment indicators, use theme-specific amber text and borders instead of filled-badge text colors. Regression tests verify the shared override and at least 4.5:1 text contrast against both light and dark card surfaces.

The Light/Dark preference is now an accessible switch in the header, with visible Light and Dark labels. Off selects light and on selects dark; the default and locally saved preference behavior are unchanged. The header retains the same dark styling in both modes, and the previous page-content theme button is removed.
