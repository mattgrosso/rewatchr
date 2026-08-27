// The heart of the app: hand back one liked episode at random.
//
// Show-first, then episode-within-show — deliberately NOT uniform over all
// episodes. Uniform would let a show with 120 liked episodes drown out one
// with 8; picking the show first is what makes lunchtime feel like "Simpsons
// today, Seinfeld tomorrow" instead of "Simpsons most days".
//
// Watched episodes are excluded so it never repeats itself — until the whole
// pool is watched, at which point it recycles: everything is fair game again
// except the handful you saw most recently.

import { multiPartGroup } from './multipart.js'

export const episodeKey = (showId, ep) => `${showId}|s${ep.season}e${ep.episode}`

const likedEpisodes = (show) => Object.values(show.episodes || {})

// Narrow the pool to one show, for "I'm in the mood for Seinfeld".
//
// Requested via the bug button: "It would be nice if there was a way to draw
// randomly from within a certain subset so I could draw just from a single
// show. If I wanted to whenever I was feeling an episode of that show."
//
// Applied by shrinking the shows map and then running the ordinary algorithm
// over it, rather than by adding a branch inside the algorithm. Everything
// downstream keeps working unchanged and for the same reasons: the no-repeat
// exclusion, the recycle-when-exhausted lap, and the two-parter grouping all
// scope themselves to the smaller pool automatically. The show-first weighting
// simply has nothing left to weigh.
//
// Matched on show.id rather than the map key, so it doesn't depend on how the
// store happens to key things.
export const scopeToShow = (shows, showId) => {
  if (!showId) return shows || {}
  return Object.fromEntries(
    Object.entries(shows || {}).filter(([, show]) => String(show?.id) === String(showId)),
  )
}

// How many liked episodes exist / remain unwatched, for the button caption.
export const poolCounts = (shows, watched, showId = null) => {
  let total = 0
  let unwatched = 0
  for (const show of Object.values(scopeToShow(shows, showId))) {
    for (const ep of likedEpisodes(show)) {
      total += 1
      if (!watched?.[episodeKey(show.id, ep)]) unwatched += 1
    }
  }
  return { total, unwatched }
}

// The most recently watched keys, per the watched map's timestamps.
const recentKeys = (watched, count) =>
  Object.entries(watched || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, count)
    .map(([key]) => key)

// Returns { show, ep, key, recycled } or null when no episodes are liked at
// all. `rand` is injectable for tests; defaults to Math.random.
//
// `avoidKeys` holds episodes dealt-but-passed-on this session ("Deal again"),
// so a redraw never hands back the one you just turned down. It's a soft
// exclusion: if avoiding them would empty the pool, they come back in rather
// than the button going dead.
export const pickEpisode = (shows, watched, rand = Math.random, avoidKeys = [], showId = null) => {
  const scoped = scopeToShow(shows, showId)
  const { total, unwatched } = poolCounts(scoped, watched)
  if (!total) return null

  let excluded
  let recycled = false
  if (unwatched > 0) {
    excluded = new Set(Object.keys(watched || {}))
  } else {
    // Everything's been watched: recycle, but keep the last few draws out of
    // reach so "fresh start" never means "the one you watched yesterday".
    recycled = true
    excluded = new Set(recentKeys(watched, Math.min(5, total - 1)))
  }
  for (const key of avoidKeys) excluded.add(key)

  const candidates = []
  for (const show of Object.values(scoped)) {
    const eps = likedEpisodes(show).filter((ep) => !excluded.has(episodeKey(show.id, ep)))
    if (eps.length) candidates.push({ show, eps })
  }
  if (!candidates.length) {
    // Only the soft "just passed on this" exclusion can empty a pool that
    // poolCounts said was non-empty; drop it and deal again rather than
    // letting the button go dead. Stays scoped to the chosen show.
    return avoidKeys.length ? pickEpisode(shows, watched, rand, [], showId) : null
  }

  const pickFrom = (list) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))]
  const { show, eps } = pickFrom(candidates)
  const drawn = pickFrom(eps)

  // A two-parter is dealt whole, and always from part one — landing on
  // "The Trip (2)" and being told to start there would be nonsense.
  const parts = multiPartGroup(likedEpisodes(show), drawn)
  const ep = parts[0]
  return {
    show,
    ep,
    parts,
    key: episodeKey(show.id, ep),
    keys: parts.map((part) => episodeKey(show.id, part)),
    recycled,
  }
}
