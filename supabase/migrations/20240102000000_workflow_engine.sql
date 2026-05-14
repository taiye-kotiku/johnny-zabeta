-- ============================================================
-- Zabeta: Workflow Engine Schema
-- ============================================================

-- ============================================================
-- Companies (multi-tenant support)
-- ============================================================

create table companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  logo_url text,
  owner_id uuid references profiles(id),
  plan text not null default 'starter',
  max_workers integer not null default 50,
  settings jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table companies enable row level security;

create policy "Admins view own company"
  on companies for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Add company_id to profiles
alter table profiles add column if not exists company_id uuid references companies(id);

-- ============================================================
-- Workflow Events (audit / event log)
-- ============================================================

create type workflow_event_type as enum (
  'session_started',
  'session_ended',
  'session_verified',
  'activity_packet_received',
  'onboarding_started',
  'onboarding_completed',
  'task_assigned',
  'task_submitted',
  'task_approved',
  'task_rejected',
  'payout_requested',
  'payout_approved',
  'payout_released',
  'payout_rejected',
  'worker_activated',
  'worker_deactivated',
  'withdrawal_enabled',
  'withdrawal_disabled',
  'screenshot_uploaded'
);

create table workflow_events (
  id uuid primary key default uuid_generate_v4(),
  event_type workflow_event_type not null,
  user_id uuid references profiles(id) on delete set null,
  actor_id uuid references profiles(id) on delete set null,
  entity_id uuid,
  entity_type text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table workflow_events enable row level security;

create policy "Users view own events"
  on workflow_events for select
  using (auth.uid() = user_id);

create policy "Admins view all events"
  on workflow_events for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "System inserts events"
  on workflow_events for insert
  with check (true);

-- Index for fast event feed queries
create index workflow_events_user_created on workflow_events(user_id, created_at desc);
create index workflow_events_type_created on workflow_events(event_type, created_at desc);

-- ============================================================
-- Notifications
-- ============================================================

create type notification_type as enum (
  'info',
  'success',
  'warning',
  'error',
  'payout',
  'task',
  'session'
);

create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  type notification_type not null default 'info',
  title text not null,
  body text,
  is_read boolean not null default false,
  action_url text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

create policy "Users manage own notifications"
  on notifications for all
  using (auth.uid() = user_id);

create index notifications_user_read on notifications(user_id, is_read, created_at desc);

-- ============================================================
-- Workflow Rules (automation engine config)
-- ============================================================

create type rule_trigger as enum (
  'session_duration_threshold',
  'activity_packet_count',
  'task_approved',
  'onboarding_completed',
  'balance_threshold',
  'payout_requested'
);

create type rule_action as enum (
  'send_notification',
  'enable_withdrawal',
  'disable_withdrawal',
  'approve_payout',
  'lock_account',
  'create_task',
  'emit_event'
);

create table workflow_rules (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade,
  name text not null,
  description text,
  trigger rule_trigger not null,
  trigger_config jsonb not null default '{}',
  action rule_action not null,
  action_config jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table workflow_rules enable row level security;

create policy "Admins manage workflow rules"
  on workflow_rules for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- Session Analytics (materialized summary per session)
-- ============================================================

create table session_analytics (
  session_id uuid primary key references sessions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  total_keystrokes bigint not null default 0,
  total_mouse_events bigint not null default 0,
  total_focus_seconds integer not null default 0,
  packet_count integer not null default 0,
  screenshot_count integer not null default 0,
  computed_at timestamptz not null default now()
);

alter table session_analytics enable row level security;

create policy "Users view own analytics"
  on session_analytics for select
  using (auth.uid() = user_id);

create policy "Admins view all analytics"
  on session_analytics for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "System manages analytics"
  on session_analytics for all
  with check (true);

-- ============================================================
-- Verification Queue
-- ============================================================

create type verification_status as enum ('pending', 'passed', 'failed', 'manual_review');

create table verification_queue (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  check_type text not null,
  status verification_status not null default 'pending',
  score numeric(5, 2),
  details jsonb not null default '{}',
  reviewed_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table verification_queue enable row level security;

create policy "Users view own verifications"
  on verification_queue for select
  using (auth.uid() = user_id);

create policy "Admins manage verifications"
  on verification_queue for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- Helper: emit_workflow_event() — call from edge functions
-- ============================================================

create or replace function emit_workflow_event(
  p_event_type workflow_event_type,
  p_user_id uuid,
  p_actor_id uuid,
  p_entity_id uuid,
  p_entity_type text,
  p_payload jsonb default '{}'
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  insert into workflow_events (event_type, user_id, actor_id, entity_id, entity_type, payload)
  values (p_event_type, p_user_id, p_actor_id, p_entity_id, p_entity_type, p_payload)
  returning id into v_id;
  return v_id;
end;
$$;

-- ============================================================
-- Trigger: auto-compute session analytics on activity_log insert
-- ============================================================

create or replace function update_session_analytics()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into session_analytics (session_id, user_id, total_keystrokes, total_mouse_events, total_focus_seconds, packet_count)
  select
    new.session_id,
    new.user_id,
    sum(keystroke_count),
    sum(mouse_event_count),
    sum(window_focus_seconds),
    count(*)
  from activity_logs
  where session_id = new.session_id
  on conflict (session_id) do update set
    total_keystrokes = excluded.total_keystrokes,
    total_mouse_events = excluded.total_mouse_events,
    total_focus_seconds = excluded.total_focus_seconds,
    packet_count = excluded.packet_count,
    computed_at = now();
  return new;
end;
$$;

create trigger activity_log_analytics
  after insert on activity_logs
  for each row execute procedure update_session_analytics();

-- ============================================================
-- Trigger: notify on task status change
-- ============================================================

create or replace function notify_on_task_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'approved' and old.status != 'approved' and new.assigned_to is not null then
    insert into notifications (user_id, type, title, body, metadata)
    values (
      new.assigned_to,
      'task',
      'Task approved',
      'Your task "' || new.title || '" has been approved.',
      jsonb_build_object('task_id', new.id, 'reward', new.reward_amount)
    );
  end if;

  if new.status = 'rejected' and old.status != 'rejected' and new.assigned_to is not null then
    insert into notifications (user_id, type, title, body, metadata)
    values (
      new.assigned_to,
      'task',
      'Task needs revision',
      'Your task "' || new.title || '" was returned for revision.',
      jsonb_build_object('task_id', new.id)
    );
  end if;

  return new;
end;
$$;

create trigger task_status_notification
  after update on tasks
  for each row when (old.status is distinct from new.status)
  execute procedure notify_on_task_update();

-- ============================================================
-- Trigger: notify on payout status change
-- ============================================================

create or replace function notify_on_payout_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'released' and old.status != 'released' then
    insert into notifications (user_id, type, title, body, metadata)
    values (
      new.user_id,
      'payout',
      'Payout released',
      'Your payout of $' || new.amount || ' has been released.',
      jsonb_build_object('payout_id', new.id, 'amount', new.amount)
    );
  end if;

  if new.status = 'rejected' and old.status != 'rejected' then
    insert into notifications (user_id, type, title, body, metadata)
    values (
      new.user_id,
      'payout',
      'Payout rejected',
      'Your payout request was rejected. Please contact support.',
      jsonb_build_object('payout_id', new.id)
    );
  end if;

  return new;
end;
$$;

create trigger payout_status_notification
  after update on payouts
  for each row when (old.status is distinct from new.status)
  execute procedure notify_on_payout_update();

-- ============================================================
-- Seed default workflow rules
-- ============================================================

insert into workflow_rules (name, description, trigger, trigger_config, action, action_config) values
  (
    'Enable withdrawal after onboarding',
    'Automatically enable payout access once a worker completes training',
    'onboarding_completed',
    '{}',
    'send_notification',
    '{"title": "Withdrawals unlocked", "body": "You can now request payouts once your balance reaches the minimum."}'
  ),
  (
    'Session duration alert',
    'Notify admin when a session exceeds 8 hours',
    'session_duration_threshold',
    '{"threshold_seconds": 28800}',
    'send_notification',
    '{"title": "Long session detected", "body": "A session has exceeded 8 hours."}'
  );
