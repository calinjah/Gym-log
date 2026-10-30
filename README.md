# Gym Log

A personal workout tracker that runs in the browser (phone or desktop). No account, no server: your data lives in the browser's local storage on your device.

## Features

- **Log workouts**: start a workout, add exercises, and add as many sets as you like, each with its own weight and reps (or seconds for holds such as planks or L-sits).
- **Tick off sets**: during a workout, tick each set as you finish it. If you finish with unticked sets, you choose whether to save them or leave them out.
- **Supersets & circuits**: tap **+ Link as superset** between two exercises to group them (labelled A1, A2…); linking a third makes it a **circuit**. Ticking a set in a superset skips the rest so you go straight to the next exercise; the rest starts after the last one.
- **Rest timer**: ticking a set starts a countdown (rest time set per exercise, default 90 s) with −15/+15/Skip, and beeps when it ends. The beep volume is adjustable in Settings, with a *Test beep* button.
- **Works offline**: after the first visit the app is stored on the device, so it opens without signal. Updates download in the background and apply the next time it opens.
- **Weekly programme generator** (Workout tab → *Generate a weekly programme*): pick 2–4 training days, 45 or 60 minutes, your level and equipment. Rules-based, offline:
  - The week mixes goals (undulating periodisation): **Strength** (4×5, harder variations, skill block first), **Muscle** (3×10 push/pull supersets) and **Endurance** (short circuits of 3 exercises, 15 reps / 45 s holds). 2 days = Strength + Muscle full body; 3 days adds Endurance; 4 days = upper/lower split.
  - Every session: warm-up for the joints that session uses → (strength days) skill practice → balanced main work (vertical/horizontal push and pull, squat, hinge, lunge) → core finisher → stretches for the muscles worked.
  - **Minimal style** (*Programme style → Minimal: 3 exercises*): two workouts that alternate through your days (A, B, A for three days), each a pull and a push as a superset, then legs. A is vertical (pull-up family, dips or pike push-ups) with a squat or lunge; B is horizontal (rows, push-ups) with a hip hinge, so together they cover the whole body. 3 × 10 muscle-building sets, a short warm-up, a ramp-up set and stretches: about 25–35 minutes. Progression, deloads, history and the starting test all apply.
  - **Prefer rings**: with rings ticked, the generator uses the ring version of a movement when one is as close to your level as any other (never one further away). Pull-up variations can be done on bar or rings.
  - **Trainer-style volume and rest**: each muscle group (push, pull, legs, hips) gets about 14 hard sets a week (research supports 10–20), spread over the days that train it. The session length is a limit, not a target: sessions end early once the volume is done; if time is short, every exercise loses a set (4 → 3) before any is dropped. Rest is 2½ min on strength days, 90 s on muscle days and 60 s in endurance circuits. Each day shows an effort target (e.g. stop 2–3 reps short of failure on strength days), also during the workout.
  - **Ramp-up set** (strength days): right before the first heavy superset, one set of an easier variation of each of its exercises (e.g. Chin-up before Wide-grip Pull-up). Ramp-ups never progress.
  - **Starting test**: instead of guessing your level, do one max-effort set of pull-ups, dips, push-ups, Bulgarian split squats, single-leg glute bridges and a hollow hold (only those your equipment allows; skip any). Each result sets the difficulty for its movements: 6–11 reps (15–29 s) means that exercise's own difficulty, 12–19 one step above, 20+ two above, 1–5 one below, 0 two below. Your workouts logged after the test take over; the level setting only covers movements with neither.
  - **Deload week**: every 5th week after saving a programme, its days start with about half the sets (same exercises and reps) and an easier effort target, marked *deload week* on the Workout tab. The plans themselves don't change, and deload workouts don't trigger progression. Each workout records whether it was a deload: History tags it, and the calendar shades deload weeks (past ones, and your current programme's upcoming ones).
  - Preview, swap any exercise (⇄, same movement and similar difficulty), regenerate a single day (↻), then save. Saving can put the programme on the calendar; your own plans stay in the list. Regenerating replaces only the previous generated plans.
  - Library exercises are tagged with movement pattern, difficulty (1–5) and equipment; tag your own exercises in their edit form so the generator can use them.
  - **Learns from your history**: difficulty per movement comes from your last 8 weeks (12+ reps or 30+ s holds = a step above that exercise's difficulty, 6–11 reps at it, fewer below; weighted 6+ reps = a step above). The level setting only covers movements you haven't logged. Weights are pre-filled from what you last used.
  - **Automatic progression**: finishing a generated plan's workout with every target set hit raises that exercise next time — +1 rep (or +5 s, +2 s for skills) up to a ceiling for the day type (strength 8, muscle 15, endurance 25 reps); then +2.5 kg / 5 lb if weighted, otherwise the next harder variation. A *Next time* card lists the changes. Warm-ups and your own plans never change.
- **Skill paths** (Exercises tab): 13 calisthenics goals as ladders of library exercises, each named after its final step: Archer Pull-up, Muscle-up, One-arm Push-up, Ring Dip, Handstand Push-up, Freestanding Handstand, Pistol Squat, Front Lever, Back Lever, Straddle Planche, V-sit, Nordic Curl and Windshield Wiper. Your place on each comes from your history: the current step is the hardest one you've done (a set of 0 counts as attempted, not done), or the next once a set reaches 12 reps (20 s for holds). Tap a step for its history and chart.
- **Hold timer**: timed sets (plank, L-sit, levers…) have a ▶ button: a 5-second *get ready* countdown, one beep to start, then the target seconds counting down and three beeps at the end, which ticks the set and starts the rest. *Stop* early records the seconds actually held; *Cancel* during get-ready records nothing. While a hold runs, exercises and sets can't be moved or removed.
- **Easier / harder during a workout**: each exercise with a movement tag offers *Easier: …* and *Harder: …* — the closest variation one difficulty step down or up that your equipment allows. Pressing the other button goes back the way you came (Easier then Harder returns to the exercise you started with). Swapping keeps the reps and clears the weight; sets you've already ticked stay recorded under the original exercise. Only that workout changes, not the plan.
- **Last time's note**: under each exercise, next to last time's sets, the workout shows the note you wrote for it in your most recent workout (e.g. "try chalk"), so reminders carry forward.
- **Plans**: build workouts in advance (exercises with target sets, reps and weights), then tap **Start** at the gym and adjust as you go. The plan itself stays unchanged. Any past workout can also be saved as a plan.
- **Calisthenics library**: about 100 built-in exercises grouped into Push, Pull, Legs, Core, Skills and Conditioning, searchable by name or muscle.
- **Your own exercises**: create, edit and delete custom exercises with any category, measured in reps or seconds.
- **Weekly repeats**: in a plan, pick the weekdays it repeats on (one plan per weekday). Repeats show on the calendar from today on; tap a single day to skip it or swap in another plan without changing the repeat. Once a day passes, its planned workout is kept, even if you change the repeat later; a planned day with no workout logged gets a red ring (missed).
- **Schedule plans**: tap any day in the History calendar and pick a plan for it (dashed ring on the calendar). On the day, the Workout tab shows "Today: <plan>" with a Start button. Deleting a plan (or replacing a generated programme) removes it from upcoming days; past days keep its name, marked "deleted plan".
- **Training calendar**: the History tab opens with a month calendar (trained days filled in, today outlined), workouts this week and this month, and your weekly streak (weeks in a row with at least one workout). Tap a day to see just its workouts.
- **History**: every finished workout is kept with all its sets, reps and weights. Past workouts can be edited, deleted, repeated, or saved as a plan.
- **Per-exercise progress**: each exercise shows your best set, a progress chart (top weight, most reps/longest hold, or total reps/time per workout; tap or drag to read any workout), and every past session where you did it. While logging, you see what you did last time, and a 🏆 marks any ticked set that beats your previous best.
- **Settings**: choose kg or lb, and export or import all your data as a JSON file (to move it to another device or browser). Imports are checked in full (every workout, plan, exercise and set, and that the exercises and plans they refer to exist); a damaged or hand-edited file is refused with a message saying what's wrong, and your data is left untouched.
- **Recovery screen**: if anything ever crashes the app (a bug, or saved data that no longer loads), it shows the problem with *Download your data* (exactly what's saved), *Try again* and *Reset the app* (after confirming), instead of a blank page.
- **Backup reminder**: Settings shows when you last exported. If it has been 7 days or more (or never), the Workout tab shows a reminder with a one-tap **Back up now**.

Weight is *added* weight: leave it at 0 for bodyweight, or use a negative number for assisted work (e.g. bands).

## Run locally

```sh
npm install
npm run dev      # development server
npm run build    # production build into dist/
```

## Tests

```sh
npm test            # unit tests (Vitest): data migrations, scheduling, supersets, stats, progression, generator rules
npm run test:e2e    # end-to-end tests (Playwright): every main flow in a phone-sized browser, with a fixed clock
npm run lint && npm run typecheck
```

The generator test checks its rules (fits the time limit, equipment respected, no duplicates, warm-up → skill → main → core → stretches, push/pull/legs balance, 10–20 weekly sets per muscle group, rest periods) on every combination of days, length, level and equipment. Every push runs all checks on GitHub; the app is only published from `main` when they pass.

## Use it on your phone

The workflow in `.github/workflows/deploy.yml` tests the app on every push and publishes it to GitHub Pages from `main` once the tests pass. Turn it on once under **Settings → Pages → Source: GitHub Actions**. Then open the site on your phone and use "Add to Home Screen".

Data is stored per browser and per device. Use **Settings → Export** to keep a copy or move it elsewhere.
