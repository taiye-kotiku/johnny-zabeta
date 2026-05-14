-- ============================================================
-- Zabeta: Initial Schema
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- Enums
-- ============================================================

create type user_role as enum ('worker', 'admin');
create type session_status as enum ('active', 'paused', 'completed');
create type task_status as enum ('open', 'in_progress', 'submitted', 'approved', 'rejected');
create type payout_status as enum ('pending', 'approved', 'released', 'rejected');
create type training_status as enum ('not_started', 'in_progress', 'completed');

-- ============================================================
-- Profiles (extends auth.users)
-- ============================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  role user_role not null default 'worker',
  avatar_url text,

  -- Onboarding
  onboarding_status training_status not null default 'not_started',
  onboarding_completed_at timestamptz,

  -- Worker state
  is_active boolean not null default true,
  withdrawal_enabled boolean not null default false,
  hourly_rate numeric(10, 2) not null default 0,

  -- Wallet
  pending_balance numeric(12, 2) not null default 0,
  total_earned numeric(12, 2) not null default 0,
  total_withdrawn numeric(12, 2) not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on profiles for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Admins can update all profiles"
  on profiles for update
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- Training Slides
-- ============================================================

create table training_slides (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid,
  title text not null,
  content text not null,
  image_url text,
  slide_order integer not null,
  lock_duration_seconds integer not null default 5,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table training_slides enable row level security;

create policy "Anyone authenticated can view active slides"
  on training_slides for select
  using (auth.role() = 'authenticated' and is_active = true);

create policy "Admins can manage slides"
  on training_slides for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- Training Progress
-- ============================================================

create table training_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  slide_id uuid not null references training_slides(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  duration_viewed_seconds integer not null default 0,
  unique(user_id, slide_id)
);

alter table training_progress enable row level security;

create policy "Users manage own training progress"
  on training_progress for all
  using (auth.uid() = user_id);

create policy "Admins view all training progress"
  on training_progress for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- Sessions
-- ============================================================

create table sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  status session_status not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  verified boolean not null default false,
  earnings_accrued numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table sessions enable row level security;

create policy "Users view own sessions"
  on sessions for select
  using (auth.uid() = user_id);

create policy "Users insert own sessions"
  on sessions for insert
  with check (auth.uid() = user_id);

create policy "Users update own sessions"
  on sessions for update
  using (auth.uid() = user_id);

create policy "Admins view all sessions"
  on sessions for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- Activity Logs (60-second packets)
-- ============================================================

create table activity_logs (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  keystroke_count integer not null default 0,
  mouse_event_count integer not null default 0,
  window_focus_seconds integer not null default 0,
  recorded_at timestamptz not null default now(),
  packet_duration_seconds integer not null default 60
);

alter table activity_logs enable row level security;

create policy "Users insert own activity"
  on activity_logs for insert
  with check (auth.uid() = user_id);

create policy "Users view own activity"
  on activity_logs for select
  using (auth.uid() = user_id);

create policy "Admins view all activity"
  on activity_logs for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- Screenshots (optional, user-consented)
-- ============================================================

create table screenshots (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  storage_path text not null,
  file_size_kb integer,
  uploaded_at timestamptz not null default now()
);

alter table screenshots enable row level security;

create policy "Users view own screenshots"
  on screenshots for select
  using (auth.uid() = user_id);

create policy "Users insert own screenshots"
  on screenshots for insert
  with check (auth.uid() = user_id);

create policy "Admins view all screenshots"
  on screenshots for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- Tasks
-- ============================================================

create table tasks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  assigned_to uuid references profiles(id) on delete set null,
  created_by uuid not null references profiles(id),
  status task_status not null default 'open',
  reward_amount numeric(10, 2) not null default 0,
  deadline timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tasks enable row level security;

create policy "Workers view their tasks"
  on tasks for select
  using (
    auth.uid() = assigned_to
    or exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Workers update their tasks"
  on tasks for update
  using (auth.uid() = assigned_to);

create policy "Admins manage all tasks"
  on tasks for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- Payouts
-- ============================================================

create table payouts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  amount numeric(12, 2) not null,
  status payout_status not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  released_at timestamptz,
  notes text
);

alter table payouts enable row level security;

create policy "Users view own payouts"
  on payouts for select
  using (auth.uid() = user_id);

create policy "Users request payouts"
  on payouts for insert
  with check (auth.uid() = user_id);

create policy "Admins manage payouts"
  on payouts for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- Trigger: auto-create profile on signup
-- ============================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- Trigger: update updated_at
-- ============================================================

create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute procedure update_updated_at();

create trigger tasks_updated_at
  before update on tasks
  for each row execute procedure update_updated_at();

-- ============================================================
-- Seed: default training slides
-- ============================================================

insert into training_slides (title, content, slide_order, lock_duration_seconds) values
  ('Welcome to Zabeta', 'Zabeta is a remote workforce platform built for distributed teams. You will manage your tasks, track your sessions, and receive automated payouts through this application.', 1, 5),
  ('How Sessions Work', 'When you start a session, Zabeta tracks your active work time. Activity metrics such as keystroke frequency and mouse movement are recorded to verify session authenticity. All tracking is transparent and visible to you in your dashboard.', 2, 5),
  ('Privacy & Data', 'Zabeta collects activity metadata to verify sessions — keystroke frequency (not content), mouse event counts, and optionally low-resolution activity snapshots. You control snapshot uploads and can disable them at any time.', 3, 5),
  ('Tasks & Earnings', 'Tasks are assigned by your team admin. Completing and submitting tasks earns reward amounts credited to your pending balance. Session time also accrues earnings based on your hourly rate.', 4, 5),
  ('Payouts', 'Your pending balance accumulates as you work. You can request a payout once your balance meets the minimum threshold. Payouts are reviewed and released by your admin within 1–3 business days.', 5, 5);
