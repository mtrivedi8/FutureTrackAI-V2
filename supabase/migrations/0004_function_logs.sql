-- App-level log trail for edge functions, so admins can see what happened
-- without needing the Supabase dashboard's raw platform logs.
create table public.function_logs (
  id uuid primary key default gen_random_uuid(),
  function_name text not null,
  level text not null default 'info' check (level in ('info', 'warn', 'error')),
  message text not null,
  detail jsonb,
  user_email text,
  created_date timestamptz not null default now()
);
create index function_logs_created_date_idx on public.function_logs(created_date desc);
create index function_logs_function_name_idx on public.function_logs(function_name);

alter table public.function_logs enable row level security;

-- Only admins can read logs from the client. Writes only ever happen from
-- edge functions via the service-role key, which bypasses RLS entirely.
create policy "function_logs_admin_select" on public.function_logs
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
