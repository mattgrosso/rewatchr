import { describe, it, expect } from 'vitest'
import { mergeData, normalizeData, HISTORY_CAP } from '../src/lib/merge.js'

const showA = {
  id: 456,
  name: 'The Simpsons',
  addedAt: 100,
  episodes: { s4e12: { season: 4, episode: 12, name: 'Marge vs. the Monorail' } },
}

describe('normalizeData', () => {
  it('fills empty structures from nothing', () => {
    expect(normalizeData(null)).toEqual({ shows: {}, watched: {}, history: [] })
    expect(normalizeData(undefined)).toEqual({ shows: {}, watched: {}, history: [] })
    expect(normalizeData('junk')).toEqual({ shows: {}, watched: {}, history: [] })
  })

  it('accepts RTDB-style history objects', () => {
    const raw = { history: { 0: { key: 'a', at: 1 }, 1: { key: 'b', at: 2 } } }
    expect(normalizeData(raw).history).toHaveLength(2)
  })
})

describe('mergeData', () => {
  it('unions shows and their episode sets', () => {
    const left = { shows: { 456: showA } }
    const right = {
      shows: {
        456: {
          ...showA,
          episodes: { s5e2: { season: 5, episode: 2, name: 'Cape Feare' } },
        },
        1400: { id: 1400, name: 'Seinfeld', addedAt: 200, episodes: {} },
      },
    }
    const merged = mergeData(left, right)
    expect(Object.keys(merged.shows)).toHaveLength(2)
    expect(Object.keys(merged.shows[456].episodes).sort()).toEqual(['s4e12', 's5e2'])
  })

  it('keeps the earliest watch timestamp', () => {
    const merged = mergeData({ watched: { k: 500 } }, { watched: { k: 300, other: 900 } })
    expect(merged.watched).toEqual({ k: 300, other: 900 })
  })

  it('keeps the earliest addedAt for a show on both sides', () => {
    const merged = mergeData(
      { shows: { 456: { ...showA, addedAt: 900 } } },
      { shows: { 456: { ...showA, addedAt: 400 } } },
    )
    expect(merged.shows[456].addedAt).toBe(400)
  })

  it('dedupes history by key and time, newest first', () => {
    const a = { history: [{ key: 'x', at: 10 }, { key: 'y', at: 30 }] }
    const b = { history: [{ key: 'x', at: 10 }, { key: 'z', at: 20 }] }
    const merged = mergeData(a, b)
    expect(merged.history.map((h) => h.at)).toEqual([30, 20, 10])
  })

  it('caps history', () => {
    const long = { history: Array.from({ length: 300 }, (_, i) => ({ key: `k${i}`, at: i })) }
    expect(mergeData(long, null).history).toHaveLength(HISTORY_CAP)
  })

  it('a merge with an empty side is the identity', () => {
    const data = { shows: { 456: showA }, watched: { k: 1 }, history: [{ key: 'k', at: 1 }] }
    const merged = mergeData(data, null)
    expect(merged.shows[456].name).toBe('The Simpsons')
    expect(merged.watched).toEqual({ k: 1 })
    expect(merged.history).toHaveLength(1)
  })
})
