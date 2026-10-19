-- Run once in the Supabase SQL Editor, BEFORE deploying the backend or frontend that use `source`.
-- Existing rows become 'webhook'. The existing RLS read policy already covers the new column.
alter table messages
  add column source text not null default 'webhook'
    check (source in ('webhook', 'gmail'));
