# Gym Log

A personal workout tracker that runs in the browser (phone or desktop). No account, no server: your data lives in the browser's local storage on your device.

## Features

- **Log workouts**: start a workout, add exercises, and add as many sets as you like, each with its own weight and reps (or seconds for holds such as planks or L-sits).
- **Plans**: build workouts in advance (exercises with target sets, reps and weights), then tap **Start** at the gym and adjust as you go. The plan itself stays unchanged. Any past workout can also be saved as a plan.
- **Calisthenics library**: about 100 built-in exercises grouped into Push, Pull, Legs, Core, Skills and Conditioning, searchable by name or muscle.
- **Your own exercises**: create, edit and delete custom exercises with any category, measured in reps or seconds.
- **History**: every finished workout is kept with all its sets, reps and weights. Past workouts can be edited, deleted, repeated, or saved as a plan.
- **Per-exercise progress**: each exercise shows your best set and every past session where you did it. While logging, you also see what you did last time.
- **Settings**: choose kg or lb, and export or import all your data as a JSON file (to move it to another device or browser).

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
