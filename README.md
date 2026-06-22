# iSecurify GRC Platform — Coolify Deployment Guide

A full-featured Governance, Risk, and Compliance (GRC) platform for managing policies, frameworks, controls, audits, risks, vulnerabilities, evidence, and multi-tenant operations. This guide walks you through deploying the entire stack on **Coolify** — a self-hosting PaaS that runs on your own VPS.

---

## Architecture Overview

| Layer | Technology | Details |
|-------|-----------|---------|
| **Frontend** | Next.js 16 (App Router) | React 19, TypeScript, Tailwind CSS 4, shadcn/ui components |
| **Runtime** | Bun | Used as the Node runtime (`bun .next/standalone/server.js`) |
| **Output Mode** | Next.js Standalone | `output: "standalone"` in `next.config.ts` — single deployable artifact |
| **Database** | MySQL 8.0 | Coolify-managed resource with persistent Docker volume |
| **ORM** | Prisma 6.x | Schema sync via `prisma db push` (no migration files) |
| **Authentication** | Custom scrypt session auth | `scryptSync` password hashing, session tokens stored in DB, HttpOnly cookies |
| **File Uploads** | Docker volume | Uploaded evidence files persisted at `/app/uploads` inside the container |
| **API** | Next.js Route Handlers | RESTful JSON API under `/api/*` with RBAC per tenant |
| **UI State** | Zustand + TanStack Query | Client-side state management and server-state caching |
| **Charts** | Recharts | Dashboard analytics, risk heatmaps, audit progress |

### Key Design Decisions

- **Prisma `db push` instead of migrations** — the schema is the source of truth; `prisma db push` synchronizes it directly to the database without generating migration files. This is ideal for early-stage SaaS where the schema evolves rapidly.
- **Custom auth instead of NextAuth** — although `next-auth` is listed as a dependency, the actual authentication system is fully custom: password hashing uses Node.js `crypto.scryptSync`, session tokens are generated with `crypto.randomBytes(32)` and stored in the `Session` table, and session cookies are set as `HttpOnly` / `Secure` / `SameSite=Lax`.
- **Multi-tenant RBAC** — three user roles: `super_admin` (platform-wide), `tenant_admin` (tenant-wide), and `member` (tenant-scoped). All API routes enforce tenant isolation.

---

## Prerequisites

| Requirement | Details |
|-----------|---------|
| **Server** | Ubuntu 22.04 VPS with **4 GB+ RAM** recommended (Bun + Next.js standalone + MySQL) |
| **Coolify** | Installed and running on the VPS — see [https://coolify.io/docs/installation](https://coolify.io/docs/installation) |
| **Domain** | A registered domain with a **DNS A record** pointing to your VPS IP address |
| **GitHub Repository** | This code pushed to a GitHub/GitLab repo that Coolify can access |
| **MySQL Resource** | A MySQL 8.0 resource provisioned inside Coolify (or via docker-compose) |
| **Schema Adjustment** | The Prisma schema `provider` must be changed from `"sqlite"` to `"mysql"` for Coolify deployment (see Step 2 notes below) |

> **Important — Schema Provider:** The default `prisma/schema.prisma` uses `provider = "sqlite"` for local development. Before deploying to Coolify with MySQL, change the datasource provider to `"mysql"`:
> ```prisma
> datasource db {
>   provider = "mysql"
>   url      = env("DATABASE_URL")
> }
> ```

---

## Step 1 — Push Code to GitHub

If you haven't already, initialize a Git repository and push your code to GitHub so Coolify can pull it:

```bash
# Navigate to your project directory
cd /home/z/my-project

# Initialize Git (if not already done)
git init

# Stage all files
git add .

# First commit
git commit -m "Initial commit: iSecurify GRC Platform"

# Add your GitHub remote (replace with your actual repo URL)
git remote add origin https://github.com/YOUR_USERNAME/isecurify-grc.git

# Push to main branch
git branch -M main
git push -u origin main
```

> **Note:** Make sure `bun.lock` is committed to the repository — it is required for reproducible builds in the Docker container. Verify it exists:
> ```bash
> git status bun.lock   # should show as tracked
> ```

---

## Step 2 — MySQL in Coolify

### Create the MySQL Resource

1. Log into your Coolify dashboard at `https://your-coolify-domain.com`
2. Navigate to **Resources** → **New Resource** → **Database**
3. Select **MySQL 8.0** as the database type
4. Configure the following settings:

| Setting | Value |
|---------|-------|
| **Service Name** | `mysql` (or any name you prefer — this becomes the hostname in DATABASE_URL) |
| **Database Name** | `isecurify` |
| **Username** | `isecurify_user` |
| **Password** | Generate a strong password (e.g., `openssl rand -base64 24`) |
| **Image** | `mysql:8.0` |

5. Under **Storage**, enable **persistent storage** — Coolify will create a Docker volume so your database survives container restarts
6. Click **Create**

### Get the Connection String

After MySQL is provisioned, Coolify will display the internal connection string. It will look like:

```
mysql://isecurify_user:YOUR_PASSWORD@mysql:3306/isecurify
```

> **Hostname note:** Coolify uses the service name as the hostname. If you named your MySQL service `mysql`, the host is simply `mysql`. If you named it `mysql-isecurify`, use that instead. Copy this connection string — you'll need it for the `DATABASE_URL` environment variable in Step 4.

---

## Step 3 — Create Application in Coolify

1. In Coolify, navigate to **Resources** → **New Resource** → **Application**
2. Select **GitHub** (or GitLab) as the source
3. Authenticate with your GitHub account and select the repository containing this code
4. Configure the build settings:

| Setting | Value |
|---------|-------|
| **Build Pack** | `Dockerfile` |
| **Dockerfile Location** | `Dockerfile` (root of the repo) |
| **Port** | `3000` |
| **Branch** | `main` |

> **Important — Dockerfile Required:** The project uses a multi-stage Docker build. If a `Dockerfile` does not yet exist in the repo root, create one (see the Dockerfile section below). Coolify will use it to build the container image.

### Dockerfile (create if not present)

```dockerfile
# ---- Stage 1: Dependencies ----
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- Stage 2: Build ----
FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bunx prisma generate
RUN bun run build

# ---- Stage 3: Production ----
FROM oven/bun:1 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create uploads directory
RUN mkdir -p /app/uploads

# Copy standalone output and public assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Copy node_modules for Prisma CLI at runtime
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma

# Copy seed script
COPY --from=builder /app/prisma/seed.ts ./prisma/seed.ts
COPY --from=builder /app/src ./src

EXPOSE 3000

# Entrypoint runs Prisma db push on every startup, then seeds if SEED_DB=true
COPY <<'ENTRYPOINT' /app/entrypoint.sh
#!/bin/sh
set -e
echo ">>> Running Prisma db push..."
bunx prisma db push --accept-data-loss 2>/dev/null || bunx prisma db push
echo ">>> Prisma schema synced."
if [ "$SEED_DB" = "true" ]; then
  echo ">>> Seeding database..."
  bun run prisma/seed.ts
  echo ">>> Seed complete."
fi
echo ">>> Starting iSecurify GRC Platform on port ${PORT:-3000}..."
exec bun .next/standalone/server.js
ENTRYPOINT

RUN chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]
```

> **What the entrypoint does:**
> 1. Runs `prisma db push` to sync the schema to MySQL on every container startup
> 2. If `SEED_DB=true`, runs the seed script to create demo data
> 3. Starts the Next.js standalone server

---

## Step 4 — Environment Variables in Coolify

In Coolify, navigate to your **Application** → **Environment Variables** panel and add each of the following:

| Variable | Example Value | Description |
|----------|--------------|-------------|
| `DATABASE_URL` | `mysql://isecurify_user:YOUR_PASSWORD@mysql:3306/isecurify` | Prisma connection string. **Host** must match your Coolify MySQL service name. |
| `NEXTAUTH_SECRET` | _(generate below)_ | Required by the `next-auth` package even though custom auth is used. Generate with: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://your-domain.com` | Public URL of your app (used by next-auth internally). Must include the protocol. |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.com` | Exposed to the browser; used for API calls and links from the client side. |
| `NODE_ENV` | `production` | Disables development-only features and enables Next.js production optimizations. |
| `PORT` | `3000` | The port the standalone server listens on. Must match the Coolify port config. |
| `UPLOAD_PATH` | `/app/uploads` | Filesystem path where evidence uploads are stored inside the container. |
| `SEED_DB` | `true` | **First deploy only.** Set to `true` to seed the database with demo users, tenants, frameworks, and controls. Remove or set to `false` after first successful deploy. |

### Generating a Secure NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

Copy the output and paste it as the value for `NEXTAUTH_SECRET`. Example output:
```
aB3dE7fG9hJ2kL5mN8pQ1rS4tU6vW0xY3zA6cD9eF2gH5iK8jL1mN4pQ7r==
```

### Environment Variable Notes

- **DATABASE_URL host**: The hostname in DATABASE_URL must match the Coolify service name of your MySQL resource. If your MySQL service is named `mysql` in Coolify, use `mysql` as the host. If named `mysql-isecurify-db`, use that. Coolify's internal DNS resolves service names to container IPs.
- **NEXTAUTH_SECRET**: Although the platform uses a custom session-based auth system (not NextAuth handlers), the `next-auth` package is imported as a dependency and may throw errors if `NEXTAUTH_SECRET` is not set. Always include it.
- **SEED_DB**: This env var is checked by the Docker entrypoint script. When `true`, the seed script (`prisma/seed.ts`) runs after `prisma db push`. The seed creates a Super Admin user, a demo tenant (Acme Corporation), sample frameworks (SOC 2, ISO 27001), controls, and audit data.

---

## Step 5 — Persistent Storage (Uploads)

Evidence files uploaded through the platform (screenshots, documents, compliance artifacts) are stored on the container filesystem. Without persistent storage, these files are lost on every redeploy.

### Mount a Volume in Coolify

1. Navigate to your **Application** in Coolify
2. Go to the **Storages** (or **Volumes**) tab
3. Click **Add Storage**
4. Set the following:

| Setting | Value |
|---------|-------|
| **Container Path** | `/app/uploads` |
| **Volume Name** | Coolify will auto-generate a name (e.g., `isecurify-uploads`) |
| **Type** | Volume (not bind mount) |

5. Click **Save**

The Dockerfile already creates `/app/uploads` during the build, and the Coolify volume mount ensures this directory persists across container restarts, rebuilds, and redeployments.

> **How uploads work:** When a user uploads evidence via the API (`POST /api/evidence`), the server saves the file to `/app/uploads/{controlId}/{filename}` and stores a relative `filePath` (e.g., `uploads/ctrl-abc123/evidence.pdf`) in the database. The volume mount ensures these files survive container lifecycle events.

---

## Step 6 — Domain & SSL

### Configure Your Domain

1. In Coolify, navigate to your **Application** → **Domains** tab
2. Click **Add Domain**
3. Enter your domain (e.g., `grc.yourdomain.com`)
4. Ensure the domain's DNS A record points to your VPS IP:

```
grc.yourdomain.com.  IN  A  203.0.113.50
```

5. After adding the domain, Coolify will provision a reverse proxy (Traefik/Caddy) to route traffic

### Enable SSL (Let's Encrypt)

1. In the **Domains** section, toggle on **"Generate SSL Certificate"**
2. Coolify will automatically request a Let's Encrypt certificate
3. Within a few minutes, your site will be accessible at `https://grc.yourdomain.com`

> **SSL is mandatory** for the authentication system to work correctly. The custom session cookies are set with the `Secure` flag, which means browsers will not send them over HTTP.

---

## Step 7 — First Deployment

### Deploy with Seed Data

1. Ensure all environment variables from **Step 4** are configured
2. Ensure `SEED_DB=true` is set in the environment variables
3. Ensure the MySQL service is running in Coolify (check its status in Resources)
4. In Coolify, navigate to your **Application** → **Deployments** tab
5. Click **Deploy Now**

### What Happens During First Deploy

1. Coolify pulls your code from GitHub
2. Docker builds the image using the Dockerfile
3. The container starts and runs the entrypoint script:
   - `prisma db push` syncs the schema to MySQL (creates all tables)
   - `bun run prisma/seed.ts` creates demo data (since `SEED_DB=true`)
   - Next.js standalone server starts on port 3000
4. Coolify's reverse proxy routes traffic to the container

### After First Deploy

1. Verify the app loads at your domain
2. Log in with the default credentials (see below)
3. **Immediately change the default passwords**
4. Go back to **Environment Variables** in Coolify
5. Remove `SEED_DB=true` or set it to `false`
6. **Redeploy** to ensure the seed doesn't run again on future startups

> **Why remove SEED_DB?** The seed script uses `upsert` operations, so it won't duplicate data. However, it will reset passwords back to defaults if left enabled. Always remove it after the first successful deploy.

---

## Default Login Credentials

The seed script creates the following users:

### Super Admin (Platform-wide access)

| Field | Value |
|-------|-------|
| **Email** | `superadmin@isecurify.com` |
| **Password** | `Admin@123` |
| **Role** | `super_admin` |
| **Scope** | Full platform — all tenants, all data |

### Tenant Admin (Acme Corporation demo tenant)

| Field | Value |
|-------|-------|
| **Email** | `sarah.mitchell@acme.com` |
| **Password** | `Tenant@123` |
| **Role** | `tenant_admin` |
| **Scope** | Acme Corporation tenant only |

### Additional Seed Users

The seed script also creates these demo users within the Acme Corporation tenant:

| Email | Name | Role | Password |
|-------|------|------|----------|
| `sarah.mitchell@acme.com` | Sarah Mitchell | `tenant_admin` | `Tenant@123` |
| `james.wilson@acme.com` | James Wilson | `member` | `Tenant@123` |
| `maria.garcia@acme.com` | Maria Garcia | `member` | `Tenant@123` |

> **SECURITY WARNING:** Change ALL default passwords immediately after first login. Navigate to **Settings** → **Users** (for Super Admin) or **Settings** → **Profile** → **Change Password** (for tenant users).

---

## Prisma Commands (Run in Coolify Terminal)

You can access a shell inside the running container via Coolify's **Terminal** feature (Application → Terminal).

```bash
# Schema sync (runs automatically on startup via entrypoint)
# This synchronizes your prisma/schema.prisma with the MySQL database
bunx prisma db push

# Generate Prisma client (runs during Docker build, but can be re-run manually)
bunx prisma generate

# Manual seed — re-runs the seed script to create/refresh demo data
bun run prisma/seed.ts

# Inspect database visually — opens Prisma Studio (if port is exposed)
bunx prisma studio

# Check schema for errors without connecting to DB
bunx prisma validate
```

> **Note on `prisma db push` vs migrations:** This project uses `db push` which applies schema changes directly. It does not create migration history files. If you need migration history for compliance, consider switching to `prisma migrate dev` and `prisma migrate deploy`.

---

## Redeploy / Updates

### Automatic Deploy (Recommended)

1. Configure a **GitHub webhook** in Coolify: Application → Settings → Webhook URL
2. Add the webhook URL to your GitHub repo: Settings → Webhooks → Add webhook
3. Every push to the `main` branch triggers an automatic Coolify deploy

### Manual Deploy

1. Push code changes to GitHub
2. In Coolify, navigate to your Application → Deployments
3. Click **Deploy Now**

### Schema Changes

When you update `prisma/schema.prisma`:

1. Commit and push the schema change to GitHub
2. The Docker build runs `prisma generate` during the build stage
3. On container startup, the entrypoint runs `prisma db push` — this automatically applies schema changes to MySQL
4. No manual migration commands needed

> **If you need to accept data loss** (e.g., dropping a column), the entrypoint uses `--accept-data-loss` flag by default. Review schema changes carefully before deploying.

---

## File Uploads

### How Uploads Work

1. **Client** sends a `POST` request to `/api/evidence` with a file
2. **Server** saves the file to `/app/uploads/{controlId}/{uuid}-{filename}`
3. **Database** stores the relative file path (e.g., `uploads/ctrl-soc2-01/a1b2c3-report.pdf`)
4. **Volume** at `/app/uploads` persists the files across container lifecycle events

### Upload Storage Details

| Aspect | Detail |
|--------|--------|
| **Container Path** | `/app/uploads` |
| **Volume Type** | Docker named volume (managed by Coolify) |
| **Persistence** | Survives container restarts, rebuilds, and redeployments |
| **Access** | Files are served through the API (`GET /api/evidence`) or directly if public assets are configured |
| **Cleanup** | No automatic cleanup — manage disk space by archiving old evidence |

### Backing Up Uploads

```bash
# From the host machine, copy the volume contents to a backup location
docker cp coolify-isecurify-app-1:/app/uploads ./uploads-backup-$(date +%Y%m%d)
```

Or set up a cron job to periodically sync to S3-compatible storage:

```bash
# Using AWS CLI (install awscli first)
aws s3 sync /var/lib/docker/volumes/isecurify-uploads/_data s3://your-bucket/isecurify-uploads/
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **`DATABASE_URL not found` error at startup** | Check Coolify → Application → Environment Variables. The `DATABASE_URL` must be present and the `mysql://` protocol prefix must be included. |
| **`Can't reach database server` / connection refused** | Verify the MySQL service name in Coolify matches the hostname in `DATABASE_URL`. If your MySQL service is named `mysql-isecurify`, use `mysql-isecurify` (not `localhost` or `127.0.0.1`). |
| **`Table 'isecurify.User' doesn't exist`** | Prisma `db push` didn't run successfully. Check the container startup logs in Coolify → Application → Logs. Look for errors from `prisma db push`. |
| **Build fails on `bun install`** | Ensure `bun.lock` is committed to the Git repository. The Dockerfile uses `--frozen-lockfile` which requires the lockfile. Run `bun install` locally and commit the generated `bun.lock`. |
| **Build fails on `prisma generate`** | Check that `prisma/schema.prisma` is valid. Run `bunx prisma validate` locally. Also ensure the datasource `provider` is set to `"mysql"` (not `"sqlite"`) for production. |
| **Uploads not persisting across deploys** | Verify that the `/app/uploads` volume is mounted in Coolify → Application → Storages. If the volume is missing, uploaded files exist only inside the ephemeral container filesystem. |
| **`NEXTAUTH_SECRET` error in logs** | Set the `NEXTAUTH_SECRET` environment variable in Coolify, even though the platform uses custom auth. The `next-auth` package checks for this variable during initialization. Generate one with `openssl rand -base64 32`. |
| **Login redirect loop or cookies not set** | Ensure SSL is enabled (HTTPS). Session cookies use the `Secure` flag and will not be sent over plain HTTP. Check Coolify → Domains → SSL Certificate is active. |
| **Seed data not created on first deploy** | Verify `SEED_DB=true` is set in environment variables. Check the entrypoint logs for "Seeding database..." output. Also ensure `DATABASE_URL` is correct so `prisma db push` succeeds before the seed runs. |
| **Page shows 502 Bad Gateway** | The container may have crashed. Check Coolify → Application → Logs for startup errors. Common causes: database connection failure, missing env vars, or build errors. |
| **API returns 401 Unauthorized** | Your session may have expired. Clear cookies and log in again. If the issue persists, check that the `Session` table exists in MySQL and session tokens are being created correctly. |

---

## Backups

### MySQL Database Backups

1. Navigate to Coolify → **MySQL Resource** → **Backups** tab
2. Enable **Scheduled Backups**
3. Configure the schedule (e.g., daily at 02:00 UTC)
4. Set a retention policy (e.g., keep last 30 days)
5. Optionally configure remote backup storage (S3, SFTP, etc.)

### Manual MySQL Backup

From Coolify Terminal on the MySQL service:

```bash
mysqldump -u isecurify_user -p isecurify > /var/lib/mysql/backups/isecurify-$(date +%Y%m%d).sql
```

### File Upload Backups

The `/app/uploads` volume contains all user-uploaded evidence files. Back these up regularly:

```bash
# From the host machine
docker cp <container_id>:/app/uploads ./uploads-backup
```

For automated backups, consider:

- **S3 sync** with a cron job on the host
- **Restic** or **Borg** for encrypted, deduplicated backups
- **Coolify's built-in volume backup** (if available in your Coolify version)

---

## Monitoring

### Container Logs

- **Coolify Dashboard**: Application → Logs (live, real-time container output)
- **SSH**: `docker logs -f <container_name>` on the host

### Health Check

The platform exposes a health check endpoint:

```bash
curl -s https://your-domain.com/api
# Expected response: {"message":"Hello, world!"} with HTTP 200
```

Configure Coolify to monitor this URL:

1. Application → Health Check
2. Set URL to `/api`
3. Set expected status code to `200`
4. Set check interval (e.g., every 60 seconds)

### Key Metrics to Monitor

| Metric | What to Watch |
|--------|---------------|
| **Container restarts** | Frequent restarts indicate crash loops — check logs |
| **Memory usage** | Next.js standalone typically uses 200–500 MB; monitor if using 4 GB RAM VPS |
| **MySQL connections** | Prisma opens a connection pool; watch for connection exhaustion under load |
| **Disk usage** | Uploads volume grows over time; monitor available disk space |
| **Response latency** | Dashboard API calls should return in < 500ms under normal load |

---

## Deployment Checklist

Use this checklist to ensure every step is completed before considering your deployment live:

- [ ] **MySQL resource created in Coolify** — Resources → New → MySQL 8.0
- [ ] **Database credentials set** — database name: `isecurify`, user: `isecurify_user`, strong password
- [ ] **Persistent storage enabled for MySQL** — Volume mounted so data survives restarts
- [ ] **Prisma schema provider updated** — Changed from `"sqlite"` to `"mysql"` in `prisma/schema.prisma`
- [ ] **Dockerfile created and committed** — Multi-stage build with Bun, Prisma, and entrypoint script
- [ ] **Application created from GitHub repo** — Coolify → New Resource → Application → GitHub
- [ ] **Build pack set to Dockerfile** — Not Nixpacks or static
- [ ] **Port set to 3000** — Matches the standalone server port
- [ ] **DATABASE_URL configured** — `mysql://isecurify_user:PASSWORD@mysql:3306/isecurify`
- [ ] **NEXTAUTH_SECRET generated and set** — `openssl rand -base64 32`
- [ ] **NEXTAUTH_URL set** — `https://your-domain.com`
- [ ] **NEXT_PUBLIC_APP_URL set** — `https://your-domain.com`
- [ ] **NODE_ENV set to production**
- [ ] **PORT set to 3000**
- [ ] **UPLOAD_PATH set to /app/uploads**
- [ ] **SEED_DB=true set for first deploy**
- [ ] **/app/uploads volume mounted** — Coolify → Application → Storages
- [ ] **Domain configured** — DNS A record pointing to VPS, added in Coolify Domains tab
- [ ] **SSL certificate generated** — Let's Encrypt auto-issued via Coolify
- [ ] **First deploy triggered and successful** — Check logs for "Starting iSecurify GRC Platform"
- [ ] **App accessible at https://your-domain.com** — Login page loads
- [ ] **Default Super Admin password changed** — Log in and update immediately
- [ ] **Default Tenant Admin password changed** — Log in and update immediately
- [ ] **SEED_DB removed or set to false** — Prevent password reset on next deploy
- [ ] **Second deploy triggered (without SEED_DB)** — Confirm clean startup without seed
- [ ] **MySQL backup schedule configured** — Coolify → MySQL → Backups
- [ ] **Upload backup strategy in place** — Volume backup or S3 sync configured
- [ ] **Health check endpoint verified** — `GET /api` returns 200
- [ ] **Monitoring confirmed** — Container logs accessible, health check active

---

## Quick Reference

### One-Line Deploy Summary

```bash
# On your local machine: push code
git add . && git commit -m "Deploy" && git push origin main

# In Coolify: deploy (automatic if webhook configured, or click Deploy Now)

# On first deploy only: set SEED_DB=true, then remove after deploy
```

### Key URLs After Deployment

| URL | Purpose |
|-----|---------|
| `https://your-domain.com` | Main application (login page) |
| `https://your-domain.com/api` | Health check endpoint |
| `https://your-domain.com/dashboard` | Main dashboard (after login) |

### Important File Paths

| Path | Purpose |
|------|---------|
| `/app/uploads` | Evidence file uploads (persistent volume) |
| `/app/prisma/schema.prisma` | Database schema definition |
| `/app/prisma/seed.ts` | Database seed script |
| `/app/entrypoint.sh` | Container startup script (db push + seed + server) |
| `/app/.next/standalone/server.js` | Next.js production server |

---

## Support & Resources

- **Coolify Documentation**: [https://coolify.io/docs](https://coolify.io/docs)
- **Next.js 16 Documentation**: [https://nextjs.org/docs](https://nextjs.org/docs)
- **Prisma Documentation**: [https://www.prisma.io/docs](https://www.prisma.io/docs)
- **Bun Documentation**: [https://bun.sh/docs](https://bun.sh/docs)

---

*This deployment guide is maintained as part of the iSecurify GRC Platform project. For issues or questions, refer to the project repository.*
