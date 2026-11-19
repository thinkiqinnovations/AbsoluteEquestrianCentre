# Development and demo data

Every iteration must include source-controlled, deterministic fictional demo data for the features it adds. Use the repository's `prisma/seed.ts` and shared demo fixtures. Preserve existing demo scenarios and document the exact tested migration, seed, and development reset commands in README.md.

Anchor calendar fixtures to the current barn-local date using `APP_TIME_ZONE` (default `America/Toronto`). Keep today, the current and next weeks, and the current and following months populated. Cover regular Flat and Jump lessons, varied workload including near and at capacity, recurring availability and an override, current and historical part-board agreements with varied entitlement usage, and successful and conflicting recurring occurrences.

Use stable fixture identifiers and a rerunnable seed. Never commit database files, dumps, generated database artifacts, .env, secrets, real customer or student information, or financial or payment data. Billing remains disabled in demo environments.

Before completing an iteration, use an empty development database to apply migrations and run the seed. Start the app and verify Horses, Riders, Coaches, Day, Week, Month, and the new feature scenarios. Rerun the seed and check for duplicates. Verify that README.md matches the tested workflow.

# Git check-ins

Every GitHub check-in must include a descriptive commit message explaining the changes. For substantial changes, include a commit body summarizing the features or fixes, validation performed, and any remaining verification limitations.
