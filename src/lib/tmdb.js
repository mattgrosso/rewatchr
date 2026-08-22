// TMDB is the whole catalog: show search, season/episode listings, and the
// where-to-stream data (TMDB licenses JustWatch's provider feed). Same
// client-side API key Cinema Roll uses — TMDB keys are public by design.

const KEY = '7a5e8056956703ad202d3a3ddbcfc0e3'
const BASE = 'https://api.themoviedb.org/3'

const getJson = async (path, params = {}) => {
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('api_key', KEY)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`TMDB ${path} failed: ${response.status}`)
  return response.json()
}

export const img = (path, size = 'w300') => (path ? `https://image.tmdb.org/t/p/${size}${path}` : null)

export const searchShows = async (query) => {
  const data = await getJson('/search/tv', { query, include_adult: 'false' })
  return (data.results || []).map((show) => ({
    id: show.id,
    name: show.name,
    year: (show.first_air_date || '').slice(0, 4),
    poster: show.poster_path,
    overview: show.overview,
  }))
}

// Seasons for the picker UI. Specials (season 0) are skipped — nobody's
// lunchtime comfort episode is a webisode recap.
export const showSeasons = async (id) => {
  const data = await getJson(`/tv/${id}`)
  return {
    id: data.id,
    name: data.name,
    poster: data.poster_path,
    backdrop: data.backdrop_path,
    seasons: (data.seasons || [])
      .filter((s) => s.season_number > 0)
      .map((s) => ({ number: s.season_number, name: s.name, episodeCount: s.episode_count })),
  }
}

export const seasonEpisodes = async (id, seasonNumber) => {
  const data = await getJson(`/tv/${id}/season/${seasonNumber}`)
  return (data.episodes || []).map((ep) => ({
    season: ep.season_number,
    episode: ep.episode_number,
    name: ep.name,
    overview: ep.overview,
    still: ep.still_path,
  }))
}

// Where to stream, US. `link` is TMDB's per-show watch page (their JustWatch
// attribution requirement is satisfied by linking there rather than deep
// into each service).
export const watchProviders = async (id) => {
  const data = await getJson(`/tv/${id}/watch/providers`)
  const us = data.results?.US
  if (!us) return { link: null, flatrate: [] }
  return {
    link: us.link || null,
    flatrate: (us.flatrate || []).map((p) => ({ name: p.provider_name, logo: p.logo_path })),
  }
}
