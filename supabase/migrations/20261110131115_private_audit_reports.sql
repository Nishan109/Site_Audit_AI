create table public.audit_reports (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  audited_url text not null check (char_length(audited_url) between 1 and 2048),
  hostname text not null check (char_length(hostname) between 1 and 253),
  analyzed_at timestamptz not null,
  created_at timestamptz not null default now(),
  schema_version integer not null default 1 check (schema_version = 1),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  constraint snapshot_identity check (snapshot->>'analysisId' = id::text and snapshot->>'url' = audited_url),
  constraint snapshot_size check (octet_length(snapshot::text) <= 8388608)
);

create index audit_reports_owner_date_idx on public.audit_reports (owner_id, analyzed_at desc, id desc);
alter table public.audit_reports enable row level security;
revoke all on public.audit_reports from public, anon, authenticated, service_role;
grant select, delete on public.audit_reports to authenticated;
grant select, insert on public.audit_reports to service_role;

create policy "Owners read their audit reports" on public.audit_reports
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Owners delete their audit reports" on public.audit_reports
  for delete to authenticated using ((select auth.uid()) = owner_id);

comment on table public.audit_reports is 'Immutable completed audit snapshots. Only the verified application server inserts reports.';
