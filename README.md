# Gym Log

A personal workout tracker that runs in the browser (phone or desktop). No account, no server: your data lives in the browser's local storage on your device.

## Features

- **Log workouts**: start a workout, add exercises, and add as many sets as you like, each with its own weight and reps (or seconds for holds such as planks or L-sits).
- **Tick off sets**: during a workout, tick each set as you finish it. If you finish with unticked sets, you choose whether to save them or leave them out.
- **Supersets & circuits**: tap **+ Link as superset** between two exercises to group them (labelled A1, A2…; link more for a circuit). Ticking a set in a superset skips the rest so you go straight to the next exercise; the rest starts after the last one.
- **Rest timer**: ticking a set starts a countdown (rest time set per exercise, default 90 s) with −15/+15/Skip, and beeps when it ends.
- **Works offline**: after the first visit the app is stored on the device, so it opens without signal. Updates download in the background and apply the next time it opens.
- **Plans**: build workouts in advance (exercises with target sets, reps and weights), then tap **Start** at the gym and adjust as you go. The plan itself stays unchanged. Any past workout can also be saved as a plan.
- **Calisthenics library**: about 100 built-in exercises grouped into Push, Pull, Legs, Core, Skills and Conditioning, searchable by name or muscle.
- **Your own exercises**: create, edit and delete custom exercises with any category, measured in reps or seconds.
- **Training calendar**: the History tab opens with a month calendar (trained days filled in, today outlined), workouts this week and this month, and your weekly streak (weeks in a row with at least one workout). Tap a day to see just its workouts.
- **History**: every finished workout is kept with all its sets, reps and weights. Past workouts can be edited, deleted, repeated, or saved as a plan.
- **Per-exercise progress**: each exercise shows your best set, a progress chart (top weight, most reps/longest hold, or total reps/time per workout; tap or drag to read any workout), and every past session where you did it. While logging, you see what you did last time, and a 🏆 marks any ticked set that beats your previous best.
- **Settings**: choose kg or lb, and export or import all your data as a JSON file (to move it to another device or browser).
- **Backup reminder**: Settings shows when you last exported. If it has been 7 days or more (or never), the Workout tab shows a reminder with a one-tap **Back up now**.

Weight is *added* weight: leave it at 0 for bodyweight, or use a negative number for assisted work (e.g. bands).

## Run locally

```sh
npm install
npm run dev      # development server
npm run build    # production build into dist/
```

## Use it on your phone

The workflow in `.github/workflows/deploy.yml` publishes the app to GitHub Pages on every push to `main`. Turn it on once under **Settings → Pages → Source: GitHub Actions**. Then open the site on your phone and use "Add to Home Screen".

Data is stored per browser and per device. Use **Settings → Export** to keep a copy or move it elsewhere.
