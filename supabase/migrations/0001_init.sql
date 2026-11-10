-- 0001_init.sql — the entire schema for the RLS Leads Demo.
--
-- One table, one policy. Applied by pasting this file into the Supabase
-- dashboard SQL editor (Project → SQL Editor → New query). Kept in the
-- repo so the schema is versioned with the code it protects.

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  note text,
  -- Defaults to the JWT's user id at the database level. The client never
  -- sends it — the server decides row ownership.
  owner_id uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

-- The point of the whole demo: visibility and writes are gated by the
-- database, not by application code.
alter table public.leads enable row level security;

create policy "owners see and manage only their own leads"
  on public.leads
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Belt-and-braces: PostgREST queries run as the anon/authenticated roles.
-- Fresh Supabase projects normally grant table access via default
-- privileges, but some never apply them to tables created in the SQL editor
-- ("permission denied for table leads"). Granting explicitly is harmless and
-- deterministic — RLS still decides which rows these roles can touch.
grant usage on schema public to anon, authenticated;
grant all on table public.leads to anon, authenticated;
