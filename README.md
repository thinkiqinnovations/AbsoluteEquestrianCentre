# Absolute Equestrian Scheduler

Absolute Equestrian Scheduler is a TypeScript monorepo for managing school horses, riders, coaches, lessons, and the daily riding schedule.

## Development status

**Iteration 1 is implemented.** The application provides a functional daily schedule, basic horse/rider/coach management, ranked horse preferences, a part-board placeholder, seeded development data, and backend scheduling conflict detection. The development backend uses an in-memory seeded store so the product can be inspected without PostgreSQL; it resets when the API restarts.

Implemented in this iteration:

- React, Vite, Material UI, React Router, and TanStack Query frontend
- Express and TypeScript API with Zod request validation
- PostgreSQL-oriented Prisma domain schema
- Seeded no-database development mode
- CRUD endpoints and UI for horses, riders, and coaches
- Lesson creation, date navigation, daily workload summaries, and workload progress states
- Backend conflict rules for horse/rider/coach double booking, workload limit, rider suitability, and jumping capability
- Conflict-rule unit tests

There is intentionally no authentication, billing, payment tracking, invoices, revenue reporting, availability management, automated recommendation, or automatic scheduling.

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
pnpm dev
```

The web app runs at `http://localhost:5173` and proxies API requests to `http://localhost:3001`.

## Verification commands

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

## Database path

`prisma/schema.prisma` models the intended PostgreSQL database. To introduce PostgreSQL, set `DATABASE_URL`, install `@prisma/client` and `prisma`, run the first migration, and replace the development store in `apps/api/src/store.ts` with Prisma repository calls. Scheduling rules in `apps/api/src/conflicts.ts` are deliberately storage-independent.

## Next iteration

Iteration 2 should introduce weekly scheduling views and explicit rider, coach, and horse availability. It should retain the current API conflict layer and add database persistence through Prisma/PostgreSQL. Recurring lessons, part-board agreements, free-ride entitlement tracking, arena capacity, notifications, and automatic horse recommendations remain later iterations.
