// One reactive store, local-first: every change lands in localStorage
// immediately (keyed by uid, so the office desktop and the phone each keep a
// cache) and a debounced whole-snapshot push mirrors it to RTDB. On sign-in
// the local cache and the cloud copy are merged — see lib/merge.js.

import { reactive } from 'vue'
import { fetchUserData, writeUserData } from './firebase.js'
import { mergeData, normalizeData, HISTORY_CAP } from './merge.js'
import { episodeKey } from './picker.js'

const cacheKey = (uid) => `rewatchr.data.${uid}`
// Who was signed in last time on this browser (2026-11-05). Opening the app
// used to sit on "Warming up…" until Firebase Auth answered, even though the
// shows were already in the cache above. Now the app opens straight onto
// that person's cached shows and Auth confirms in the background — see
// startFromCache / loadForUser / clearUser.
const LAST_USER_KEY = 'rewatchr.lastUser'
const PUSH_DELAY = 1500

export const store = reactive({
  user: null,
  authReady: false,
  loaded: false,
  // False while the app is showing a remembered user that Firebase Auth
  // hasn't vouched for yet. Nothing is pushed to the database until it is
  // true: the rules would refuse a write without a live token anyway.
  confirmed: false,
  // Set only by the dev sign-in bypass (lib/devAuth.js): keeps everything in
  // localStorage so a dev session can never read or write the real database.
  // A plain boolean rather than a check against the dev user, so nothing
  // dev-related has to be imported by production code.
  localOnly: false,
  shows: {},
  watched: {},
  history: [],
  syncError: '',
})

const snapshot = () => ({
  shows: store.shows,
  watched: store.watched,
  history: store.history,
})

const readCache = (uid) => {
  try {
    return JSON.parse(localStorage.getItem(cacheKey(uid)) ?? 'null')
  } catch {
    return null
  }
}

const writeCache = () => {
  if (!store.user) return
  try {
    localStorage.setItem(cacheKey(store.user.uid), JSON.stringify(snapshot()))
  } catch {
    // Best effort; the cloud copy is the durable one.
  }
}

const rememberUser = (user) => {
  try {
    const { uid, email, name, photo } = user
    localStorage.setItem(LAST_USER_KEY, JSON.stringify({ uid, email, name, photo }))
  } catch {
    // Best effort; without it the next launch just waits for Auth.
  }
}

const forgetUser = () => {
  try {
    localStorage.removeItem(LAST_USER_KEY)
  } catch {
    // Nothing to do.
  }
}

const readLastUser = () => {
  try {
    const user = JSON.parse(localStorage.getItem(LAST_USER_KEY) ?? 'null')
    return user && typeof user.uid === 'string' ? user : null
  } catch {
    return null
  }
}

let pushTimer = null
const schedulePush = () => {
  writeCache()
  if (!store.user || store.localOnly || !store.confirmed) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(async () => {
    try {
      await writeUserData(store.user.uid, snapshot())
      store.syncError = ''
    } catch (error) {
      store.syncError = error.message || 'Sync failed'
    }
  }, PUSH_DELAY)
}

const apply = (data) => {
  store.shows = data.shows
  store.watched = data.watched
  store.history = data.history
}

// Launch, before Firebase Auth has said anything: if someone was signed in
// here last time, show their cached shows now. Edits made before Auth
// confirms land in the cache only; loadForUser pushes them once it does.
export const startFromCache = () => {
  if (store.user) return false
  const user = readLastUser()
  if (!user) return false
  store.user = user
  store.confirmed = false
  apply(normalizeData(readCache(user.uid)))
  store.loaded = true
  return true
}

// Firebase Auth's answer. The same person startFromCache guessed: keep what's
// on screen (including any edits since launch) and merge the cloud copy in.
// Anyone else: start over from their own cache.
export const loadForUser = async (user) => {
  const sameAsShown = store.user?.uid === user.uid
  store.user = user
  store.confirmed = true
  if (!store.localOnly) rememberUser(user)
  if (!sameAsShown) {
    store.loaded = false
    apply(normalizeData(readCache(user.uid)))
  }
  if (store.localOnly) {
    store.loaded = true
    return
  }
  try {
    const remote = await fetchUserData(user.uid)
    // Signed out or switched while the fetch was out: this answer is stale.
    if (store.user?.uid !== user.uid) return
    // Merge with what's on screen now, so an edit made during the fetch
    // isn't overwritten by the copy read before it.
    apply(mergeData(snapshot(), remote))
    store.syncError = ''
  } catch (error) {
    if (store.user?.uid !== user.uid) return
    // Offline or the database is unreachable — the local cache carries it.
    store.syncError = error.message || 'Could not reach the cloud copy'
  }
  store.loaded = true
  schedulePush()
}

// Signed out (here, on another device, or the sign-in expired): back to the
// sign-in screen, and stop opening straight into this person's shows.
export const clearUser = () => {
  clearTimeout(pushTimer)
  forgetUser()
  store.user = null
  store.confirmed = false
  apply({ shows: {}, watched: {}, history: [] })
}

// --- mutations ---------------------------------------------------------

export const addShow = (show) => {
  if (store.shows[show.id]) return
  store.shows = {
    ...store.shows,
    [show.id]: {
      id: show.id,
      name: show.name,
      poster: show.poster ?? null,
      addedAt: Date.now(),
      episodes: {},
    },
  }
  schedulePush()
}

export const removeShow = (showId) => {
  const shows = { ...store.shows }
  delete shows[showId]
  store.shows = shows
  schedulePush()
}

export const setEpisodeLiked = (showId, ep, liked) => {
  const show = store.shows[showId]
  if (!show) return
  const episodes = { ...(show.episodes || {}) }
  const slot = `s${ep.season}e${ep.episode}`
  if (liked) {
    episodes[slot] = {
      season: ep.season,
      episode: ep.episode,
      name: ep.name ?? '',
      still: ep.still ?? null,
      rating: ep.rating ?? null,
    }
  } else {
    delete episodes[slot]
  }
  store.shows = { ...store.shows, [showId]: { ...show, episodes } }
  schedulePush()
}

// Bulk version, for the whole-season and whole-show toggles. One store write
// and one sync push however many episodes are involved — doing this an
// episode at a time would copy the whole show object 180 times for Seinfeld.
export const setEpisodesLiked = (showId, eps, liked) => {
  const show = store.shows[showId]
  if (!show || !eps.length) return
  const episodes = { ...(show.episodes || {}) }
  for (const ep of eps) {
    const slot = `s${ep.season}e${ep.episode}`
    if (liked) {
      episodes[slot] = {
        season: ep.season,
        episode: ep.episode,
        name: ep.name ?? '',
        still: ep.still ?? null,
        rating: ep.rating ?? null,
      }
    } else {
      delete episodes[slot]
    }
  }
  store.shows = { ...store.shows, [showId]: { ...show, episodes } }
  schedulePush()
}

export const isEpisodeLiked = (showId, ep) =>
  Boolean(store.shows[showId]?.episodes?.[`s${ep.season}e${ep.episode}`])

// A two-parter is one sitting: every part it dealt is marked watched, so the
// other half can't come back around on its own tomorrow.
export const markWatched = (pick) => {
  const at = Date.now()
  const keys = pick.keys?.length ? pick.keys : [pick.key]
  const watched = { ...store.watched }
  for (const key of keys) watched[key] = at
  store.watched = watched
  store.history = [
    {
      key: pick.key,
      showId: pick.show.id,
      showName: pick.show.name,
      season: pick.ep.season,
      episode: pick.ep.episode,
      epName: pick.ep.name ?? '',
      partCount: keys.length,
      at,
    },
    ...store.history,
  ].slice(0, HISTORY_CAP)
  schedulePush()
}

// Recycling (see picker.js) clears the watched ledger for a fresh lap but
// keeps history — the diary of what it's dealt you survives.
export const resetWatched = () => {
  store.watched = {}
  schedulePush()
}

export { episodeKey }
