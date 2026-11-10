# RLS Leads Demo

**Live:** https://demo-website-randel1.vercel.app

A live multi-user CRUD app where **Postgres row-level security decides what each signed-in user can see** — one table, one policy, zero filtering in the application code. Built to demonstrate database-level multi-tenancy on Supabase (Postgres) with React + TypeScript, deployed on Vercel.

## What this demonstrates

- **Row-level security in production use** — visibility is enforced by the database (`using (owner_id = auth.uid())`), not by queries. There is no filtering code in this app to audit, because there isn't any.
- **A real RLS policy** — `USING` gates reads/updates/deletes; `WITH CHECK` makes it impossible to insert a row owned by someone else, even with a tampered payload.
- **Public-key safety** — the Supabase anon key ships in the client bundle *by design*. It grants nothing on its own; RLS is the security layer. This is the correct mental model for client-side Postgres access.
- **Finished ≠ runs** — deployed URL, demo accounts, a 60-second verification script, and known-limitation notes below.

## Try it in 60 seconds

1. Open the live URL in **two separate browser windows** (one normal, one incognito).
2. Sign in as `userA@test.com` / `demo1234` in the first, `userB@test.com` / `demo1234` in the second.
3. Add a lead as A. Switch to B: **A's lead isn't there.** Add one as B, switch back to A: **B's lead never appears.** Delete only ever touches the signed-in user's own rows.
4. The signed-in email is always visible in the top-right chip, so you always know whose eyes you're looking through.

> Email confirmation is intentionally disabled for this demo so the two-user walkthrough doesn't stall on verification links. Don't ship that setting to a real product.

## The entire security model

```sql
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  note text,
  owner_id uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;

create policy "owners see and manage only their own leads"
  on public.leads
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
```

That is all of it. `owner_id` defaults to `auth.uid()` at the database level, and the client never sends it — so the server, not the client, decides row ownership.

> Plumbing note: PostgREST queries run as the `anon`/`authenticated` roles. Default privileges normally cover new tables, but if your project returns `permission denied for table leads`, grant explicitly: `grant all on table public.leads to anon, authenticated;` — already included in `supabase/migrations/0001_init.sql`.

**Database-level check (no app involved):** in the Supabase SQL editor, `select * from leads;` runs as a role with no user context and returns **0 rows**.

## Stack

React 19 + TypeScript + Vite · Supabase (Postgres, Auth, RLS) · Vercel. Hand-rolled CSS — no UI framework. No backend of its own: the browser talks to Postgres through Supabase, and RLS is what makes that safe.

## Run locally

```bash
cp .env.example .env.local   # fill in from Supabase → Project Settings → API
npm install
npm run dev
```

## Tests

Four tiers, all runnable without a single private secret — the anon key is public by design and the two demo accounts are published above.

| Tier | Command | What it proves |
| --- | --- | --- |
| Unit | `npm run test:unit` | Pure logic: the friendly-error mapping (every branch) and the time-ago clock boundaries. |
| Component | `npm run test:component` | The app's own code — rendering, forms, flows, the two-click delete — with `leadsRepository` mocked. Deliberately says nothing about the database. |
| Security | `npm run test:security` | **The real RLS matrix, automated**: two signed-in users plus an anon client against the live project. Isolation both directions, ownership defaulting to the JWT uid, tampered `owner_id` rejected (42501), cross-user delete a silent no-op. |
| E2E | `npm run test:e2e` | The 60-second walkthrough above as a Playwright test: two browser contexts (isolated storage), blind both ways, two-click deletes. |

- Live tiers (security, E2E) need the Supabase project awake — see Known limitations.
- E2E tests the **last `vercel --prod` deployment**, not the working tree; redeploy after UI changes before running it.
- `npm test` stays offline (unit + component); the live tiers are always explicit.
- `npm run typecheck` checks `src` + `tests` together (`tsconfig.test.json`) — the production build never sees test code.
- CI (`.github/workflows/tests.yml`) runs all four tiers on push/PR, plus a weekly cron that doubles as best-effort keep-warm for the project.

## Deployment

Hosted on **Vercel** (project `randel1/demo-website`) at https://demo-website-randel1.vercel.app.

- **CLI upload, not git-connected** — this folder has no remote; deploys ship the working directory. Redeploy after changes with:
  ```bash
  vercel --prod
  ```
  (one-time setup: `vercel login`, then `vercel link` in this folder).
- **Env vars** — `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in Vercel → Project Settings → Environment Variables (Production + Preview), stored as non-sensitive. Vercel refuses "sensitive" storage for `VITE_` variables since they ship in the client bundle by design.
- **Build-time injection** — Vite inlines `VITE_*` vars when the bundle compiles, so changing a value in the dashboard does nothing until the next deployment.
- **Deployment Protection disabled** — Vercel walls new projects behind an SSO login by default; turned off so reviewers can open the link directly.

## Known limitations (on purpose)

- Create + delete only — no editing, teams, roles, or admin view. Scope lives in `SPEC.md`.
- No realtime sync between the two browser windows; refresh to re-query.
- Supabase free tier pauses projects after ~1 week of inactivity — if the live link looks dead, that's why, and the project wakes with one click in the dashboard. A weekly GitHub Actions cron pings the project as best-effort keep-warm.

---

Built by **Randel Balcos** — full-stack developer (React/Next.js, Node.js, PostgreSQL). · randel.balcos@gmail.com
