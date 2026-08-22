import { describe, it, expect } from 'vitest'
import { formatRating, ratingTier } from '../src/lib/rating.js'

describe('formatRating', () => {
  it('shows one decimal', () => {
    expect(formatRating(8.462)).toBe('8.5')
    expect(formatRating(9)).toBe('9.0')
  })

  it('hides missing or unrated', () => {
    expect(formatRating(null)).toBeNull()
    expect(formatRating(undefined)).toBeNull()
    expect(formatRating(0)).toBeNull()
    expect(formatRating('8')).toBeNull()
  })
})

describe('ratingTier', () => {
  it('tiers by TMDB episode-average conventions', () => {
    expect(ratingTier(9.2)).toBe('great')
    expect(ratingTier(8.5)).toBe('great')
    expect(ratingTier(8.1)).toBe('good')
    expect(ratingTier(7.5)).toBe('good')
    expect(ratingTier(6.9)).toBe('meh')
  })

  it('handles missing ratings', () => {
    expect(ratingTier(null)).toBe('none')
    expect(ratingTier(0)).toBe('none')
  })
})
