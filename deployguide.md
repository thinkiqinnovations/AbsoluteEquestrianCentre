# Deployment Guide: Render + Supabase

This guide deploys Absolute Equestrian Scheduler as one Node.js service on Render. The Express server serves both the React application and `/api/*`; Supabase provides PostgreSQL.

## Before you begin

- A GitHub repository containing this project.
- A Supabase project in the region closest to the riding school.
- A Render account with a payment method and the **Starter** service plan selected. The free plan sleeps on inactivity and is unsuitable for staff use.
- A Namecheap-managed domain, if a custom domain is required.

## 1. Create the Supabase database

1. Create a Supabase project.
2. In **Connect**, copy both connection strings:
   - **Session Pooler** connection string: use it as `DATABASE_URL`.
   - **Direct connection** string: use it as `DIRECT_URL`.
3. Keep both strings private. Never commit them to Git.

`DATABASE_URL` is used by the running application. `DIRECT_URL` is used only by Prisma during deployment migrations.

## 2. Deploy with Render Blueprint

1. In Render, choose **New → Blueprint** and connect this GitHub repository.
2. Render reads `render.yaml` and proposes the `absolute-equestrian-scheduler` web service.
3. Select the Starter plan and create the service.
4. In the service’s environment variables, enter:

   | Key | Value |
   | --- | --- |
   | `DATABASE_URL` | Supabase Session Pooler string |
   | `DIRECT_URL` | Supabase direct connection string |
   | `NODE_ENV` | `production` |

5. Deploy. Render runs the build, applies the Prisma migration with `pnpm prisma:migrate:deploy`, starts the application, and checks `/health`.

The initial database starts empty. Add horses, riders, and coaches through the application before scheduling lessons.

## 3. Verify the deployment

1. Open the Render service URL.
2. Visit `<service-url>/health`; it should return `{"status":"ok","mode":"postgres"}`.
3. Add a test horse, rider, coach, and lesson in the UI.
4. Redeploy the Render service and confirm that the records remain. This confirms Supabase persistence is working.

## 4. Connect a Namecheap domain

1. In Render, add the desired custom domain to the web service.
2. Copy the DNS target Render provides.
3. In Namecheap Advanced DNS, create the record Render specifies (normally a CNAME for a subdomain, or an ALIAS/ANAME-compatible record for an apex domain).
4. Wait for DNS propagation and let Render issue its managed TLS certificate.
5. Set the custom domain as the primary Render domain.

Do not set `CORS_ORIGIN` when the frontend and API are served from the same Render domain. Set it only after splitting the frontend to a different host.

## Operational notes

- Render deploys automatically from the configured branch.
- Keep the Supabase and Render dashboards restricted to administrators.
- Back up operational data outside the app before making schema changes.
- This project currently has no authentication or authorization. Do not provide public/staff access to real rider data until the next iteration adds authentication, roles, and Supabase Row Level Security.
