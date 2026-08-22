// One reactive store, local-first: every change lands in localStorage
// immediately (keyed by uid, so the office desktop and the phone each keep a
// cache) and a debounced whole-snapshot push mirrors it to RTDB. On sign-in
// the local cache and the cloud copy are merged — see lib/merge.js.

import { reactive } from 'vue'
import { fetchUserData, writeUserData } from './firebase.js'
import { mergeData, normalizeData, HISTORY_CAP } from './merge.js'
import { episodeKey } from './picker.js'

const cacheKey = (uid) => `rewatchr.data.${uid}`
const PUSH_DELAY = 1500

export const store = reactive({
  user: null,
  authReady: false,
  loaded: false,
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

let pushTimer = null
const schedulePush = () => {
  writeCache()
  if (!store.user) return
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

export const loadForUser = async (user) => {
  store.user = user
  store.loaded = false
  const local = normalizeData(readCache(user.uid))
  apply(local)
  try {
    const remote = await fetchUserData(user.uid)
    apply(mergeData(local, remote))
    store.syncError = ''
  } catch (error) {
    // Offline or the database is unreachable — the local cache carries it.
    store.syncError = error.message || 'Could not reach the cloud copy'
  }
  store.loaded = true
  schedulePush()
}

export const clearUser = () => {
  store.user = null
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
    }
  } else {
    delete episodes[slot]
  }
  store.shows = { ...store.shows, [showId]: { ...show, episodes } }
  schedulePush()
}

export const isEpisodeLiked = (showId, ep) =>
  Boolean(store.shows[showId]?.episodes?.[`s${ep.season}e${ep.episode}`])

export const markWatched = (pick) => {
  store.watched = { ...store.watched, [pick.key]: Date.now() }
  store.history = [
    {
      key: pick.key,
      showId: pick.show.id,
      showName: pick.show.name,
      season: pick.ep.season,
      episode: pick.ep.episode,
      epName: pick.ep.name ?? '',
      at: Date.now(),
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
