-- Run once in the Supabase SQL Editor, BEFORE deploying the backend that uses external_id.
-- Nullable: webhook calls without an id keep working, and Postgres allows many NULLs
-- in a unique column. The unique constraint is the real dedupe guarantee; the backend's
-- lookup before the LLM call only avoids wasting a classification on a resend.
-- Existing rows get NULL. The existing RLS read policy already covers the new column.
alter table messages
  add column external_id text unique;
