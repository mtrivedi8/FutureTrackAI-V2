-- Anchors current_grade to the school year it was set for, so the app can
-- automatically advance a student's grade each year without them having to
-- manually update it.
alter table public.teen_profiles
  add column grade_year text;
