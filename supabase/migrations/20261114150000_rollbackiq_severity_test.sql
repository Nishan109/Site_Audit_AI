-- RollbackIQ severity test only. Keep this PR unmerged.
ALTER TABLE public.audit_reports
DROP COLUMN hostname;
