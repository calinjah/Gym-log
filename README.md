# Gym Log

A personal workout tracker that runs in the browser (phone or desktop). No account, no server: your data lives in the browser's local storage on your device.

## Features

- **Log workouts**: start a workout, add exercises, and add as many sets as you like, each with its own weight and reps (or seconds for holds such as planks or L-sits).
- **Tick off sets**: during a workout, tick each set as you finish it. If you finish with unticked sets, you choose whether to save them or leave them out.
- **Supersets & circuits**: tap **+ Link as superset** between two exercises to group them (labelled A1, A2…; link more for a circuit). Ticking a set in a superset skips the rest so you go straight to the next exercise; the rest starts after the last one.
- **Rest timer**: ticking a set starts a countdown (rest time set per exercise, default 90 s) with −15/+15/Skip, and beeps when it ends. The beep volume is adjustable in Settings, with a *Test beep* button.
- **Works offline**: after the first visit the app is stored on the device, so it opens without signal. Updates download in the background and apply the next time it opens.
- **Weekly programme generator** (Workout tab → *Generate a weekly programme*): pick 2–4 training days, 45 or 60 minutes, your level and equipment. Rules-based, offline:
  - The week mixes goals (undulating periodisation): **Strength** (4×5, harder variations, skill block first), **Muscle** (3×10 push/pull supersets) and **Endurance** (circuits of 15 reps / 45 s holds). 2 days = Strength + Muscle full body; 3 days adds Endurance; 4 days = upper/lower split.
  - Every session: band warm-up circuit → (strength days) skill practice → balanced main work (vertical/horizontal push and pull, squat, hinge, lunge) → core finisher, sized to fit the time.
  - Preview, swap any exercise (⇄, same movement and similar difficulty), regenerate a single day (↻), then save. Saving can put the programme on the calendar; your own plans stay in the list. Regenerating replaces only the previous generated plans.
  - Library exercises are tagged with movement pattern, difficulty (1–5) and equipment; tag your own exercises in their edit form so the generator can use them.
  - **Learns from your history**: difficulty per movement comes from your last 8 weeks (12+ reps or 30+ s holds = a step above that exercise's difficulty, 6–11 reps at it, fewer below; weighted 6+ reps = a step above). The level setting only covers movements you haven't logged. Weights are pre-filled from what you last used.
  - **Automatic progression**: finishing a generated plan's workout with every target set hit raises that exercise next time — +1 rep (or +5 s, +2 s for skills) up to a ceiling for the day type (strength 8, muscle 15, endurance 25 reps); then +2.5 kg / 5 lb if weighted, otherwise the next harder variation. A *Next time* card lists the changes. Warm-ups and your own plans never change.
- **Plans**: build workouts in advance (exercises with target sets, reps and weights), then tap **Start** at the gym and adjust as you go. The plan itself stays unchanged. Any past workout can also be saved as a plan.
- **Calisthenics library**: about 100 built-in exercises grouped into Push, Pull, Legs, Core, Skills and Conditioning, searchable by name or muscle.
- **Your own exercises**: create, edit and delete custom exercises with any category, measured in reps or seconds.
- **Weekly repeats**: in a plan, pick the weekdays it repeats on (one plan per weekday). Repeats show on the calendar from today on; tap a single day to skip it or swap in another plan without changing the repeat.
- **Schedule plans**: tap any day in the History calendar and pick a plan for it (dashed ring on the calendar). On the day, the Workout tab shows "Today: <plan>" with a Start button. Deleting a plan removes it from the calendar.
- **Training calendar**: the History tab opens with a month calendar (trained days filled in, today outlined), workouts this week and this month, and your weekly streak (weeks in a row with at least one workout). Tap a day to see just its workouts.
- **History**: every finished workout is kept with all its sets, reps and weights. Past workouts can be edited, deleted, repeated, or saved as a plan.
- **Per-exercise progress**: each exercise shows your best set, a progress chart (top weight, most reps/longest hold, or total reps/time per workout; tap or drag to read any workout), and every past session where you did it. While logging, you see what you did last time, and a 🏆 marks any ticked set that beats your previous best.
- **Bodyweight log**: the Body tab logs one weigh-in per day with a chart. **Import from Renpho**: export your measurements as CSV in the Renpho app and pick the file; the date and weight columns are found by name, pounds/kg are converted, and the earliest weigh-in of each day is kept. (Renpho has no public API, so live syncing isn't possible.)
- **Settings**: choose kg or lb, and export or import all your data as a JSON file (to move it to another device or browser).
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
npm test            # unit tests (Vitest): data migrations, scheduling, supersets, stats, Renpho import, generator rules
npm run test:e2e    # end-to-end tests (Playwright): every main flow in a phone-sized browser, with a fixed clock
npm run lint && npm run typecheck
```

The generator test checks its rules (fits the time limit, equipment respected, no duplicates, warm-up → skill → main → core, push/pull/legs balance) on every combination of days, length, level and equipment. Every push runs all checks on GitHub; the app is only published from `main` when they pass.

## Use it on your phone

The workflow in `.github/workflows/deploy.yml` tests the app on every push and publishes it to GitHub Pages from `main` once the tests pass. Turn it on once under **Settings → Pages → Source: GitHub Actions**. Then open the site on your phone and use "Add to Home Screen".

Data is stored per browser and per device. Use **Settings → Export** to keep a copy or move it elsewhere.
