import { describe, it, expect } from 'vitest'
import { pickEpisode, poolCounts, episodeKey } from '../src/lib/picker.js'

const ep = (season, episode, name = `Ep ${season}.${episode}`) => ({ season, episode, name })

const show = (id, name, eps) => ({
  id,
  name,
  episodes: Object.fromEntries(eps.map((e) => [`s${e.season}e${e.episode}`, e])),
})

const simpsons = show(456, 'The Simpsons', [ep(4, 12), ep(5, 2), ep(6, 6)])
const seinfeld = show(1400, 'Seinfeld', [ep(4, 11)])
const shows = { 456: simpsons, 1400: seinfeld }

describe('episodeKey', () => {
  it('is stable and unique per show/season/episode', () => {
    expect(episodeKey(456, ep(4, 12))).toBe('456|s4e12')
    expect(episodeKey(456, ep(4, 12))).not.toBe(episodeKey(1400, ep(4, 12)))
  })
})

describe('poolCounts', () => {
  it('counts liked and unwatched episodes', () => {
    expect(poolCounts(shows, {})).toEqual({ total: 4, unwatched: 4 })
    expect(poolCounts(shows, { '456|s4e12': 1 })).toEqual({ total: 4, unwatched: 3 })
  })

  it('handles empty and missing structures', () => {
    expect(poolCounts({}, {})).toEqual({ total: 0, unwatched: 0 })
    expect(poolCounts(null, null)).toEqual({ total: 0, unwatched: 0 })
    expect(poolCounts({ 1: { id: 1, name: 'x' } }, {})).toEqual({ total: 0, unwatched: 0 })
  })
})

describe('pickEpisode', () => {
  it('returns null with no liked episodes at all', () => {
    expect(pickEpisode({}, {})).toBeNull()
    expect(pickEpisode({ 1: { id: 1, name: 'x', episodes: {} } }, {})).toBeNull()
  })

  it('never returns a watched episode while unwatched ones remain', () => {
    const watched = { '456|s4e12': 1, '456|s5e2': 2, '456|s6e6': 3 }
    for (let i = 0; i < 50; i++) {
      const pick = pickEpisode(shows, watched)
      expect(pick.key).toBe('1400|s4e11')
      expect(pick.recycled).toBe(false)
    }
  })

  it('picks the show first, so a tiny show is not drowned out', () => {
    // Simpsons has 3 liked eps, Seinfeld 1 — show-first means Seinfeld should
    // land about half the time, not a quarter.
    let seinfeldHits = 0
    let n = 0
    const rand = () => {
      // Deterministic pseudo-randomness.
      n = (n * 9301 + 49297) % 233280
      return n / 233280
    }
    for (let i = 0; i < 400; i++) {
      if (pickEpisode(shows, {}, rand).show.id === 1400) seinfeldHits += 1
    }
    expect(seinfeldHits).toBeGreaterThan(120)
    expect(seinfeldHits).toBeLessThan(280)
  })

  it('recycles once everything is watched, avoiding the most recent draws', () => {
    const watched = {
      '456|s4e12': 100,
      '456|s5e2': 200,
      '456|s6e6': 300,
      '1400|s4e11': 400, // most recent
    }
    for (let i = 0; i < 50; i++) {
      const pick = pickEpisode(shows, watched)
      expect(pick.recycled).toBe(true)
      // With 4 total, min(5, total-1) = 3 most recent are excluded — only the
      // earliest watch remains eligible.
      expect(pick.key).toBe('456|s4e12')
    }
  })

  it('recycling a one-episode pool still deals that episode', () => {
    const solo = { 1400: seinfeld }
    const pick = pickEpisode(solo, { '1400|s4e11': 5 })
    expect(pick).not.toBeNull()
    expect(pick.key).toBe('1400|s4e11')
    expect(pick.recycled).toBe(true)
  })

  it('avoids passed-on episodes while alternatives remain', () => {
    // Everything avoided except one — that one must be dealt.
    const avoid = ['456|s4e12', '456|s5e2', '456|s6e6']
    for (let i = 0; i < 30; i++) {
      expect(pickEpisode(shows, {}, Math.random, avoid).key).toBe('1400|s4e11')
    }
  })

  it('avoiding everything falls back to the full pool, not a dead button', () => {
    const avoid = ['456|s4e12', '456|s5e2', '456|s6e6', '1400|s4e11']
    const pick = pickEpisode(shows, {}, Math.random, avoid)
    expect(pick).not.toBeNull()
  })

  it('deals a two-parter whole, and always starting at part one', () => {
    const twoParter = show(1400, 'Seinfeld', [
      ep(4, 1, 'The Trip (1)'),
      ep(4, 2, 'The Trip (2)'),
    ])
    for (let i = 0; i < 30; i++) {
      const pick = pickEpisode({ 1400: twoParter }, {})
      expect(pick.parts).toHaveLength(2)
      expect(pick.ep.name).toBe('The Trip (1)') // never handed the back half
      expect(pick.keys).toEqual(['1400|s4e1', '1400|s4e2'])
      expect(pick.key).toBe('1400|s4e1')
    }
  })

  it('a standalone episode reports itself as a single part', () => {
    const pick = pickEpisode({ 1400: seinfeld }, {})
    expect(pick.parts).toEqual([pick.ep])
    expect(pick.keys).toEqual([pick.key])
  })

  it('rand at the extremes stays in bounds', () => {
    expect(pickEpisode(shows, {}, () => 0)).not.toBeNull()
    expect(pickEpisode(shows, {}, () => 0.999999)).not.toBeNull()
  })
})

describe('drawing from a single show', () => {
  // Requested via the bug button: "It would be nice if there was a way to draw
  // randomly from within a certain subset so I could draw just from a single
  // show."
  const library = {
    simpsons: {
      id: 'simpsons',
      name: 'The Simpsons',
      episodes: {
        a: { season: 4, episode: 12, name: 'Marge vs. the Monorail' },
        b: { season: 5, episode: 2, name: 'Cape Feare' },
      },
    },
    seinfeld: {
      id: 'seinfeld',
      name: 'Seinfeld',
      episodes: {
        c: { season: 4, episode: 11, name: 'The Contest' },
        d: { season: 6, episode: 8, name: 'The Mom & Pop Store' },
      },
    },
  }

  it('counts only the chosen show', () => {
    expect(poolCounts(library, {}).total).toBe(4)
    expect(poolCounts(library, {}, 'seinfeld').total).toBe(2)
  })

  it('only ever deals from the chosen show', () => {
    for (let i = 0; i < 20; i += 1) {
      const pick = pickEpisode(library, {}, () => i / 20, [], 'seinfeld')
      expect(pick.show.id).toBe('seinfeld')
    }
  })

  it('still deals from everything when no show is chosen', () => {
    const seen = new Set()
    for (let i = 0; i < 20; i += 1) {
      seen.add(pickEpisode(library, {}, () => i / 20).show.id)
    }
    expect(seen.size).toBe(2)
  })

  it('scopes the no-repeat exclusion to that show', () => {
    // Seinfeld half-watched: the unwatched one is the only candidate, even
    // though the wider library still has plenty unwatched.
    const watched = { 'seinfeld|s4e11': Date.now() }
    const pick = pickEpisode(library, watched, () => 0, [], 'seinfeld')
    expect(pick.ep.name).toBe('The Mom & Pop Store')
    expect(pick.recycled).toBe(false)
  })

  it('recycles within the show once that show is exhausted', () => {
    // The rest of the library is untouched, so an unscoped draw would not
    // recycle - this proves the lap is per-show, not global.
    const watched = { 'seinfeld|s4e11': 1, 'seinfeld|s6e8': 2 }
    const pick = pickEpisode(library, watched, () => 0, [], 'seinfeld')
    expect(pick.show.id).toBe('seinfeld')
    expect(pick.recycled).toBe(true)
    expect(pickEpisode(library, watched, () => 0).recycled).toBe(false)
  })

  it('returns null for a show with nothing ticked', () => {
    const withEmpty = { ...library, ghost: { id: 'ghost', name: 'Ghosts', episodes: {} } }
    expect(pickEpisode(withEmpty, {}, () => 0, [], 'ghost')).toBeNull()
  })

  it('keeps the scope when it has to drop the just-passed exclusion', () => {
    // Both Seinfeld episodes passed on: rather than going dead, it deals one
    // of them again - and must not wander into The Simpsons to do it.
    const passed = ['seinfeld|s4e11', 'seinfeld|s6e8']
    const pick = pickEpisode(library, {}, () => 0, passed, 'seinfeld')
    expect(pick.show.id).toBe('seinfeld')
  })
})
