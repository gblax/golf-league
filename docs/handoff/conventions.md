# Conventions

Patterns as they are **actually used** in this codebase. When in doubt, match
the nearest existing code, not an external style guide.

## Language & tooling baseline

- **JavaScript + JSX only** — no TypeScript, no PropTypes. `type: "module"`.
- **No linter, no formatter, no JS tests, no pre-commit hooks.** The only
  automated checks are the Python unit tests and the Vite build itself.
- Indentation 2 spaces; single quotes dominate; semicolons used; trailing
  commas common in multiline literals.

## React

- **One container, dumb children.** `src/App.jsx` owns all state (68
  `useState`s), the Supabase client, every data loader and mutation handler.
  Tab/screen components under `src/components/` are presentational and
  receive everything via props — including setters and handlers. There is no
  Context, Redux, or react-query; **don't introduce them for a feature; follow
  the drilling pattern.**
- Components: function components declared as `const X = React.memo(function
  X({...}) {...})` for the big tabs, plain functions for small pieces.
  One component per file, **PascalCase.jsx**, default export at the bottom.
- Handlers in App.jsx are `handleVerbNoun` (`handleSubmitPick`,
  `handleCreateLeague`); booleans read as predicates (`showLogin`,
  `picksLoading`, `submittingPick`); memoized derivations via `useMemo`
  (`sortedStandings`, `availableForPick`, `liveIndex`).
- Utilities live in `src/utils/` as small pure modules (**camelCase.js**) with
  named exports; no classes anywhere.
- Data fetching: direct `supabase.from(...).select(...)` calls inside
  App.jsx loaders; destructure `{ data, error }`; treat `data ?? []`.
  Writes check `error` and toast; reads generally don't hard-fail.
- Optimistic UI after writes (pick submission) + a `preservePick` reconcile
  path, because the service worker can serve stale reads for ≤5 min.
- Navigation = URL hash only (`#picks|#standings|#schedule|#admin|#results`);
  update via `setActiveTab` which syncs `window.location.hash`.

## Styling

- Tailwind utility classes inline in JSX. **The palette is remapped** in
  `tailwind.config.js` ("clubhouse" theme): keep using `slate-*`, `emerald-*`,
  `amber-*` scale names — they render the custom colors. Don't hardcode hex.
- Repeated primitives are `@layer components` classes in `src/index.css`:
  `.card`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-lg`,
  `.btn-sm`, `.input`, `.badge`, `.label`, `.skeleton`, `.modal-overlay`,
  `.modal-panel`. Use these before composing new utility strings.
- **Dark mode is class-based** (`darkMode: 'class'`, toggled on
  `document.documentElement`, persisted in `localStorage.darkMode`). Every
  new element needs `dark:` variants — the app is fully dual-theme.
- Mobile-first: base styles are phone; `sm:` and up for desktop. Patterns in
  active use: `100dvh` min-height, `env(safe-area-inset-*)` padding, 16px
  (`text-base`) inputs on mobile to prevent iOS zoom, `tabular-nums` for
  money/scores, `active:scale-95` press feedback, keyboard-accessible
  comboboxes with ARIA roles (see PicksTab).
- Fonts: Inter body (`font-sans`), Fraunces display (`font-display`) for
  headings/numerals.
- Money: `formatWinnings()` (`src/utils/money.js`) for player winnings,
  `formatPrizePool()` (App.jsx) for purses with `'TBA'` fallback.
- Player identity colors come from `buildPlayerColors()`
  (`src/utils/playerColors.js`) keyed by member id — reuse it anywhere a
  member needs a color so identities stay consistent across surfaces.

## Error handling & user feedback

- Map raw errors to safe copy with `friendlyError(error, fallback)`
  (`src/utils/errors.js`); it logs the raw error to console. Add new
  message mappings there, not inline.
- Surface outcomes with `showNotification('success'|'error', msg)` — the
  single toast (4s auto-dismiss, one at a time). No alert()/confirm();
  confirmation uses themed modal dialogs (see mark-complete flow).
- `ErrorBoundary` wraps the app (class component, reload button).
- Empty states use the `EmptyState` component rather than bare text.

## Comments

- Comments explain **why**, often at paragraph length, and record history
  ("this replaced X because Y bit us"). Notable decisions get block comments
  at the top of the relevant function/module. Match that: when you change
  behavior for a non-obvious reason, say what broke.

## Python (`scripts/`)

- Module docstring at top explaining the job's role, invariants, and usage;
  section-divider comments (`# ---- … ----`).
- **Dry-run by default; `--apply` to write; `--force` to bypass gates.**
  Argument parsing is plain `sys.argv` membership checks — keep that, don't
  add argparse for consistency.
- Logging = `print()` with banner lines (`"=" * 50`) and loud multi-line
  `"!" * 60` blocks for refusals. Scheduled jobs signal failure by **exit
  code**, not exceptions.
- Heavy imports (`supabase`, `pywebpush`) are **lazy** (inside functions) so
  modules import cleanly for offline unit tests.
- Pure parsing/matching logic lives in `slashgolf.py` (no DB, no env);
  orchestration in the job scripts; shared plumbing in `golf_common.py`.
- Tests: `unittest`, colocated `test_*.py`, fixtures inline as dicts trimmed
  to the fields the parser reads. Run:
  `cd scripts && python -m unittest discover -s . -p 'test_*.py' -v`.
- Dependencies pinned exactly in `scripts/requirements.txt` with a comment
  explaining each pin (keep `supabase`/`postgrest` in lockstep).
- Keep `normalize_name()` (Python) and `normalizeName()` (JS,
  `src/utils/liveLeaderboard.js`) **behaviorally identical** — both sides of
  the pick↔leaderboard join depend on it.

## SQL / schema changes

- Idempotent scripts: `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` /
  `DROP POLICY IF EXISTS` before `CREATE POLICY`; end with
  `NOTIFY pgrst, 'reload schema';` when PostgREST-visible.
- Header comment: what it does, why, whether/when it was applied to the live
  project (see `scripts/add-tee-timezone.sql` for the model).
- Apply via Supabase SQL editor or a tracked migration; **commit the script
  to `scripts/` as the record either way.**

## Git & workflow

- Commit subjects: imperative, sentence case, no prefix conventions
  ("Stop pick reminders from firing late and at night"). Bodies explain why
  when non-obvious.
- Default branch `main` = production (Vercel). Historical flow pushed
  `claude/**` branches which auto-merge to main
  (`.github/workflows/auto-merge.yml`) — if you are not using that prefix
  deliberately, branch normally and PR into main.
- GitHub Actions workflow files carry unusually thorough comments about cron
  timing rationale — preserve and extend that habit when touching schedules.
