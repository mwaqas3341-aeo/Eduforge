-- ============================================================================
-- eduforge — core schema
-- Run this in the Supabase SQL editor (or via `supabase db push` / migrations)
-- ============================================================================

create extension if not exists "pgcrypto";   -- for gen_random_uuid() + password hashing
create extension if not exists "pg_cron";    -- for the 7-day cleanup job (Supabase: enable in Database > Extensions)

-- ============================================================================
-- 1. GOVT / PUBLIC SCHOOLS (admin-managed master list)
-- Created before `users` since users.govt_school_id references it.
-- ============================================================================
create table public.govt_schools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  district    text,
  board       text,
  created_at  timestamptz not null default now()
);

create index idx_govt_schools_name on public.govt_schools using gin (to_tsvector('simple', name));

-- ============================================================================
-- 2. USERS
-- Auth is custom (CNIC-based login), NOT Supabase Auth's email/phone system.
-- App layer hashes passwords with bcrypt (via a library like `bcryptjs`) before
-- insert, and verifies on login. Session handling (JWT/iron-session) lives in
-- the Next.js app, not in Postgres.
-- ============================================================================
create table public.users (
  id                uuid primary key default gen_random_uuid(),
  full_name         text not null,
  father_name       text not null,
  address           text not null,
  cnic              text not null unique,              -- format: XXXXX-XXXXXXX-X, validated in app layer
  cell_no           text not null,
  email             text not null unique,
  password_hash     text not null,                     -- bcrypt hash, never plaintext
  school_type       text not null check (school_type in ('govt', 'private')),
  govt_school_id    uuid references public.govt_schools(id),   -- set if school_type = 'govt'
  private_school_name text,                             -- set if school_type = 'private'
  is_admin          boolean not null default false,
  created_at        timestamptz not null default now(),

  constraint school_selection_check check (
    (school_type = 'govt' and govt_school_id is not null and private_school_name is null)
    or
    (school_type = 'private' and private_school_name is not null and govt_school_id is null)
  )
);

create index idx_users_cnic on public.users(cnic);

-- ============================================================================
-- 3. SUBJECTS (admin-curated + user-added-and-synced, per §18 of design doc)
-- ============================================================================
create table public.subjects (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  status       text not null default 'active' check (status in ('pending', 'active', 'rejected')),
  created_by   uuid references public.users(id),   -- null = admin-seeded
  created_at   timestamptz not null default now(),
  approved_by  uuid references public.users(id),
  approved_at  timestamptz,

  unique (name)
);

-- ============================================================================
-- 4. ACTIVITY CATEGORIES (extracurricular — same admin + user-add pattern)
-- ============================================================================
create table public.activity_categories (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  status       text not null default 'active' check (status in ('pending', 'active', 'rejected')),
  created_by   uuid references public.users(id),
  created_at   timestamptz not null default now(),
  approved_by  uuid references public.users(id),
  approved_at  timestamptz,

  unique (name)
);

-- ============================================================================
-- 5. GRADE BANDS (config-driven grading formula, admin-editable)
-- ============================================================================
create table public.grade_bands (
  id           uuid primary key default gen_random_uuid(),
  grade_letter text not null,
  min_percent  numeric(5,2) not null,
  max_percent  numeric(5,2) not null,
  sort_order   int not null default 0,

  constraint valid_range check (min_percent <= max_percent)
);

-- ============================================================================
-- 6. REMARK TEMPLATES (auto-generated teacher remarks per grade, §19)
-- ============================================================================
create table public.remark_templates (
  id           uuid primary key default gen_random_uuid(),
  grade_letter text not null,
  remark_text  text not null,     -- supports {name} placeholder
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ============================================================================
-- 7. EXAM CONFIGS (one per batch/class setup — subjects, totals, attendance period)
-- ============================================================================
create table public.exam_configs (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.users(id) on delete cascade,
  class_name             text not null,
  session_label          text,                      -- e.g. "2025-26"
  attendance_period_label text,                      -- e.g. "Full Year 2025-26", "1st Term"
  created_at             timestamptz not null default now()
);

create index idx_exam_configs_user on public.exam_configs(user_id);

-- Which subjects + total marks are part of this exam config
create table public.exam_config_subjects (
  id             uuid primary key default gen_random_uuid(),
  exam_config_id uuid not null references public.exam_configs(id) on delete cascade,
  subject_id     uuid not null references public.subjects(id),
  total_marks    numeric(6,2) not null check (total_marks > 0),
  sort_order     int not null default 0,

  unique (exam_config_id, subject_id)
);

-- Which extracurricular activity categories are being tracked in this batch
create table public.exam_config_activities (
  id                    uuid primary key default gen_random_uuid(),
  exam_config_id        uuid not null references public.exam_configs(id) on delete cascade,
  activity_category_id  uuid not null references public.activity_categories(id),
  sort_order            int not null default 0,

  unique (exam_config_id, activity_category_id)
);

-- ============================================================================
-- 8. RESULT BATCHES + ENTRIES
-- Data here is temporary — auto-purged after 7 days (see cleanup job below).
-- result_batches survives cleanup but gets stripped of any direct PII pointer.
-- ============================================================================
create table public.result_batches (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users(id) on delete cascade,
  exam_config_id     uuid references public.exam_configs(id),   -- kept even after config details age out
  student_count      int not null default 0,
  status             text not null default 'processing' check (status in ('processing', 'done', 'failed')),
  uploaded_excel_url text,     -- storage path, cleared on purge
  merged_pdf_url     text,     -- storage path, cleared on purge
  purge_at           timestamptz not null,   -- created_at + 7 days, used by the cleanup job
  created_at         timestamptz not null default now()
);

create index idx_result_batches_user on public.result_batches(user_id);
create index idx_result_batches_purge on public.result_batches(purge_at);

create table public.result_entries (
  id                 uuid primary key default gen_random_uuid(),
  batch_id           uuid not null references public.result_batches(id) on delete cascade,
  student_name       text not null,
  father_name        text not null,
  roll_no            text not null,
  b_form_no          text,                     -- optional (§17)
  class_name         text not null,
  section            text,
  date_of_birth      date,
  marks_json         jsonb not null,           -- { subject_id: obtained_marks }
  overall_obtained   numeric(7,2),
  overall_total      numeric(7,2),
  overall_percent    numeric(5,2),
  overall_grade      text,
  remark_text        text,                     -- auto-filled from remark_templates, teacher-editable
  total_days         int,
  days_present       int,
  attendance_percent numeric(5,2),
  activities_json    jsonb,                    -- { activity_category_id: rating }
  pdf_url            text,                     -- individual page/url within merged PDF, cleared on purge
  created_at         timestamptz not null default now()
);

create index idx_result_entries_batch on public.result_entries(batch_id);

-- ============================================================================
-- 9. USAGE (free + paid credits)
-- ============================================================================
create table public.usage (
  user_id            uuid primary key references public.users(id) on delete cascade,
  free_credits_total int not null default 10,
  free_credits_used  int not null default 0,
  paid_credits_total int not null default 0,
  paid_credits_used  int not null default 0,
  updated_at         timestamptz not null default now()
);

-- ============================================================================
-- 10. PAYMENTS (manual review first, automated gateway later)
-- ============================================================================
create table public.payments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users(id) on delete cascade,
  amount_pkr         numeric(10,2) not null,
  credits_purchased  int not null,
  proof_url          text,                      -- payment screenshot/reference, Storage path
  status             text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by        uuid references public.users(id),
  reviewed_at        timestamptz,
  created_at         timestamptz not null default now()
);

create index idx_payments_status on public.payments(status);

-- ============================================================================
-- 11. ROW LEVEL SECURITY
-- Users can only see/manage their own data. Admins (is_admin = true) get full
-- access via a separate policy. Since auth is custom (not Supabase Auth), the
-- app sets `request.jwt.claims` via a Postgres session variable per request,
-- or — simpler for a custom-auth setup — RLS is enforced by always querying
-- through a backend role using the authenticated user's id explicitly rather
-- than relying on `auth.uid()`. If you later migrate to Supabase Auth proper,
-- swap `current_setting('app.current_user_id')` calls below for `auth.uid()`.
-- ============================================================================

alter table public.users enable row level security;
alter table public.exam_configs enable row level security;
alter table public.exam_config_subjects enable row level security;
alter table public.exam_config_activities enable row level security;
alter table public.result_batches enable row level security;
alter table public.result_entries enable row level security;
alter table public.usage enable row level security;
alter table public.payments enable row level security;

-- Helper: current user id from a session variable the app sets per-request
create or replace function public.current_user_id() returns uuid as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid;
$$ language sql stable;

create or replace function public.is_current_user_admin() returns boolean as $$
  select coalesce((select is_admin from public.users where id = public.current_user_id()), false);
$$ language sql stable;

create policy "users_self_access" on public.users
  for all using (id = public.current_user_id() or public.is_current_user_admin());

create policy "exam_configs_owner_access" on public.exam_configs
  for all using (user_id = public.current_user_id() or public.is_current_user_admin());

create policy "exam_config_subjects_owner_access" on public.exam_config_subjects
  for all using (
    exam_config_id in (select id from public.exam_configs where user_id = public.current_user_id())
    or public.is_current_user_admin()
  );

create policy "exam_config_activities_owner_access" on public.exam_config_activities
  for all using (
    exam_config_id in (select id from public.exam_configs where user_id = public.current_user_id())
    or public.is_current_user_admin()
  );

create policy "result_batches_owner_access" on public.result_batches
  for all using (user_id = public.current_user_id() or public.is_current_user_admin());

create policy "result_entries_owner_access" on public.result_entries
  for all using (
    batch_id in (select id from public.result_batches where user_id = public.current_user_id())
    or public.is_current_user_admin()
  );

create policy "usage_owner_access" on public.usage
  for all using (user_id = public.current_user_id() or public.is_current_user_admin());

create policy "payments_owner_access" on public.payments
  for all using (user_id = public.current_user_id() or public.is_current_user_admin());

-- subjects / activity_categories / grade_bands / remark_templates / govt_schools
-- are readable by everyone (any authenticated user), writable only by admins.
alter table public.subjects enable row level security;
alter table public.activity_categories enable row level security;
alter table public.grade_bands enable row level security;
alter table public.remark_templates enable row level security;
alter table public.govt_schools enable row level security;

create policy "subjects_read_all" on public.subjects for select using (true);
create policy "subjects_write_admin_or_owner_pending" on public.subjects
  for insert with check (created_by = public.current_user_id() or public.is_current_user_admin());
create policy "subjects_update_admin_only" on public.subjects
  for update using (public.is_current_user_admin());

create policy "activity_categories_read_all" on public.activity_categories for select using (true);
create policy "activity_categories_write_admin_or_owner_pending" on public.activity_categories
  for insert with check (created_by = public.current_user_id() or public.is_current_user_admin());
create policy "activity_categories_update_admin_only" on public.activity_categories
  for update using (public.is_current_user_admin());

create policy "grade_bands_read_all" on public.grade_bands for select using (true);
create policy "grade_bands_write_admin_only" on public.grade_bands for all using (public.is_current_user_admin());

create policy "remark_templates_read_all" on public.remark_templates for select using (true);
create policy "remark_templates_write_admin_only" on public.remark_templates for all using (public.is_current_user_admin());

create policy "govt_schools_read_all" on public.govt_schools for select using (true);
create policy "govt_schools_write_admin_only" on public.govt_schools for all using (public.is_current_user_admin());

-- ============================================================================
-- 12. SEED DATA
-- ============================================================================

insert into public.grade_bands (grade_letter, min_percent, max_percent, sort_order) values
  ('A+', 80.01, 100,   1),
  ('A',  70,    80,    2),
  ('B',  60,    69.99, 3),
  ('C',  50,    59.99, 4),
  ('D',  40,    49.99, 5),
  ('E',  33,    39.99, 6);

insert into public.subjects (name, status) values
  ('English', 'active'),
  ('Urdu', 'active'),
  ('Mathematics', 'active'),
  ('General Knowledge/General Science', 'active'),
  ('Social Studies/History/Geography', 'active'),
  ('Islamiat/Ethics', 'active'),
  ('Holy Quran', 'active'),
  ('Computer Education', 'active');

insert into public.activity_categories (name, status) values
  ('Participation in Teaching Activities', 'active'),
  ('Regularity of Homework', 'active'),
  ('Discipline', 'active'),
  ('Participation in Sports', 'active'),
  ('Bazm-e-Adab', 'active'),
  ('Feedback from Teachers/Colleagues', 'active');

insert into public.remark_templates (grade_letter, remark_text) values
  ('A+', 'Outstanding performance, {name} — keep up the excellent work.'),
  ('A+', 'Exceptional result, {name} — a proud achievement.'),
  ('A',  'Great performance, {name}! Well done.'),
  ('A',  'Very good result, {name} — keep working hard.'),
  ('B',  'Good performance, {name}. With more effort you can do even better.'),
  ('C',  'Satisfactory performance, {name}. More effort needed to improve.'),
  ('D',  'Needs improvement, {name} — please focus more on studies.'),
  ('E',  'Requires significant improvement and extra attention, {name}, at home and school.');

-- ============================================================================
-- 13. 7-DAY CLEANUP JOB (§14 of design doc)
-- Deletes result_entries + clears file URLs on result_batches older than 7 days.
-- Storage object deletion itself must happen in an Edge Function/worker that
-- reads the same purge_at cutoff and calls the Storage API — SQL alone can't
-- delete Storage objects, only DB rows/URL references.
-- ============================================================================

create or replace function public.purge_expired_results() returns void as $$
begin
  delete from public.result_entries
  where batch_id in (select id from public.result_batches where purge_at < now());

  update public.result_batches
  set uploaded_excel_url = null,
      merged_pdf_url = null
  where purge_at < now();
end;
$$ language plpgsql security definer;

-- Runs daily at 03:00 UTC — adjust to your target timezone as needed.
select cron.schedule(
  'purge-expired-results',
  '0 3 * * *',
  $$ select public.purge_expired_results(); $$
);
