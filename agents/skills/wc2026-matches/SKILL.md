---
name: wc2026-matches
description: Pull FIFA World Cup 2026 fixtures from FIFA.com, filter by a single team the user picks, save the result as JSON, and open a draft PR into cal.diy that surfaces those matches in the calendar. Use this skill whenever the user mentions World Cup 2026, WC2026, FIFA fixtures, "soccer/football schedule on the calendar", or any variation of "add my team's matches to the cal.diy calendar" — even if they don't say "skill" or name the data source.
---

# WC2026 matches → cal.diy calendar

This skill turns "show me Brazil's World Cup games on the calendar" into a small, reviewable PR. It's intentionally narrow: one team at a time, one JSON file, one PR.

## When you trigger

You trigger when the user asks anything along these lines:
- "Add [team]'s World Cup 2026 matches to the calendar"
- "Pull WC2026 fixtures for Argentina"
- "I want to see USA's games in cal.diy"
- "Generate a JSON of [team]'s FIFA 2026 schedule"

If the team is missing, **ask**. Don't guess and don't default to a popular team — the user picking explicitly is part of the workflow.

## Workflow

Do these in order. Each step has a single owner — don't blur them.

### 1. Get the team

Ask the user which team to filter by. Accept either the full name ("Brazil", "Korea Republic") or the 3-letter FIFA code ("BRA", "KOR"). If the answer is ambiguous (e.g., "Korea" — there are two), ask which one.

### 2. Fetch + filter

Run the bundled script. It hits FIFA's public match calendar API, normalizes the response, filters by the team, and writes a JSON array sorted by `dateUtc`.

```bash
python .claude/skills/wc2026-matches/scripts/fetch_matches.py \
  --team "<team>" \
  --out apps/web/public/wc2026/<team-slug>-matches.json
```

If the FIFA API is unreachable (firewall, rate limit, you're offline), fall back to the canonical file already in the repo:

```bash
python .claude/skills/wc2026-matches/scripts/fetch_matches.py \
  --team "<team>" \
  --source wc2026-matches.json \
  --out apps/web/public/wc2026/<team-slug>-matches.json
```

The output shape (don't change it without a reason — the renderer depends on it):

```json
[
  {
    "matchId": "400021443",
    "stage": "First Stage",
    "group": "Group A",
    "dateUtc": "2026-06-11T19:00:00Z",
    "dateLocal": "2026-06-11T13:00:00Z",
    "home": { "name": "Mexico", "code": "MEX", "country": "MEX" },
    "away": { "name": "South Africa", "code": "RSA", "country": "RSA" },
    "venue": { "stadium": "Mexico City Stadium", "city": "Mexico City", "country": "MEX" }
  }
]
```

Sanity-check the count before moving on. A group-stage team should have 3 matches; deeper runs add knockout rounds. If you got 0, the team name didn't match — ask again with the suggestions the script prints.

### 3. Render in the calendar + open the PR

This is a cal.diy repo (Next.js App Router, Yarn/Turbo monorepo — see `CLAUDE.md`). Keep the PR small and self-contained:

- **Branch**: `feat/wc2026-<team-slug>-matches` off `main`
- **Files changed** (target ≤5):
  - `apps/web/public/wc2026/<team-slug>-matches.json` — the JSON you just wrote
  - `apps/web/app/wc2026/[team]/page.tsx` — a server component that imports the JSON for that team slug and renders it as a date-grouped calendar list. Use `date-fns` (not Day.js) since these are fixed UTC timestamps, no timezone gymnastics needed. Put each match's kickoff (local + UTC), stage/group, both flags or 3-letter codes, and the venue on one row.
  - Add the page's UI strings to `packages/i18n/locales/en/common.json` (e.g. `wc2026_title`, `wc2026_stage`, `wc2026_venue`) — per `CLAUDE.md` all UI strings go through translations.
- **No new dependencies.** date-fns is already in the repo.
- **No tRPC / DB changes.** This is a static, read-only page; the JSON ships as a public asset.

PR conventions (these come straight from `CLAUDE.md` — follow them):

- Title: `feat(wc2026): add <Team> match calendar`
- Draft by default
- Conventional commit message
- Before pushing, run:
  ```bash
  yarn type-check:ci --force
  yarn biome check --write apps/web/app/wc2026 apps/web/public/wc2026 packages/i18n
  ```
- PR body: short summary, screenshot or ASCII of the page, link to the team's matches JSON, note that data was sourced from FIFA's public match calendar API.

Open it with `gh pr create --draft`. Confirm with the user before running `gh` if they haven't pre-approved external-visible actions in this session.

## What this skill is *not*

- Not a generic sports-data scraper. WC2026 only.
- Not a multi-team aggregator. One team per run keeps PRs reviewable and the JSON cacheable.
- Not a booking/event-type integration. Hooking matches into cal.diy's scheduling primitives is a separate, bigger piece of work — don't sneak it in here.

## If FIFA changes the API

`scripts/fetch_matches.py` has a `normalize()` function that maps FIFA's response into the slim shape above. If FIFA changes their payload, that's the only place to edit. The `--source` flag also lets the script consume an already-normalized local JSON, so you can always unblock the workflow by hand-curating a file and pointing the script at it.
