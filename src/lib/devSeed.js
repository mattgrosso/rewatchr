// A pool worth testing against, in one step.
//
// Dev-only companion to devAuth.js. Without it, every dev session starts at
// "No shows yet" and testing the draw means searching TMDB and ticking
// episodes by hand first. The picks are deliberate rather than arbitrary:
// two real two-parters (Seinfeld's "The Trip", Always Sunny's "Mac and
// Charlie Die") so the multi-part grouping can actually be seen working, and
// standalones alongside them so the ordinary path is covered too.
//
// Real TMDB data, so ratings, stills and streaming providers are the real
// ones. Never bundled in production: its only caller imports it dynamically
// behind an `import.meta.env.DEV` check.

import { showSeasons, seasonEpisodes } from './tmdb.js'
import { store, addShow, setEpisodesLiked } from './store.js'
import { devAuthEnabled } from './devAuth.js'

const PLAN = [
  // S4: The Trip (1)+(2), The Contest, The Pilot (1)+(2).
  { id: 1400, season: 4, episodes: [1, 2, 11, 23, 24] },
  // S4: Mac and Charlie Die (1)+(2), The Nightman Cometh.
  { id: 2710, season: 4, episodes: [5, 6, 13] },
]

export const seedDevPool = async () => {
  if (!devAuthEnabled()) return
  for (const entry of PLAN) {
    const details = await showSeasons(entry.id)
    addShow({ id: details.id, name: details.name, poster: details.poster })
    const episodes = await seasonEpisodes(entry.id, entry.season)
    setEpisodesLiked(
      details.id,
      episodes.filter((ep) => entry.episodes.includes(ep.episode)),
      true,
    )
  }
}

// Seeds only an empty pool, so a reload can't pile duplicates on top of
// whatever you were in the middle of testing.
export const maybeSeedDevPool = async () => {
  if (!devAuthEnabled()) return
  if (Object.keys(store.shows).length) return
  try {
    await seedDevPool()
  } catch {
    // Offline or TMDB down: an empty pool is a perfectly usable dev state.
  }
}
