# SPEC — RLS Demo (multi-user CRUD with Postgres row-level security)

> One-page demo, one day, one point: **I can build multi-user business software where the database itself enforces who sees what.**
> This file is the contract — for me and for any AI tool I work with. Nothing ships that isn't in this spec. Nothing outside "Out of scope" gets built, no matter how good the idea feels mid-build.

---

## What it proves (the only reason it exists)

1. **React** — a working CRUD app, deployed and clickable by a stranger.
2. **Postgres / Supabase hands-on** — schema, auth, and a real RLS policy (my first Supabase build; before this I could only say "same shape as Firebase").
3. **Security thinking** — the anon key is public *by design*; RLS is the protection.
4. **Shipping discipline** — live URL, README, 60-second demo script. Finished ≠ runs.

## Stack (fixed — no debates mid-build)

| Layer           | Choice                                                                          | Why                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Frontend        | **Vite + React + TypeScript** (`npm create vite@latest -- --template react-ts`) | Small surface; TS closes a real gap. If TS friction threatens the schedule at midday, drop to JS — shipping beats typing. |
| DB + Auth + RLS | **Supabase** (free tier)                                                        | RLS is a Postgres feature. Firebase cannot do this demo.                                                                  |
| Hosting         | **Vercel** (Hobby, free)                                                        | Zero-config for Vite; free; no card.                                                                                      |
| Firebase        | **None.**                                                                       | It's already proven by homes.teepid.com. This demo proves the thing Firebase can't.                                       |


## Schema (run this in the Supabase SQL editor)

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

One table. One policy. The policy IS the demo.

## Auth settings (do this once, honestly)

- Supabase Auth: **email + password**.
- Turn **OFF** "Confirm email" for this demo (free tier allows it) — otherwise the two-user demo stalls on email verification. Say so in the README ("email confirmation disabled for demo speed").
- Create two test users: `userA@test.com` / `userB@test.com`.

## UI (three things, no more)

1. **Sign in / sign up** — Supabase Auth, email + password.
2. **Leads list + add form + delete** — exactly the rows RLS returns. A line at top: **"Signed in as userA@test.com"** — the demo doesn't work without it visible.
3. **One-line explainer on the page** for cold visitors, e.g.:
   *"Demo: multi-user CRUD where Postgres row-level security decides what each signed-in user can see. Sign in as two users in two browsers — each sees only their own rows."*

`<title>` must be set. Cold visitor understands the page in 5 seconds without logging in? No — they understand it's a demo and what it demonstrates. That's enough.

## The money shot (60 seconds, rehearsed)

1. Browser 1: sign in as A → add "Lead from A" → visible.
2. Browser 2 (incognito): sign in as B → **A's lead is NOT there**. Add "Lead from B".
3. Back in browser 1: B's lead never appears. Two users, one table, zero application-level filtering code — the database did it.

Plus one SQL-editor check (the part a technical interviewer respects):
`select * from leads;` as `anon` → **0 rows**. As an authenticated user's context → only their own. Screenshot both for the README.

## Definition of done (checklist — all boxes or it isn't done)

- [ ] Live Vercel URL loads warm in <3s (Hobby tier default `*.vercel.app` is fine)
- [ ] `<title>` set; explainer line visible
- [ ] Sign up + sign in + sign out work for both test users
- [ ] **RLS matrix verified by hand:** A sees only A's, B sees only B's, delete only touches own rows
- [ ] SQL check: `anon` sees 0 rows
- [ ] `with check` proven: insert always lands with the signed-in user as owner (B cannot insert a row owned by A — even by tampering the payload)
- [ ] README: what it proves, the policy SQL, the 60-second walkthrough, stack, "email confirmation off for demo"
- [ ] Deployed **early** (step 2 of build order) — the URL exists before the features do

## Build order (each step = one small AI-agent run, verified before the next)

1. **Supabase setup:** create project (Sydney), run the schema SQL, auth settings, create test users. Verify rows/policy exist in the dashboard.
2. **Vite scaffold + Supabase client + env vars → deploy the empty shell to Vercel.** Confirm the URL 200s. (Deploy-first: every later step is a push, never a big-bang launch.)
3. **Auth screens:** sign up / in / out + "Signed in as" line. Verify both users.
4. **CRUD:** list, add, delete. Verify list returns only own rows (RLS is already on — the client code does NO filtering; assert that in a comment).
5. **Verify the matrix** (money shot + SQL checks). Fix what fails. This step is allowed to take as long as it takes.
6. **README + title + explainer → final deploy → open the URL in incognito as a stranger would.**

## Out of scope (the list that keeps this at one day)

No editing (create + delete only) · no teams/roles/invites/admin view · no Tailwind (hand-rolled design system instead) · no pagination, search, or sorting · no extra tables or columns (status field included) · no email confirmation flows · no custom domain · no CI · no Supabase codegen types · no unit-test framework — **the RLS matrix and SQL checks ARE the test suite for this artifact, and they're run by hand, personally.** *(Owner decision 2026-09-27: polish level upgraded from "clean-and-readable" to "beautiful and presentable" — the target JD explicitly scores front-end design sense. Presentation only; the feature scope above does not move.)*
