import { describe, it, expect, vi, afterEach } from 'vitest'
import { img, isAddOnChannel, watchProviders } from '../src/lib/tmdb.js'

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

// Bug report, 2026-10-26: "HBO Max on Amazon" isn't somewhere you can watch,
// it's another subscription to buy. Names are TMDB's own, odd casing and all.
describe('isAddOnChannel', () => {
  it('spots add-ons resold through another store', () => {
    expect(isAddOnChannel('HBO Max Amazon Channel')).toBe(true)
    expect(isAddOnChannel('ALLBLK Amazon channel ')).toBe(true)
    expect(isAddOnChannel('Britbox Apple TV channel')).toBe(true)
    expect(isAddOnChannel('BBC Select Apple Tv channel')).toBe(true)
    expect(isAddOnChannel('AMC+ Roku Premium Channel')).toBe(true)
    expect(isAddOnChannel('Outside TV Features Amzon Channel')).toBe(true)
  })

  it('keeps real services, including ones with "Channel" in the name', () => {
    for (const name of [
      'Amazon Prime Video',
      'HBO Max',
      'Apple TV',
      'The Roku Channel',
      'Criterion Channel',
      'Science Channel',
      'Plex Channel',
    ]) {
      expect(isAddOnChannel(name)).toBe(false)
    }
  })
})

describe('watchProviders', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('drops add-on channels from the streaming list', async () => {
    const flatrate = [
      { provider_name: 'HBO Max', logo_path: '/hbo.png' },
      { provider_name: 'HBO Max Amazon Channel', logo_path: '/hbo-amzn.png' },
      { provider_name: 'Amazon Prime Video', logo_path: '/prime.png' },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ results: { US: { link: 'https://tmdb/watch', flatrate } } }),
      })),
    )
    expect(await watchProviders(1)).toEqual({
      link: 'https://tmdb/watch',
      flatrate: [
        { name: 'HBO Max', logo: '/hbo.png' },
        { name: 'Amazon Prime Video', logo: '/prime.png' },
      ],
    })
  })
})
