# Gym Log — notes for Claude

Personal calisthenics workout tracker: Vite + React 19 + TypeScript (strict), data in `localStorage` (key `gym-data`), offline PWA, deployed to GitHub Pages (https://calinjah.github.io/Gym-log/). The user trains calisthenics (bar, dip bars, rings, bands), logs in kg, and uses the app from the iPhone Home Screen. The README lists the features.

## How the user wants us to work

- Simple beats complex; no fallbacks; one way to do things; clarity over compatibility; fail fast (throw) when preconditions aren't met; single responsibility; surgical changes; fix root causes; let TypeScript catch errors.
- **Detective method for bugs:** state the theory, collect evidence (reproduce it, minimal targeted logging), and only fix once the evidence proves it.
- Every fix or feature gets a test that fails before the change and passes after (check by temporarily reverting).
- Big changes or product decisions: present options with a recommendation and ask first. Be honest about limits and about anything not verified on a real iPhone.
- Explain results to the user in plain language (they are not a developer).

## Workflow

- Repo `calinjah/Gym-log` (renamed from My-Project; a new session may need it attached with `add_repo`, cloned to `/home/user/gym-log`).
- Develop on `claude/gym-workout-tracker-app-3xzvs0`; push to that branch **and** `main` (`git push origin claude/gym-workout-tracker-app-3xzvs0:main`). `main` runs "Test and deploy" (lint, typecheck, unit, e2e, then Pages). Check the run succeeded (GitHub MCP `actions_list`, owner `calinjah`, repo `Gym-log`) before saying something is live.
- Before pushing: `npm run lint`, `npx tsc -b`, `npm test`, `npx playwright test` (and `npx tsc -p tsconfig.e2e.json --noEmit` for e2e changes).
- "This repository moved" on push is harmless.
- Commit messages: explain the why; end with the attribution lines from the session's system reminder.

## Gotchas we've hit

- **No Prettier config:** running Prettier rewrites whole files (double quotes, short lines). Match the house style by hand.
- Playwright wipes `test-results/` every run: save screenshots to the scratchpad.
- e2e uses `page.clock.install` (time still flows; `runFor` jumps). A jump past a deadline also jumps `Date.now()` for code measuring elapsed time: fast-forward to just before, let it end in real time.
- The seeded test RNG (`seed * 16807 % 2^31-1`) gives near-identical first values for small consecutive seeds: spread seeds out (e.g. `i * 104_729 + 17`) when a test needs variety.
- An unused import fails `tsc -b`, which is part of the build the e2e web server runs: e2e then fails to start.
- This environment can't fetch `*.github.io` (proxy 403): verify deploys via the Actions run.
- Fixture `test` in `e2e/helpers.ts` fails on page errors; tests needing to observe crashes use `@playwright/test` directly.

## Data model

- `src/types.ts` `Data` is versioned (currently **21**). To change it: bump the version, add a step in `parseData` (`src/store.ts`), update `src/validate.ts` (full check of every field and reference), `src/test/fixtures.ts`, `e2e/helpers.ts` `appData`, the version assertions in tests, and add a migration test.
- `validateData` runs on import **and** on every app start; `RecoveryScreen` (error boundary) offers download/try again/reset if anything crashes.

## Decisions (and why)

- **iPhone audio:** `navigator.audioSession.type = 'ambient'` so Spotify keeps playing; beeps never queue on paused audio — resume first, drop the beep if it can't restart within 1 s (otherwise it played late on the next tap). Safari on iPhone has no vibration.
- Only **generated** plans (`dayType !== null`) auto-progress and deload; the user's own plans never change.
- Generator: daily undulating periodisation; ~14 hard sets per muscle group per week (research: 10–20); time limit is a cap, trimmed evenly (sets 4→3 before dropping exercises); rests 150/90/60 s; effort targets (reps in reserve); deload every 5th programme week (half the sets); ramp-up set on strength days; warm-ups and stretches chosen from the session's movements.
- **Minimal style:** A (vertical pull + push, squat/lunge) and B (horizontal pull + push, hinge). Plans repeat weekly, so with 3 days it's A, B, A every week (no week-to-week alternation).
- **Prefer rings:** restrict to ring exercises only when one is as close to the target level as anything available.
- Levels: history (last 8 weeks, or since the starting test if newer) → starting test → level setting. Starting test: 6–11 reps = the exercise's own difficulty, 12–19 +1, 20+ +2, 1–5 −1, 0 −2.
- Skill paths are named after their final step (derived, never typed). Next step at 12 reps, or a per-step hold time (`HOLD_TARGETS`: 60 s basics, 10–15 s levers and planches, from coaching guides; user chose this over a flat 20 s); a step logged only at 0 is attempted, not reached (user decision).
- **Past days are pinned:** repeats only compute today onwards; `pinPastDays` (on start and when the app returns from the background) saves each passed day's repeating plan into `schedule`, tracked by `pinnedThrough` (null = never: the last 7 days). A past planned day with no workout logged is `missed` (red ring). Deleting a plan (e.g. regenerating a programme) moves its past days to `pastPlanNames` (day → name, shown as "(deleted plan)"); upcoming days just lose it. A day is never in both `schedule` and `pastPlanNames`.
- Generated plans store section labels (`SECTION`: Warm-up, Skill, Ramp-up, Core, Stretch) in entry `notes`; they are not user notes.

## Known limitations (not fixed, by decision)

- Weights first logged in lb shift by 0.1 lb after a kg round trip (would need storing kg internally). The user logs in kg.
- Equipment is "any of": an exercise can't require two items (e.g. band-assisted pull-up on rings assumes a band).
- Negative reps/rest are accepted if pasted (iPhone number pad has no minus).

## Ideas offered, not built

How-to tips per exercise; effort (RIR) per set used by progression; workout summary on finish; weekly muscle-balance view; set types (warm-up/failure/drop); CSV export; linking skill paths to the generator's skill block; a native App Store build (Capacitor; needs a Mac and the $99/yr developer programme) mainly for a reliable lock-screen rest alert.

## Daily check

A scheduled task ("Gym-log daily app check", weekdays 09:55 Europe/London) runs a baseline plus 2–3 new exploratory areas, fixes quick low-risk bugs, and reports major ones for a decision. Areas already covered: odd numeric inputs; damaged backup imports; a year of history (performance); kg↔lb round trips; DST and midnight; accessibility names (now a permanent test); generator combinations (equipment × level × length × style × days); calendar month boundaries 2024–2032 across time zones; long and emoji names on a 320px screen; the starting test; the hold timer (with swaps, ticks, reloads); skill paths. Pick new areas next.
