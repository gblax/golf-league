# Environment & local development

Every environment variable by **name and purpose only** — never put values in
this repo. Where each one lives, then local setup steps.

## Frontend (Vite build-time, `import.meta.env.*`)

Set in **Vercel → Project golf-league → Settings → Environment Variables**
(for deploys) and in a local **`.env` at the repo root** (gitignored) for
`npm run dev`.

| Name | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (`https://<ref>.supabase.co`) — the browser's API endpoint |
| `VITE_SUPABASE_ANON_KEY` | Supabase **anon/publishable** key. Safe-by-design to ship to browsers; RLS is the guard |
| `VITE_VAPID_PUBLIC_KEY` | Web-push VAPID **public** key (base64url). Must be the public half of the SAME key pair as the backend's `VAPID_PRIVATE_KEY`, or subscriptions created in the app can't be delivered to |

Notes:
- `VITE_*` vars are baked in at build time — changing them in Vercel requires
  a redeploy.
- If `VITE_VAPID_PUBLIC_KEY` is missing the app still builds/runs; enabling
  notifications shows "Push notifications not configured".
- **Never** create a `VITE_`-prefixed variable holding a privileged secret;
  anything `VITE_*` ends up in the public JS bundle.

## Backend scripts (GitHub Actions secrets + local `scripts/.env`)

Set in **GitHub → repo Settings → Secrets and variables → Actions** (used by
the workflows) and in **`scripts/.env`** (gitignored; loaded by
`python-dotenv`) for local runs. `scripts/.env.example` shows the shape.

| Name | Purpose | Used by |
|---|---|---|
| `SUPABASE_URL` | Same project URL as above | all scripts |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **service-role** key — full DB access, bypasses RLS. Server-side only, never in the frontend | all scripts |
| `SUPABASE_SERVICE_KEY` | Alias for the same value — the workflows pass both names; `golf_common.py` accepts either | all scripts |
| `RAPIDAPI_KEY` | RapidAPI key subscribed to Slash Golf "Live Golf Data" | sync_schedule, sync_field, update_leaderboard, update_results |
| `X_RAPIDAPI_KEY` | Accepted alias for `RAPIDAPI_KEY` (env fallback in `slashgolf.py`) | same |
| `RAPIDAPI_HOST` | Optional; defaults to `live-golf-data.p.rapidapi.com` | same |
| `ORG_ID` | Optional; Slash Golf organization, defaults to `"1"` (PGA Tour) | same |
| `VAPID_PUBLIC_KEY` | Web-push VAPID public key (same pair as the frontend's) | update_results, send_reminders, send_notification |
| `VAPID_PRIVATE_KEY` | Web-push VAPID **private** key | same |
| `VAPID_SUBJECT` | VAPID contact claim, `mailto:` URI (defaults to a placeholder if unset) | same |

GitHub Actions secrets currently referenced by workflows: `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `RAPIDAPI_KEY`, `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

## Where to find / (re)provision the values

- Supabase URL + anon key + service-role key: Supabase Dashboard → project
  `tdmnufmlemfszaaegczp` → Settings → API.
- RapidAPI key: RapidAPI account → subscribed app for "Live Golf Data".
- VAPID pair: generated once (e.g. `npx web-push generate-vapid-keys` or
  `pywebpush`'s `vapid` tool). If you rotate it, update **three** places
  together: Vercel (`VITE_VAPID_PUBLIC_KEY`), GitHub secrets (both VAPID
  keys), and expect existing browser subscriptions to be invalidated.

## Local development setup

Frontend:

```bash
# Node 18+ (verified on 22; Vercel builds with 24)
npm install
printf 'VITE_SUPABASE_URL=...\nVITE_SUPABASE_ANON_KEY=...\nVITE_VAPID_PUBLIC_KEY=...\n' > .env
npm run dev            # http://localhost:5173
npm run build && npm run preview   # exercise the real PWA build
```

- Local dev talks to the **production** database (there is no staging
  Supabase project). Log in with a real league account; anything you write
  is real. Prefer read-only poking or a throwaway account.
- Service-worker behavior (caching, push) only fully manifests in the built
  app (`npm run preview`) or the deployed site, not the dev server.

Backend scripts:

```bash
# Python 3.11
pip install -r scripts/requirements.txt
# If the http-ece/pywebpush wheel fails to build (needs a C toolchain) and you
# don't need to send pushes locally:
pip install requests python-dotenv supabase==2.31.0 postgrest==2.31.0

cp scripts/.env.example scripts/.env   # then fill in values
cd scripts
python update_results.py       # DRY RUN by default — safe
python sync_schedule.py        # dry-run mapping report
python update_leaderboard.py   # dry-run snapshot preview
# add --apply only when you mean to write to the production DB
```

Tests (no credentials, no network, no heavy deps needed):

```bash
pip install requests python-dotenv
cd scripts && python -m unittest discover -s . -p 'test_*.py' -v   # 67 tests
```

## Environment matrix (summary)

| Variable | Vercel | Local `.env` (root) | GitHub secrets | Local `scripts/.env` |
|---|---|---|---|---|
| VITE_SUPABASE_URL | ✅ | ✅ | — | — |
| VITE_SUPABASE_ANON_KEY | ✅ | ✅ | — | — |
| VITE_VAPID_PUBLIC_KEY | ✅ | ✅ | — | — |
| SUPABASE_URL | — | — | ✅ | ✅ |
| SUPABASE_SERVICE_ROLE_KEY | — | — | ✅ | ✅ |
| RAPIDAPI_KEY | — | — | ✅ | ✅ |
| VAPID_PUBLIC_KEY | — | — | ✅ | (if sending pushes) |
| VAPID_PRIVATE_KEY | — | — | ✅ | (if sending pushes) |
| VAPID_SUBJECT | — | — | ✅ | (if sending pushes) |
