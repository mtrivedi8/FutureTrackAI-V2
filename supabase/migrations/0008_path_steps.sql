-- Structured, dated roadmap for "Path to Get In" (replaces a flat paragraph
-- with a step-by-step timeline from now through the application deadline).
alter table public.internships
  add column path_steps jsonb;
