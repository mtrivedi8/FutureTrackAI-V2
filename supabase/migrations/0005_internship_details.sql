-- Richer internship data: eligibility, selectivity, a scraped contact email
-- for cold outreach, guidance on how to get in, and the target application
-- season/cycle this suggestion was generated for.
alter table public.internships
  add column eligibility text,
  add column selectivity text,
  add column contact_email text,
  add column path_to_get_in text,
  add column season text;
