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

export const episodeKey = (showId, ep) => `${showId}|s${ep.season}e${ep.episode}`

const likedEpisodes = (show) => Object.values(show.episodes || {})

// How many liked episodes exist / remain unwatched, for the button caption.
export const poolCounts = (shows, watched) => {
  let total = 0
  let unwatched = 0
  for (const show of Object.values(shows || {})) {
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
export const pickEpisode = (shows, watched, rand = Math.random) => {
  const { total, unwatched } = poolCounts(shows, watched)
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

  const candidates = []
  for (const show of Object.values(shows)) {
    const eps = likedEpisodes(show).filter((ep) => !excluded.has(episodeKey(show.id, ep)))
    if (eps.length) candidates.push({ show, eps })
  }
  if (!candidates.length) return null

  const pickFrom = (list) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))]
  const { show, eps } = pickFrom(candidates)
  const ep = pickFrom(eps)
  return { show, ep, key: episodeKey(show.id, ep), recycled }
}
