-- How a student actually gets into and applies to a program: whether it's
-- paid enrollment vs. merit-based selection, and whether the right next
-- step is a formal online application, an outreach email, or both.
alter table public.internships
  add column admission_model text,
  add column application_method text;
