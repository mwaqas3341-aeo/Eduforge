# eduforge — Step 1: Project Scaffold + Auth

This is the first working slice of the app: signup, login, session
handling, and the dashboard/admin shells they protect. It's been build-
and typecheck-verified (`npx next build` passes clean).

## What's included
- Next.js 14 (App Router) + TypeScript + Tailwind
- Signup: Name, Father Name, Address, CNIC, Cell No, Email, Password —
  branches into Govt (searchable dropdown against `govt_schools`) or
  Private (free-text school name)
- Login: CNIC + password
- Passwords hashed with bcrypt (never stored/logged in plaintext)
- Sessions: signed JWT in an httpOnly cookie (`lib/session.ts`)
- Middleware protecting `/dashboard/*` and `/admin/*`
- A new user automatically gets a `usage` row (10 free credits, per the
  design doc)

## Setup

1. **Run the schema first** (`001_schema.sql`) against your Supabase
   project if you haven't already.

2. **Install dependencies:**
   ```
   npm install
   ```

3. **Environment variables** — copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` — Project Settings → API → Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API → `service_role` key
     (⚠️ keep this secret — it bypasses Row Level Security; never commit it
     or expose it to the browser)
   - `SESSION_SECRET` — any long random string, e.g. generate with:
     ```
     openssl rand -base64 32
     ```

4. **Add at least one govt school** so signup's search has something to
   find (run in Supabase SQL editor):
   ```sql
   insert into public.govt_schools (name, district, board)
   values ('GES CHAK NO.251/TDA', 'Layyah', null);
   ```

5. **Run it:**
   ```
   npm run dev
   ```
   Visit `http://localhost:3000`.

## Making yourself an admin

There's no signup toggle for this on purpose (don't want it exposed
publicly). After creating your account, promote it manually in the
Supabase SQL editor:
```sql
update public.users set is_admin = true where cnic = '35202-1234567-1';
```
Then log out and back in — the JWT is issued at login time, so it needs
to be re-issued to pick up the admin flag.

## Why service-role key + app-level checks instead of RLS via `auth.uid()`

Since login is CNIC-based rather than Supabase Auth's email/phone system,
API routes use the Supabase **service role** key (server-side only,
never in client code) and enforce "a user can only touch their own data"
in application code. The RLS policies from `001_schema.sql` still exist
as a defense-in-depth layer, but the service role key bypasses them by
design — that's expected and fine here since all DB access is mediated
by these trusted API routes, not direct client-side Supabase calls.

## Not yet built (coming in later steps)
- Subject selection + total marks per subject (exam config)
- Excel template generation/download
- Excel upload, validation, grading engine, auto-remarks
- PDF generation (merged multi-page PDF per batch)
- Credits deduction + "buy more" flow, manual payment approval
- Admin screens (subjects, activity categories, grade bands, remark
  templates, govt schools, payment approvals)
- 7-day Storage cleanup Edge Function
