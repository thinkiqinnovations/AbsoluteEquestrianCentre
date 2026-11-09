# Absolute Equestrian Scheduler

Absolute Equestrian Scheduler is a TypeScript monorepo for managing school horses, riders, coaches, lessons, and the daily riding schedule.

## Development status

**Iteration 1 and production deployment foundations are implemented.** The application provides a functional daily schedule, basic horse/rider/coach management, ranked horse preferences, a part-board placeholder, backend scheduling conflict detection, and a Render/Supabase deployment path.

Implemented in this iteration:

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
2. In Render, create a Blueprint from this GitHub repository. `render.yaml` supplies the build, migration, start, health-check, and Node environment configuration.
3. Enter `DATABASE_URL` and `DIRECT_URL` as secret Render environment variables. Do not commit them.
4. The Blueprint uses Render's `free` plan for a no-cost pilot. It sleeps after inactivity; use a paid always-on plan before staff depend on the service day to day.
5. Point the Namecheap domain to the Render service according to Render’s custom-domain instructions. Express serves both the application and its API under that domain, so `CORS_ORIGIN` is optional. Set it only if a separate frontend origin is introduced.

For local database development, copy `.env.example` to `.env`, add the two Supabase URLs, then run:

```bash
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm dev
```

The Prisma migration is stored in `prisma/migrations/`. Scheduling rules remain storage-independent in `apps/api/src/conflicts.ts`.

### Production launch note

This iteration intentionally does **not** include authentication or authorization. Do not expose real rider, coach, or operational data to users until authentication, role-based access, and Supabase Row Level Security are implemented.

## Next iteration

Iteration 2 should introduce authentication, role-based access, Supabase Row Level Security, weekly scheduling views, and explicit rider, coach, and horse availability. Recurring lessons, part-board agreements, free-ride entitlement tracking, arena capacity, notifications, and automatic horse recommendations remain later iterations.
