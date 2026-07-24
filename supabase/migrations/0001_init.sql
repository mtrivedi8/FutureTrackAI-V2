-- FutureTrackAI schema
-- Replaces base44's hosted entities with plain Postgres tables + RLS.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_date()
returns trigger
language plpgsql
as $$
begin
  new.updated_date = now();
  return new;
end;
$$;

create or replace function public.current_email()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'email', '');
$$;

-- ---------------------------------------------------------------------------
-- profiles (auth user metadata: role, full name)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_date();

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- generic "owned by user_email" table setup
-- ---------------------------------------------------------------------------
create table public.teen_profiles (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  display_name text not null,
  age int,
  zipcode text,
  country text,
  city text,
  middle_school_name text,
  high_school_name text,
  school_name text,
  current_grade int,
  interests text[] not null default '{}',
  strengths text[] not null default '{}',
  goals text[] not null default '{}',
  preferred_learning_style text,
  dream_careers text[] not null default '{}',
  onboarding_completed boolean not null default false,
  avatar_emoji text,
  account_created_date timestamptz not null default now(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create index teen_profiles_user_email_idx on public.teen_profiles(user_email);

create table public.career_plans (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  career_tracks jsonb not null default '[]',
  selected_track_index int,
  school_name text,
  current_grade int,
  school_info jsonb,
  is_generating boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create index career_plans_user_email_idx on public.career_plans(user_email);

create table public.journey_entries (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  title text not null,
  type text not null check (type in (
    'School Course', 'Extracurricular', 'Sport', 'Internship', 'Online Course',
    'Volunteer', 'Competition', 'Summer Program', 'Other'
  )),
  grade int,
  year text,
  description text,
  status text check (status in ('Completed', 'In Progress')),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create index journey_entries_user_email_idx on public.journey_entries(user_email);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  status text not null check (status in ('pending', 'active')),
  checkout_session_id text,
  order_id text,
  plan text,
  amount_paid text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create index memberships_user_email_idx on public.memberships(user_email);
create index memberships_checkout_session_idx on public.memberships(checkout_session_id);

create table public.progress_updates (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  recommendation_id text,
  update_type text not null check (update_type in (
    'Achievement', 'Milestone', 'Reflection', 'Interest Change', 'Feedback'
  )),
  title text not null,
  description text,
  mood text check (mood in ('Excited', 'Motivated', 'Curious', 'Neutral', 'Struggling', 'Uncertain')),
  new_interests text[] not null default '{}',
  skills_gained text[] not null default '{}',
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create index progress_updates_user_email_idx on public.progress_updates(user_email);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  type text not null check (type in ('Career Path', 'Skill', 'Course', 'Activity', 'Project')),
  title text not null,
  description text not null,
  why_recommended text,
  difficulty_level text check (difficulty_level in ('Beginner', 'Intermediate', 'Advanced')),
  estimated_duration text,
  resources text[] not null default '{}',
  status text not null default 'New' check (status in ('New', 'Exploring', 'In Progress', 'Completed', 'Skipped')),
  rating numeric,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create index recommendations_user_email_idx on public.recommendations(user_email);

create table public.usage_credits (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  month text not null,
  total_cost numeric not null default 0,
  blocked boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create index usage_credits_user_email_month_idx on public.usage_credits(user_email, month);

-- ---------------------------------------------------------------------------
-- shared / system tables
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text not null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table public.school_directory (
  id uuid primary key default gen_random_uuid(),
  zipcode text not null,
  school_name text not null,
  school_type text not null check (school_type in ('middle', 'high', 'middle_high')),
  city text,
  state text,
  district text,
  website text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create index school_directory_zipcode_idx on public.school_directory(zipcode);
create index school_directory_state_idx on public.school_directory(state);

create table public.school_document_cache (
  id uuid primary key default gen_random_uuid(),
  school_name text not null,
  zipcode text not null,
  cached_data jsonb,
  document_urls jsonb,
  cached_date timestamptz,
  expires_at timestamptz,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create index school_document_cache_lookup_idx on public.school_document_cache(school_name, zipcode);

-- updated_date triggers for every table above
do $$
declare
  t text;
begin
  foreach t in array array[
    'teen_profiles', 'career_plans', 'journey_entries', 'memberships',
    'progress_updates', 'recommendations', 'usage_credits', 'app_settings',
    'school_directory', 'school_document_cache'
  ]
  loop
    execute format(
      'create trigger trg_%s_updated before update on public.%I for each row execute function public.set_updated_date();',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.teen_profiles enable row level security;
alter table public.career_plans enable row level security;
alter table public.journey_entries enable row level security;
alter table public.memberships enable row level security;
alter table public.progress_updates enable row level security;
alter table public.recommendations enable row level security;
alter table public.usage_credits enable row level security;
alter table public.app_settings enable row level security;
alter table public.school_directory enable row level security;
alter table public.school_document_cache enable row level security;

-- User-owned tables: a signed-in user may only see/change rows tagged with
-- their own email. The service-role key used by edge functions bypasses RLS.
do $$
declare
  t text;
begin
  foreach t in array array[
    'teen_profiles', 'career_plans', 'journey_entries',
    'memberships', 'progress_updates', 'recommendations', 'usage_credits'
  ]
  loop
    execute format(
      'create policy "%s_owner_select" on public.%I for select using (user_email = public.current_email());',
      t, t
    );
    execute format(
      'create policy "%s_owner_insert" on public.%I for insert with check (user_email = public.current_email());',
      t, t
    );
    execute format(
      'create policy "%s_owner_update" on public.%I for update using (user_email = public.current_email()) with check (user_email = public.current_email());',
      t, t
    );
    execute format(
      'create policy "%s_owner_delete" on public.%I for delete using (user_email = public.current_email());',
      t, t
    );
  end loop;
end $$;

-- app_settings: any signed-in user may read/write (mirrors the original
-- app's behavior, where the Profile admin panel toggles these directly from
-- the client and access is only gated by hiding the UI, not by the backend).
create policy "app_settings_authenticated_select" on public.app_settings
  for select using (auth.role() = 'authenticated');
create policy "app_settings_authenticated_insert" on public.app_settings
  for insert with check (auth.role() = 'authenticated');
create policy "app_settings_authenticated_update" on public.app_settings
  for update using (auth.role() = 'authenticated');

-- School directory / document cache: read-only for signed-in users, all
-- writes happen through service-role edge functions.
create policy "school_directory_authenticated_select" on public.school_directory
  for select using (auth.role() = 'authenticated');
create policy "school_document_cache_authenticated_select" on public.school_document_cache
  for select using (auth.role() = 'authenticated');
