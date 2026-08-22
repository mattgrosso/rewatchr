# Rewatchr

One great episode of a show you already love, on demand. Add your comfort
shows, check off the episodes worth rewatching, and at lunchtime press the
button: Rewatchr deals you one at random — Simpsons today, Seinfeld tomorrow —
and tells you where it's streaming. It tracks what it's dealt so it doesn't
repeat itself; once you've lapped the whole pool it starts a fresh lap.

Live at **https://rewatchr-85473.web.app** (Firebase Hosting).

## How it works

- **Vue 3 + Vite PWA**, installable, offline-capable app shell.
- **Google sign-in** (Firebase Auth); the show list and watch ledger sync to
  the Realtime Database in the app's own `rewatchr-85473` project under
  `users/$uid`, local-first with a localStorage cache and a debounced
  whole-snapshot push. Multi-device conflicts merge generously
  (`src/lib/merge.js`).
- **TMDB** supplies search, seasons/episodes, artwork, and where-to-stream
  (their licensed JustWatch feed); the result card links to the show's TMDB
  watch page.
- **The draw** (`src/lib/picker.js`) picks a show first, then an episode
  within it — so a show with 8 liked episodes surfaces as often as one with
  120. Watched episodes are excluded until the pool is exhausted, then
  everything recycles except the most recent few draws.
- **🐛 bug button** on every screen, hub-standard: write-only `bugReports`
  node, offline stash, triaged with `yarn fetch-bug-reports` /
  `yarn resolve-bug-report <id>`.

## Running it signed in (dev)

Everything past the splash is behind a Google popup, which browser automation
can't drive — so there's a dev-only bypass (`src/lib/devAuth.js`).

```
yarn dev:signed-in          # opens straight into the app as a fake local user
yarn dev                    # normal: real Google sign-in
```

Or, from a normal `yarn dev`, visit `/?dev=1` (sticks for that browser until
`/?dev=0` or Sign out).

- **No credentials anywhere.** The dev user is invented on the spot; there is
  no test account, nothing to keep out of git, and no path to the real
  database — the store is marked `localOnly`, so a dev session reads and
  writes localStorage only.
- **An empty pool self-seeds** (`src/lib/devSeed.js`) with real TMDB data
  chosen to exercise the app: two genuine two-parters plus standalones.
- **It cannot ship.** Every reference sits behind `import.meta.env.DEV`, which
  Vite replaces with `false` when building, so the modules are dropped rather
  than merely disabled. `yarn verify-dev-excluded` greps the built bundle to
  prove it and runs as part of `yarn deploy`.

The house pattern in Cinema Roll and Movie Hat is different — `yarn
mint-test-token` signs a browser in as a real tester account via an
Admin-SDK-minted custom token, which tests the live rules and real sync. That
needs a service-account key for this project; worth adding if Rewatchr ever
grows sharing or anything else where the rules are the thing under test.

## Commands

```
yarn dev            # local dev server
yarn test:run       # vitest
yarn build          # production build to dist/
yarn deploy         # build + firebase deploy (hosting + database rules)
yarn make-icons     # regenerate the PWA icons in public/
```
