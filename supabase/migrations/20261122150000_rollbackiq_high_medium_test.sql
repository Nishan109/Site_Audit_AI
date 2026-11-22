-- QA ONLY: High and Medium severity test.
-- Do not merge or execute against a database.

ALTER TABLE public.audit_reports
  ALTER COLUMN hostname TYPE varchar(120);

ALTER TABLE public.audit_reports
  ADD CONSTRAINT rollbackiq_hostname_length_qa
  CHECK (char_length(hostname) <= 120);
