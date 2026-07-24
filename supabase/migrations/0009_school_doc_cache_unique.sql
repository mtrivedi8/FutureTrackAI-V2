-- Two writers (discoverSchoolDocuments and generateAcademicPlan's course-fetch
-- step) can race on the same school_name+zipcode when the discovery call is
-- still running after its caller's timeout fallback fires, each doing an
-- independent select-then-insert and producing duplicate rows - one holding
-- document_urls, the other holding cached_data, neither complete. A unique
-- constraint plus upsert(onConflict) makes concurrent writes converge on one
-- row instead of forking.
delete from public.school_document_cache a
using public.school_document_cache b
where a.id > b.id
  and a.school_name = b.school_name
  and a.zipcode = b.zipcode;

alter table public.school_document_cache
  add constraint school_document_cache_school_zip_key unique (school_name, zipcode);
