# iSecurify GRC Platform — Worklog

## Task ID: 1 — Project Setup & Source File Migration
- **Agent:** main
- **Date:** 2025-06-22
- **Description:** Extracted project from tar archive (`workspace-dad165d1-94bd-4bce-a1d4-e8abe21f82b0 (7).tar`). Copied all iSecurify GRC source files (src/lib/, src/app/api routes, src/components/app/, hooks, prisma/seed.ts, public/) from the extracted archive to the working project directory. Installed missing dependencies: `mysql2` (Prisma MySQL driver) and `mammoth` (document conversion).

## Task ID: 2 — TASK 1: MySQL Prisma Schema
- **Agent:** main
- **Date:** 2025-06-22
- **Description:** Created MySQL-ready Prisma schema at `prisma/schema.mysql.prisma` with:
  - `provider = "mysql"`
  - `@db.VarChar(191)` on 5 unique String fields: Tenant.slug, User.email, Framework.code, Session.token, PasswordReset.token
  - `@db.Text` on 15 long text fields: Policy.content, Control.description, Control.guidance, Framework.description, AuditTask.description, Risk.description, Vulnerability.description, Checklist.description, Evidence.description, AuditLog.meta, ChecklistItem.options, ChecklistItem.hint, ControlAssignment.notes, Tenant.address, User.avatarUrl
  - Schema validated successfully with Prisma CLI
  - Active `prisma/schema.prisma` kept as SQLite for local development
  - Before deployment, copy `schema.mysql.prisma` → `schema.prisma`

## Task ID: 3 — TASKS 3-7: Deployment Files (Dockerfile, entrypoint, dockerignore, compose, env)
- **Agent:** main
- **Date:** 2025-06-22
- **Description:** Created all Docker/deployment configuration files:
  - `Dockerfile` — 3-stage build (deps → builder → runner) with Bun runtime, Prisma generate, standalone output, mysql2 driver, entrypoint script
  - `docker-entrypoint.sh` — Startup script with masked DB URL logging, prisma generate, db push (idempotent), conditional SEED_DB, exec bun server.js
  - `.dockerignore` — Excludes .git, node_modules, .next, db/, .env, dev artifacts, mini-services, examples, upload
  - `docker-compose.yml` — Two-service stack (app + MySQL 8.0) with healthcheck, named volumes (mysql_data, uploads_data), env passthrough
  - `.env.example` — Fully documented env template with explanations for every variable (DATABASE_URL, NextAuth, app URLs, SEED_DB, MySQL credentials)

## Task ID: 4 — TASK 2 & 8: package.json and db.ts Updates
- **Agent:** main
- **Date:** 2025-06-22
- **Description:**
  - Added `db:deploy` script to package.json: `"db:deploy": "prisma generate && prisma db push"`
  - Updated `src/lib/db.ts` to only log queries in development: `log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error']`

## Task ID: 5 — TASK 9 & 10: README and Deployment Checklist
- **Agent:** main
- **Date:** 2025-06-22
- **Description:** Created comprehensive Coolify deployment README at `README.md` with all required sections: architecture overview, prerequisites, 7-step deployment guide, default credentials, Prisma commands, troubleshooting table, backups, monitoring, and a 30-item deployment checklist with checkboxes.

## Task ID: 6 — Fix: App Rendering & Database Setup
- **Agent:** main
- **Date:** 2025-06-22
- **Description:** Fixed multiple issues that caused the app to show a blank page:
  - Updated `src/app/page.tsx` with iSecurify login/app shell logic (was default empty page)
  - Updated `src/app/layout.tsx` with iSecurify metadata and Sonner toaster
  - Updated `src/app/globals.css` with iSecurify brand theme (purple/charcoal/teal palette)
  - Fixed Prisma schema fields that lost optional `?` markers during MySQL annotation removal
  - Deleted old SQLite DB, re-pushed clean schema, seeded database successfully
  - Verified login page renders correctly with all branding, form fields, and demo credentials
  - Verified login API works (POST /api/auth/login returns 200 with session cookie)
  - Simplified dev script from `next dev -p 3000 2>&1 | tee dev.log` to `next dev -p 3000`
  - Created separate `prisma/schema.mysql.prisma` for deployment (active schema stays SQLite for local dev)

## Task ID: 7-a — Fix ControlsView Import Dialog Scrollability & Add Export Functionality
- **Agent:** general-purpose
- **Date:** 2025-06-22
- **Description:** Two fixes to `src/components/app/views/ControlsView.tsx`:
  1. **Import Dialog scrollability fix:** Changed `DialogContent` to `max-w-2xl max-h-[85vh] flex flex-col`, wrapped middle content in `flex-1 overflow-y-auto -mx-6 px-6`, added `mt-4 shrink-0` to `DialogFooter` so Import/Cancel buttons stay visible.
  2. **Export controls dropdown:** Added `Download` icon and `DropdownMenu` imports. Added `csvEscape`, `exportJSON`, and `exportCSV` functions inside `ControlsView`. Added an Export `DropdownMenu` button (disabled when no controls loaded) in the header actions area, with JSON and CSV format options.

## Task ID: 7-b — Fix Logo Display Across App
- **Agent:** general-purpose
- **Date:** 2025-06-22
- **Description:** Fixed logo (transparent PNG) visibility issues across the application:
  1. **LoginPage.tsx — Hero panel (dark bg):** Wrapped transparent PNG in a `w-12 h-12 rounded-xl bg-white` container for high contrast. The white box makes the purple shield + white eagle clearly visible against the dark purple gradient.
  2. **LoginPage.tsx — Mobile view (white bg):** Wrapped icon in a `w-12 h-12 rounded-xl bg-[#812671]` container for contrast on white background.
  3. **AppShell.tsx — Sidebar (dark bg):** Used `bg-white/10 dark:bg-white/15` container for subtle contrast in the charcoal sidebar.
  4. Copied uploaded logo files to `public/`: `isecurify-icon.png` (transparent PNG, 663×662) and `isecurify-logo-small.jpg` (JPG, 801×366).
  5. Verified via VLM screenshot analysis: logo is now clearly visible as "white rounded square containing a purple shield logo with a white bird/eagle emblem."

## Task ID: 7-c — Final Logo Polish
- **Agent:** main
- **Date:** 2025-06-22
- **Description:** Further refined logo containers:
  - LoginPage hero panel: Changed from bare `img w-12 h-12` to `div w-12 h-12 rounded-xl bg-white + img w-10 h-10` for maximum contrast on dark purple gradient
  - AppShell sidebar: Changed container from `bg-[#812671]/15` to `bg-white/10 dark:bg-white/15` for clean visibility in both light and dark sidebar themes
