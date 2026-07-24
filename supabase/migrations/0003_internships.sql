-- Internship suggestions: personalized by career track, grade, interests, and journey.
create table public.internships (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  title text not null,
  organization text,
  description text not null,
  why_recommended text,
  application_url text,
  deadline text,
  grade_levels int[] not null default '{}',
  duration text,
  location text,
  track_name text,
  status text not null default 'New' check (status in ('New', 'Applied', 'Interviewing', 'Accepted', 'Rejected', 'Skipped')),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);
create index internships_user_email_idx on public.internships(user_email);

create trigger trg_internships_updated before update on public.internships
  for each row execute function public.set_updated_date();

alter table public.internships enable row level security;

create policy "internships_owner_select" on public.internships
  for select using (user_email = public.current_email());
create policy "internships_owner_insert" on public.internships
  for insert with check (user_email = public.current_email());
create policy "internships_owner_update" on public.internships
  for update using (user_email = public.current_email()) with check (user_email = public.current_email());
create policy "internships_owner_delete" on public.internships
  for delete using (user_email = public.current_email());
