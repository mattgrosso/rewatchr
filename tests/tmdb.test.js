import { describe, it, expect } from 'vitest'
import { img } from '../src/lib/tmdb.js'

describe('img', () => {
  it('builds TMDB image URLs', () => {
    expect(img('/abc.jpg', 'w500')).toBe('https://image.tmdb.org/t/p/w500/abc.jpg')
    expect(img('/abc.jpg')).toBe('https://image.tmdb.org/t/p/w300/abc.jpg')
  })

  it('passes null through for missing art', () => {
    expect(img(null)).toBeNull()
    expect(img(undefined)).toBeNull()
    expect(img('')).toBeNull()
  })
})
