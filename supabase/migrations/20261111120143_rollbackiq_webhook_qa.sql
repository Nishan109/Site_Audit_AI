-- Temporary RollbackIQ scanner fixture. Do not merge or apply.
CREATE TABLE IF NOT EXISTS public.rollbackiq_webhook_qa (
  id bigint PRIMARY KEY
);
ALTER TABLE public.rollbackiq_webhook_qa ENABLE ROW LEVEL SECURITY;
