-- Temporary RollbackIQ scanner fixture. Do not merge or apply.
CREATE TABLE IF NOT EXISTS public.rollbackiq_webhook_qa (
  id bigint PRIMARY KEY
);
ALTER TABLE public.rollbackiq_webhook_qa ENABLE ROW LEVEL SECURITY;
-- Verify automatic GitHub delivery to the deployed RollbackIQ webhook.
-- RollbackIQ Phase 2 verification: rescan existing QA fixture.
-- RollbackIQ Phase 2.5 verification: trigger one production worker scan.
