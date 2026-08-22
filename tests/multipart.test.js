import { describe, it, expect } from 'vitest'
import { parsePartTitle, multiPartGroup } from '../src/lib/multipart.js'

const ep = (season, episode, name) => ({ season, episode, name })

describe('parsePartTitle', () => {
  it('reads TMDB’s parenthesised parts — the real spelling in Matt’s shows', () => {
    // Verified against live TMDB data for these exact episodes.
    expect(parsePartTitle('The Trip (1)')).toEqual({ base: 'the trip', part: 1 })
    expect(parsePartTitle('The Pilot (2)')).toEqual({ base: 'the pilot', part: 2 })
    expect(parsePartTitle('Mac and Charlie Die (1)')).toEqual({
      base: 'mac and charlie die',
      part: 1,
    })
    expect(parsePartTitle('Palace Intrigue (2)')).toEqual({ base: 'palace intrigue', part: 2 })
  })

  it('reads the "Part N" spellings other shows use', () => {
    expect(parsePartTitle('The Reckoning, Part 1')).toEqual({ base: 'the reckoning', part: 1 })
    expect(parsePartTitle('The Reckoning: Part Two')).toEqual({ base: 'the reckoning', part: 2 })
    expect(parsePartTitle('Homecoming Pt. 2')).toEqual({ base: 'homecoming', part: 2 })
    expect(parsePartTitle('Fallout Part III')).toEqual({ base: 'fallout', part: 3 })
  })

  it('leaves ordinary titles alone', () => {
    expect(parsePartTitle('The Contest')).toBeNull()
    expect(parsePartTitle('Arrival/Departure')).toBeNull() // a slash is not a part
    expect(parsePartTitle('The Gang Solves the Gas Crisis')).toBeNull()
    expect(parsePartTitle(null)).toBeNull()
    expect(parsePartTitle(undefined)).toBeNull()
  })

  it('does not mistake a year for a part number', () => {
    expect(parsePartTitle('Reunion (1998)')).toBeNull()
  })
})

describe('multiPartGroup', () => {
  const seinfeldS4 = [
    ep(4, 1, 'The Trip (1)'),
    ep(4, 2, 'The Trip (2)'),
    ep(4, 11, 'The Contest'),
    ep(4, 23, 'The Pilot (1)'),
    ep(4, 24, 'The Pilot (2)'),
  ]

  it('deals both halves when either half is drawn', () => {
    expect(multiPartGroup(seinfeldS4, seinfeldS4[0]).map((e) => e.episode)).toEqual([1, 2])
    expect(multiPartGroup(seinfeldS4, seinfeldS4[1]).map((e) => e.episode)).toEqual([1, 2])
  })

  it('keeps separate two-parters separate', () => {
    expect(multiPartGroup(seinfeldS4, seinfeldS4[3]).map((e) => e.episode)).toEqual([23, 24])
  })

  it('returns a standalone episode by itself', () => {
    expect(multiPartGroup(seinfeldS4, seinfeldS4[2])).toEqual([seinfeldS4[2]])
  })

  it('does not invent a partner when only one half is liked', () => {
    const onlyPartOne = [ep(4, 1, 'The Trip (1)'), ep(4, 11, 'The Contest')]
    expect(multiPartGroup(onlyPartOne, onlyPartOne[0])).toEqual([onlyPartOne[0]])
  })

  it('spans a season break, the way a finale/premiere pair does', () => {
    const cliffhanger = [ep(3, 24, 'The Reckoning (1)'), ep(4, 1, 'The Reckoning (2)')]
    expect(multiPartGroup(cliffhanger, cliffhanger[0])).toHaveLength(2)
  })

  it('does not glue together a title the show reused years later', () => {
    const reused = [
      ep(2, 5, 'The Trial (1)'),
      ep(2, 6, 'The Trial (2)'),
      ep(8, 14, 'The Trial (1)'),
      ep(8, 15, 'The Trial (2)'),
    ]
    const early = multiPartGroup(reused, reused[0])
    expect(early.map((e) => `${e.season}-${e.episode}`)).toEqual(['2-5', '2-6'])
    const late = multiPartGroup(reused, reused[3])
    expect(late.map((e) => `${e.season}-${e.episode}`)).toEqual(['8-14', '8-15'])
  })

  it('refuses to pair halves that aired seasons apart', () => {
    // The nearest-match rule alone can't save this one: part one is only
    // liked from the early run and part two only from the later reuse, so
    // the closest candidate for each really is six seasons from the other.
    // Pairing them would deal a story that doesn't exist.
    const strandedHalves = [ep(2, 5, 'The Trial (1)'), ep(8, 15, 'The Trial (2)')]
    expect(multiPartGroup(strandedHalves, strandedHalves[0])).toEqual([strandedHalves[0]])
    expect(multiPartGroup(strandedHalves, strandedHalves[1])).toEqual([strandedHalves[1]])
  })

  it('handles a three-parter in order', () => {
    const trilogy = [
      ep(5, 10, 'Endgame (2)'),
      ep(5, 9, 'Endgame (1)'),
      ep(5, 11, 'Endgame (3)'),
    ]
    expect(multiPartGroup(trilogy, trilogy[0]).map((e) => e.episode)).toEqual([9, 10, 11])
  })

  it('survives an empty or missing pool', () => {
    const solo = ep(1, 1, 'The Trip (1)')
    expect(multiPartGroup([], solo)).toEqual([solo])
    expect(multiPartGroup(null, solo)).toEqual([solo])
  })
})
