# iSecurify GRC — MySQL Migration + Coolify Deployment Prompt for Chat Z AI

Paste everything below this line into Chat Z AI.

---

You are a Senior Full Stack Architect, DevOps Engineer, Prisma Expert, Next.js Expert, MySQL Expert, and Coolify Deployment Specialist.

I will provide you the complete architecture of my project. Do NOT give generic advice. Generate all output based on the exact architecture I describe below.

==================================================
## PROJECT ARCHITECTURE (Already Analysed)
==================================================

### Application Name
iSecurify GRC Platform

### Frontend
- Next.js 16 (App Router, standalone output mode)
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui components
- TanStack Query v5
- Zustand state management
- Framer Motion
- Recharts (dashboards)

### Backend
- Next.js 16 API Routes (App Router, all under /src/app/api/)
- Runtime: Bun
- Custom session-based auth (NOT next-auth despite it being in package.json — the actual auth is in src/lib/auth.ts using scrypt password hashing + cookie sessions stored in the Session DB table)
- Prisma ORM 6.x as the data layer
- No separate backend server

### Authentication (src/lib/auth.ts)
- Custom implementation using Node.js crypto (scryptSync)
- Sessions stored in the `Session` DB table (token + expiresAt + userId)
- Session cookie name: `isecurify_session`, TTL: 7 days, httpOnly, sameSite=lax
- Password format: `{16-byte-hex-salt}:{64-byte-hex-hash}` (scrypt)

### Database (CURRENT — SQLite)
- Provider: SQLite
- File: `/home/z/my-project/db/custom.db` (dev path)
- Prisma schema at: `prisma/schema.prisma`

### ORM
- Prisma Client 6.x
- Singleton pattern in `src/lib/db.ts`
- NO migrations exist — project uses `prisma db push` (schema-first, no migration history)

### File Uploads
- Evidence files stored at `public/uploads/` (relative, served by Next.js)
- File deletion uses Node.js `fs/promises` with `path.join(process.cwd(), 'public', filePath)`
- Upload route: `/api/evidence/upload` (not yet implemented in current code — handled client-side)

### Package Manager
- Bun (bun.lock present)
- Scripts:
  - `bun run build` → next build + copy static assets to standalone
  - `bun run start` → NODE_ENV=production bun .next/standalone/server.js
  - `prisma db push` (no migrate)

### Next.js Config
```ts
// next.config.ts
const nextConfig = {
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
}
```

### Current .env
```
DATABASE_URL=file:/home/z/my-project/db/custom.db
```

### Prisma Schema (CURRENT — SQLite)
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Tenant {
  id           String   @id @default(cuid())
  name         String
  slug         String   @unique
  industry     String?
  plan         String   @default("enterprise")
  status       String   @default("active")
  contactName  String?
  contactEmail String?
  contactPhone String?
  address      String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  users        User[]
  controls     ControlAssignment[]
  evidence     Evidence[]
  checklists   Checklist[]
  vulnerabilities Vulnerability[]
  risks        Risk[]
  policies     Policy[]
  audits       Audit[]
  notifications Notification[]
}

model User {
  id           String    @id @default(cuid())
  email        String    @unique
  name         String
  passwordHash String
  role         String    @default("employee")
  status       String    @default("active")
  jobTitle     String?
  department   String?
  phone        String?
  avatarUrl    String?
  lastLoginAt  DateTime?
  tenantId     String?
  tenant       Tenant?   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  sessions     Session[]
  evidence     Evidence[]
  auditLogs    AuditLog[]
  auditTasks   AuditTask[]
  notifications Notification[]
  policyApproved PolicyApproval[]
  checklistAnswers ChecklistAnswer[]
  passwordResets PasswordReset[]
  @@index([tenantId])
}

model Session {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  ip        String?
  userAgent String?
  createdAt DateTime @default(now())
  @@index([userId])
}

model PasswordReset {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())
  @@index([userId])
}

model Framework {
  id          String   @id @default(cuid())
  code        String   @unique
  name        String
  description String?
  category    String?
  version     String?
  icon        String?
  controls    Control[]
  checklists  Checklist[]
  audits      Audit[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Control {
  id          String    @id @default(cuid())
  frameworkId String
  framework   Framework @relation(fields: [frameworkId], references: [id], onDelete: Cascade)
  ref         String
  title       String
  description String?
  category    String?
  guidance    String?
  order       Int       @default(0)
  assignments ControlAssignment[]
  evidence    Evidence[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  @@index([frameworkId])
}

model ControlAssignment {
  id        String   @id @default(cuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  controlId String
  control   Control  @relation(fields: [controlId], references: [id], onDelete: Cascade)
  status    String   @default("not_started")
  owner     String?
  notes     String?
  updatedAt DateTime @updatedAt
  @@unique([tenantId, controlId])
  @@index([tenantId])
}

model Evidence {
  id           String   @id @default(cuid())
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  controlId    String?
  control      Control? @relation(fields: [controlId], references: [id], onDelete: SetNull)
  uploadedById String
  uploadedBy   User     @relation(fields: [uploadedById], references: [id], onDelete: Cascade)
  title        String
  description  String?
  type         String
  fileName     String?
  filePath     String?
  fileSize     Int?
  mimeType     String?
  fileUrl      String?
  linkTitle    String?
  tags         String?
  status       String   @default("active")
  validUntil   DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@index([tenantId, controlId])
  @@index([uploadedById])
}

model Checklist {
  id          String    @id @default(cuid())
  tenantId    String
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  frameworkId String?
  framework   Framework? @relation(fields: [frameworkId], references: [id], onDelete: SetNull)
  title       String
  description String?
  status      String    @default("draft")
  dueDate     DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  items       ChecklistItem[]
  answers     ChecklistAnswer[]
}

model ChecklistItem {
  id          String    @id @default(cuid())
  checklistId String
  checklist   Checklist @relation(fields: [checklistId], references: [id], onDelete: Cascade)
  question    String
  hint        String?
  type        String    @default("yes_no")
  options     String?
  required    Boolean   @default(true)
  order       Int       @default(0)
  answers     ChecklistAnswer[]
}

model ChecklistAnswer {
  id          String    @id @default(cuid())
  checklistId String
  checklist   Checklist @relation(fields: [checklistId], references: [id], onDelete: Cascade)
  itemId      String
  item        ChecklistItem @relation(fields: [itemId], references: [id], onDelete: Cascade)
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  value       String?
  notes       String?
  updatedAt   DateTime  @updatedAt
  @@unique([checklistId, itemId])
}

model Vulnerability {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  title       String
  description String?
  severity    String   @default("medium")
  status      String   @default("open")
  cvss        Float?
  cve         String?
  asset       String?
  assignedTo  String?
  dueDate     DateTime?
  resolvedAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([tenantId])
}

model Risk {
  id            String   @id @default(cuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  title         String
  description   String?
  category      String?
  likelihood    Int      @default(3)
  impact        Int      @default(3)
  inherentScore Int?
  residualScore Int?
  treatment     String   @default("mitigate")
  owner         String?
  status        String   @default("identified")
  reviewDate    DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([tenantId])
}

model Policy {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  title       String
  category    String?
  content     String
  version     String   @default("1.0")
  status      String   @default("draft")
  owner       String?
  approvedBy  String?
  approvedAt  DateTime?
  effectiveAt DateTime?
  reviewDate  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  approvals   PolicyApproval[]
}

model PolicyApproval {
  id        String   @id @default(cuid())
  policyId  String
  policy    Policy   @relation(fields: [policyId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  approved  Boolean
  comment   String?
  createdAt DateTime @default(now())
  @@unique([policyId, userId])
}

model Audit {
  id          String    @id @default(cuid())
  tenantId    String
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  title       String
  type        String    @default("internal")
  frameworkId String?
  framework   Framework? @relation(fields: [frameworkId], references: [id], onDelete: SetNull)
  status      String    @default("planned")
  lead        String?
  scope       String?
  startDate   DateTime
  endDate     DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  tasks       AuditTask[]
}

model AuditTask {
  id          String   @id @default(cuid())
  auditId     String
  audit       Audit    @relation(fields: [auditId], references: [id], onDelete: Cascade)
  title       String
  description String?
  assigneeId  String?
  assignee    User?    @relation(fields: [assigneeId], references: [id], onDelete: SetNull)
  status      String   @default("todo")
  dueDate     DateTime?
  order       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([auditId])
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String?
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  tenantId  String?
  action    String
  entity    String?
  entityId  String?
  ip        String?
  meta      String?
  createdAt DateTime @default(now())
  @@index([tenantId])
  @@index([userId])
}

model Notification {
  id        String   @id @default(cuid())
  tenantId  String?
  tenant    Tenant?  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  userId    String?
  user      User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
  title     String
  message   String
  type      String   @default("info")
  read      Boolean  @default(false)
  link      String?
  createdAt DateTime @default(now())
  @@index([userId])
  @@index([tenantId])
}
```

### Key Application Code Notes
- `src/lib/db.ts` — Prisma singleton, no raw SQL anywhere
- `src/lib/auth.ts` — custom scrypt auth, sessions in DB
- All Prisma calls use the standard Prisma Client API (findUnique, create, update, delete, findMany) — no raw SQL queries
- Fields `options` (ChecklistItem), `meta` (AuditLog), `tags` (Evidence) are stored as plain `String?` — JSON encoded by application code, NOT Prisma Json type
- `content` field on Policy is a large Markdown string — needs `@db.Text` in MySQL
- `description`, `guidance`, `scope`, `notes` fields may be long — need `@db.Text` in MySQL
- File uploads stored at `public/uploads/` inside the container, path saved as relative string in `Evidence.filePath`
- No Prisma migrations — project uses `prisma db push` only

==================================================
## YOUR TASKS
==================================================

### TASK 1 — MySQL Prisma Schema

Generate the complete updated `prisma/schema.prisma` for MySQL.

Requirements:
- Change provider from `sqlite` to `mysql`
- Add `@db.Text` to all long text fields: `Policy.content`, `Control.description`, `Control.guidance`, `Framework.description`, `AuditTask.description`, `Risk.description`, `Vulnerability.description`, `Checklist.description`, `Evidence.description`, `AuditLog.meta`, `ChecklistItem.options`, `ChecklistItem.hint`, `ControlAssignment.notes`, `Tenant.address`, `User.avatarUrl`
- Add `@db.VarChar(191)` to all `String @unique` fields (MySQL index length limit): `Tenant.slug`, `User.email`, `Framework.code`, `Session.token`, `PasswordReset.token`
- Keep all relations, indexes, and @@unique constraints exactly as-is
- Keep using cuid() for IDs (compatible with MySQL VARCHAR)
- Do NOT add any migration files — we will use `prisma db push`

### TASK 2 — Updated package.json scripts

Add a `db:deploy` script:
```
"db:deploy": "prisma generate && prisma db push"
```

### TASK 3 — Dockerfile

Generate a production Dockerfile for Coolify with these exact requirements:
- Base image: `oven/bun:1` for build stages, `oven/bun:1-slim` for runtime
- Three stages: `deps`, `builder`, `runner`
- Stage `deps`: copy package.json + bun.lock, run `bun install --frozen-lockfile`
- Stage `builder`: copy deps, copy all source, run `bunx prisma generate`, run `bun run build` (which does next build + copies static + public into standalone)
- Stage `runner`:
  - Copy `.next/standalone` to `/app`
  - Copy `prisma/` to `/app/prisma`
  - Copy `node_modules/.prisma` and `node_modules/@prisma` to `/app/node_modules/`
  - Copy `docker-entrypoint.sh` to `/app/` and chmod +x
  - Set ENV: NODE_ENV=production, NEXT_TELEMETRY_DISABLED=1, PORT=3000, HOSTNAME=0.0.0.0
  - Create volume mount point: `/app/uploads` (for persistent file uploads)
  - EXPOSE 3000
  - ENTRYPOINT ["./docker-entrypoint.sh"]

### TASK 4 — docker-entrypoint.sh

Generate a startup script with:
1. Print DATABASE_URL (masked — show only first 20 chars)
2. Run `bunx prisma generate --schema ./prisma/schema.prisma`
3. Run `bunx prisma db push --schema ./prisma/schema.prisma --skip-generate` (idempotent schema sync)
4. Check if seed has run: look for an env var `SEED_DB=true` — if set, run `bun run ./prisma/seed.ts` then unset
5. Start Next.js: `exec bun server.js`

### TASK 5 — .dockerignore

Generate a complete `.dockerignore` excluding: `.git`, `node_modules`, `.next`, `db/`, `*.db`, `.env`, `dev.log`, `server.log`, `.zscripts/`, `download/`, `examples/`

### TASK 6 — docker-compose.yml

Generate a `docker-compose.yml` with:
- Service `app`: build from Dockerfile, port 3000:3000, volume `uploads_data:/app/uploads`, depends_on mysql
- Service `mysql`: image `mysql:8.0`, environment variables for MYSQL_ROOT_PASSWORD, MYSQL_DATABASE=isecurify, MYSQL_USER=isecurify_user, MYSQL_PASSWORD, volume `mysql_data:/var/lib/mysql`, healthcheck using `mysqladmin ping`
- Named volumes: `mysql_data`, `uploads_data`
- All sensitive values referenced from `.env` file

### TASK 7 — Production .env.example

Generate a complete `.env.example`:
```
# MySQL connection (for docker-compose local or Coolify MySQL resource)
DATABASE_URL=mysql://isecurify_user:StrongPassword123@mysql:3306/isecurify

# Next.js
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=https://your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com

# App
NODE_ENV=production
PORT=3000

# Uploads directory (mounted volume in Docker/Coolify)
UPLOAD_PATH=/app/uploads

# Seeding (set to "true" only on first deployment, then remove)
SEED_DB=true

# MySQL (for docker-compose only)
MYSQL_ROOT_PASSWORD=RootPassword123
MYSQL_DATABASE=isecurify
MYSQL_USER=isecurify_user
MYSQL_PASSWORD=StrongPassword123
```
Explain every variable.

### TASK 8 — src/lib/db.ts update

The current db.ts logs all queries in production. Generate an updated version that only logs in development:
```ts
// only log queries in dev
log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
```

### TASK 9 — Complete README.md for Coolify Deployment

Generate a complete production README specifically for deploying iSecurify on Coolify with MySQL. Include every section below with real, non-generic content based on this project:

#### Sections required:

**# iSecurify GRC Platform — Coolify Deployment Guide**

**## Architecture Overview**
- Next.js 16 standalone + Bun runtime
- MySQL 8.0 (Coolify managed resource)
- Prisma ORM 6.x (db push, no migrations)
- Custom scrypt session auth
- File uploads persisted via Docker volume at /app/uploads

**## Prerequisites**
- Ubuntu 22.04 VPS
- Coolify installed (https://coolify.io/docs/installation)
- Domain with DNS A record pointing to server
- GitHub repo with this code pushed

**## Step 1 — Push Code to GitHub**
Exact git commands to init, add remote, push.

**## Step 2 — MySQL in Coolify**
- Go to Coolify → Resources → New → MySQL 8.0
- Set database name: `isecurify`
- Set username: `isecurify_user`
- Set a strong password
- Enable persistent storage (Coolify volume)
- After creation, copy the internal connection string — it will look like:
  `mysql://isecurify_user:PASSWORD@SERVICE_NAME:3306/isecurify`

**## Step 3 — Create Application in Coolify**
- New Resource → Application → GitHub
- Select your repo
- Build Pack: **Dockerfile**
- Dockerfile path: `Dockerfile`
- Port: **3000**

**## Step 4 — Environment Variables in Coolify**
List every env var to set in Coolify's Environment panel, with explanations.

**## Step 5 — Persistent Storage (Uploads)**
- In Coolify → Application → Storages
- Add volume: mount `/app/uploads`
- This persists evidence file uploads across deploys

**## Step 6 — Domain & SSL**
- In Coolify → Application → Domains
- Add your domain
- Enable "Generate SSL Certificate" (Let's Encrypt automatic)

**## Step 7 — First Deployment**
- Set `SEED_DB=true` in env vars for first deploy only
- Click Deploy
- After deploy succeeds, remove `SEED_DB=true` and redeploy

**## Default Login Credentials**
```
Super Admin:  superadmin@isecurify.com  /  Admin@123
Tenant Admin: sarah.mitchell@acme.com   /  Tenant@123
```
CHANGE THESE IMMEDIATELY after first login.

**## Prisma Commands (run in Coolify Terminal)**
```bash
# Schema sync (runs automatically on startup)
bunx prisma db push

# Manual seed (if SEED_DB env var approach is not used)
bun run prisma/seed.ts

# Inspect database
bunx prisma studio
```

**## Redeploy / Updates**
- Push code to GitHub → Coolify auto-deploys (if webhook configured)
- Schema changes: just update `prisma/schema.prisma`, Coolify will run `db push` on startup

**## File Uploads**
- Uploads stored in `/app/uploads` volume
- The volume persists across container restarts and redeployments
- Current evidence route saves `filePath` as relative path under uploads/

**## Troubleshooting**

| Problem | Solution |
|---------|----------|
| `DATABASE_URL` not found | Check Coolify env vars panel |
| `Can't reach database server` | Check MySQL service name matches DATABASE_URL host |
| `Table doesn't exist` | Prisma db push didn't run — check entrypoint logs |
| Build fails on `bun install` | Check bun.lock is committed to git |
| Uploads not persisting | Check `/app/uploads` volume is mounted in Coolify |
| `NEXTAUTH_SECRET` error | Set NEXTAUTH_SECRET env var (even though custom auth is used, next-auth package checks for it) |

**## Backups**
- MySQL: Coolify → MySQL Resource → Backups tab → enable scheduled backups
- Uploads: periodically copy `/app/uploads` volume to external storage

**## Monitoring**
- Coolify → Application → Logs (live container logs)
- Health check URL: `GET /api` (returns 200)

### TASK 10 — Deployment Checklist

Generate a production deployment checklist with checkboxes covering all steps.

==================================================
## OUTPUT FORMAT
==================================================

Provide all output in clearly labeled code blocks. For each file, use a header like:

### File: prisma/schema.prisma
```prisma
...
```

### File: Dockerfile
```dockerfile
...
```

etc.

Generate ALL tasks completely. Do not truncate any output.
