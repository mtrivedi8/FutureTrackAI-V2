-- Nightly rotation job for the school directory / document cache
-- (replaces base44's "overnight agent" that called nightlyZipRefresh).
--
-- This does NOT hardcode any secret. It reads your project URL and
-- service-role key from Supabase Vault, so nothing sensitive lives in
-- version control. Before this job can run, set the two secrets once
-- from the SQL editor (or `supabase secrets`/`vault` CLI):
--
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service-role-key>', 'service_role_key');
--
-- Then apply this migration (or paste it into the SQL editor). It schedules
-- nightlyZipRefresh to run once every night at 03:00 UTC.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select
  cron.schedule(
    'nightly-zip-refresh',
    '0 3 * * *',
    $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/nightlyZipRefresh',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
      ),
      body := '{}'::jsonb
    );
    $$
  )
where exists (select 1 from vault.decrypted_secrets where name = 'project_url')
  and exists (select 1 from vault.decrypted_secrets where name = 'service_role_key');
