// Component tests for the two bug-report fixes that live in the editor:
// the whole-show button and the scroll-to-newly-opened-season behaviour.
// Both are pure UI, so they're the part unit tests on lib/ can't reach.
//
// TMDB and the store are both mocked: the point here is what the component
// asks them to do, and the real store would drag Firebase into jsdom.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ShowEditor from '../src/components/ShowEditor.vue'

const SEASONS = [
  { number: 1, name: 'Season 1', episodeCount: 2 },
  { number: 2, name: 'Season 2', episodeCount: 2 },
]
const EPISODES = {
  1: [
    { season: 1, episode: 1, name: 'One', rating: 8 },
    { season: 1, episode: 2, name: 'Two', rating: 7 },
  ],
  2: [
    { season: 2, episode: 1, name: 'Three', rating: 9 },
    { season: 2, episode: 2, name: 'Four', rating: 6 },
  ],
}

const liked = new Set()

vi.mock('../src/lib/tmdb.js', () => ({
  showSeasons: vi.fn(async () => ({ seasons: SEASONS })),
  seasonEpisodes: vi.fn(async (_id, number) => EPISODES[number]),
  img: () => null,
}))

vi.mock('../src/lib/store.js', () => ({
  setEpisodeLiked: vi.fn((_id, ep, on) => {
    const slot = `s${ep.season}e${ep.episode}`
    if (on) liked.add(slot)
    else liked.delete(slot)
  }),
  setEpisodesLiked: vi.fn((_id, eps, on) => {
    for (const ep of eps) {
      const slot = `s${ep.season}e${ep.episode}`
      if (on) liked.add(slot)
      else liked.delete(slot)
    }
  }),
  isEpisodeLiked: (_id, ep) => liked.has(`s${ep.season}e${ep.episode}`),
}))

const { seasonEpisodes } = await import('../src/lib/tmdb.js')
const { setEpisodesLiked } = await import('../src/lib/store.js')

const show = () => ({ id: 1, name: 'Test Show', episodes: {} })

beforeEach(() => {
  liked.clear()
  vi.clearAllMocks()
  window.scrollTo = vi.fn()
})

const mountEditor = async (props = {}) => {
  const wrapper = mount(ShowEditor, { props: { show: show(), ...props }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('the whole-show button', () => {
  it('offers the show by its total episode count before anything is loaded', async () => {
    const wrapper = await mountEditor()
    const button = wrapper.find('.editor__whole-show')
    expect(button.text()).toContain('Add the whole show')
    expect(button.text()).toContain('4') // 2 + 2 from TMDB's season counts
    // Labelling itself must not cost a fetch per season.
    expect(seasonEpisodes).not.toHaveBeenCalled()
  })

  it('likes every episode of every season in one write', async () => {
    const wrapper = await mountEditor()
    await wrapper.find('.editor__whole-show').trigger('click')
    await flushPromises()

    expect(seasonEpisodes).toHaveBeenCalledTimes(2) // both seasons, once each
    expect(setEpisodesLiked).toHaveBeenCalledTimes(1) // one write, not four
    const [, eps, on] = setEpisodesLiked.mock.calls[0]
    expect(on).toBe(true)
    expect(eps).toHaveLength(4)
    expect(liked).toEqual(new Set(['s1e1', 's1e2', 's2e1', 's2e2']))
  })

  it('flips to a clear-it label once the show is fully in', async () => {
    const wrapper = await mountEditor()
    await wrapper.find('.editor__whole-show').trigger('click')
    await flushPromises()
    expect(wrapper.find('.editor__whole-show').text()).toContain('tap to clear it')
  })

  it('clears the show without re-fetching anything', async () => {
    const stocked = {
      id: 1,
      name: 'Test Show',
      episodes: Object.fromEntries(
        Object.values(EPISODES)
          .flat()
          .map((ep) => [`s${ep.season}e${ep.episode}`, ep]),
      ),
    }
    Object.keys(stocked.episodes).forEach((slot) => liked.add(slot))

    const wrapper = await mountEditor({ show: stocked })
    expect(wrapper.find('.editor__whole-show').text()).toContain('tap to clear it')

    await wrapper.find('.editor__whole-show').trigger('click')
    await flushPromises()

    expect(seasonEpisodes).not.toHaveBeenCalled() // the pool already knew
    expect(setEpisodesLiked).toHaveBeenCalledWith(1, expect.any(Array), false)
    expect(liked.size).toBe(0)
  })
})

describe('opening a season', () => {
  it('scrolls the newly opened season up under the top bar', async () => {
    const wrapper = await mountEditor()
    await wrapper.findAll('.editor__season-head')[1].trigger('click')
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(window.scrollTo).toHaveBeenCalled()
    expect(window.scrollTo.mock.calls[0][0]).toMatchObject({ behavior: 'smooth' })
    expect(window.scrollTo.mock.calls[0][0].top).toBeGreaterThanOrEqual(0)
  })

  it('does not scroll when a season is merely being closed', async () => {
    const wrapper = await mountEditor()
    const head = wrapper.findAll('.editor__season-head')[0]
    await head.trigger('click')
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 0))
    vi.clearAllMocks()
    window.scrollTo = vi.fn()

    await head.trigger('click') // same season again = close
    await flushPromises()
    expect(window.scrollTo).not.toHaveBeenCalled()
  })
})
