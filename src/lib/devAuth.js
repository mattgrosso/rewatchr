// A signed-in app you can open without signing in.
//
// Rewatchr gates everything behind a Google popup, which is right for real
// use and useless for development: a popup can't be driven by browser
// automation, so every screen past the splash was untestable except through
// unit tests. This is the way in.
//
// Deliberately NOT a test account. There are no credentials here, nothing to
// keep out of git, and no way to touch the real database — the dev user is
// invented on the spot and its data stays in localStorage. Signing in as a
// real account would put production data one misclick from a test run.
//
// Two locks, both required, so this cannot reach anyone:
//   1. `import.meta.env.DEV` is false in a production build, so Vite strips
//      this whole branch out of the bundle. Pinned by a test.
//   2. Even in dev it stays off until asked for, so `yarn dev` still
//      exercises the real sign-in path by default.
//
// Turn it on with either:
//   VITE_DEV_AUTH=1 yarn dev        (whole session)
//   http://localhost:5173/?dev=1    (one tab; sticks for that browser)

const STICKY_KEY = 'rewatchr.devAuth'

export const DEV_USER = {
  uid: 'dev-local',
  email: 'dev@rewatchr.local',
  name: 'Dev (local)',
  photo: null,
}

export const isDevUser = (user) => user?.uid === DEV_USER.uid

// `?dev=1` is remembered so a reload — which the auto-update feature does on
// its own — doesn't drop you back at the splash. `?dev=0` forgets it.
const stickyOptIn = () => {
  try {
    const asked = new URLSearchParams(window.location.search).get('dev')
    if (asked === '1') {
      localStorage.setItem(STICKY_KEY, '1')
      return true
    }
    if (asked === '0') {
      localStorage.removeItem(STICKY_KEY)
      return false
    }
    return localStorage.getItem(STICKY_KEY) === '1'
  } catch {
    return false
  }
}

export const devAuthEnabled = () => {
  if (!import.meta.env.DEV) return false
  return import.meta.env.VITE_DEV_AUTH === '1' || stickyOptIn()
}

// Stands in for the whole real sign-in path: marks the store local-only
// BEFORE any data loads (so nothing can be pushed to the real database),
// then fills an empty pool so there's something to draw from.
export const startDevSession = async () => {
  const { store, loadForUser } = await import('./store.js')
  store.localOnly = true
  store.authReady = true
  await loadForUser(DEV_USER)
  const { maybeSeedDevPool } = await import('./devSeed.js')
  await maybeSeedDevPool()
}

export const endDevSession = () => {
  try {
    localStorage.removeItem(STICKY_KEY)
  } catch {
    // Best effort — reloading without ?dev=1 ends the session anyway.
  }
  window.location.href = window.location.pathname
}
