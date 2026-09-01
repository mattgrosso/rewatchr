// Component tests for "Not this one — take it out of the pool" (bug report,
// 2026-09-01). The interesting behaviour is the ordering: untick first, THEN
// redraw, so the dropped episode can't be the one that comes back.
//
// TMDB and the store are mocked, same as the ShowEditor tests: the real store
// would drag Firebase into jsdom, and the point here is what the component
// asks the store to do.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import HomeScreen from '../src/components/HomeScreen.vue'

const ep = (season, episode, name) => ({ season, episode, name, still: null, rating: null })

// Two shows so the pool survives a drop and can deal something else.
const initialShows = () => ({
  simpsons: {
    id: 'simpsons',
    name: 'The Simpsons',
    episodes: { s1e1: ep(1, 1, 'One'), s1e2: ep(1, 2, 'Two') },
  },
})

const store = {
  user: { uid: 'u1' },
  shows: initialShows(),
  watched: {},
  history: [],
}

const setEpisodesLiked = vi.fn((showId, eps, liked) => {
  const show = store.shows[showId]
  const episodes = { ...show.episodes }
  for (const e of eps) {
    const slot = `s${e.season}e${e.episode}`
    if (liked) episodes[slot] = e
    else delete episodes[slot]
  }
  store.shows = { ...store.shows, [showId]: { ...show, episodes } }
})

vi.mock('../src/lib/store.js', () => ({
  get store() {
    return store
  },
  markWatched: vi.fn(),
  setEpisodesLiked: (...args) => setEpisodesLiked(...args),
}))

vi.mock('../src/lib/tmdb.js', () => ({
  watchProviders: vi.fn(async () => ({ link: null, flatrate: [] })),
  img: () => null,
}))

const drawAndSettle = async (wrapper) => {
  await wrapper.find('.home__draw').trigger('click')
  await vi.advanceTimersByTimeAsync(700)
  await flushPromises()
}

const pooledSlots = () => Object.keys(store.shows.simpsons.episodes).sort()

beforeEach(() => {
  vi.useFakeTimers()
  store.shows = initialShows()
  store.watched = {}
  store.history = []
  setEpisodesLiked.mockClear()
})

describe('taking an episode out of the pool', () => {
  it('unticks the dealt episode and deals a different one', async () => {
    const wrapper = mount(HomeScreen)
    await drawAndSettle(wrapper)

    const dealt = wrapper.vm.pick
    expect(dealt).toBeTruthy()
    const droppedSlot = `s${dealt.ep.season}e${dealt.ep.episode}`

    await wrapper.find('.result__drop').trigger('click')
    await vi.advanceTimersByTimeAsync(700)
    await flushPromises()

    // Gone from the pool...
    expect(pooledSlots()).not.toContain(droppedSlot)
    // ...and the replacement is a different episode, not the one just dropped.
    expect(wrapper.vm.pick).toBeTruthy()
    expect(`s${wrapper.vm.pick.ep.season}e${wrapper.vm.pick.ep.episode}`).not.toBe(droppedSlot)
  })

  it('offers an undo that puts it back', async () => {
    const wrapper = mount(HomeScreen)
    await drawAndSettle(wrapper)

    const before = pooledSlots()
    await wrapper.find('.result__drop').trigger('click')
    await vi.advanceTimersByTimeAsync(700)
    await flushPromises()
    expect(pooledSlots()).toHaveLength(before.length - 1)

    await wrapper.find('.home__undo').trigger('click')
    expect(pooledSlots()).toEqual(before)
  })

  it('still offers the undo when the drop empties the pool', async () => {
    store.shows = {
      simpsons: { id: 'simpsons', name: 'The Simpsons', episodes: { s1e1: ep(1, 1, 'One') } },
    }
    const wrapper = mount(HomeScreen)
    await drawAndSettle(wrapper)

    await wrapper.find('.result__drop').trigger('click')
    await vi.advanceTimersByTimeAsync(700)
    await flushPromises()

    // No card to hang it on — that's exactly when it's wanted.
    expect(wrapper.vm.pick).toBeNull()
    expect(wrapper.find('.home__undo').exists()).toBe(true)
    await wrapper.find('.home__undo').trigger('click')
    expect(pooledSlots()).toEqual(['s1e1'])
  })

  it('drops a two-parter as one unit', async () => {
    store.shows = {
      simpsons: {
        id: 'simpsons',
        name: 'The Simpsons',
        episodes: {
          s1e1: ep(1, 1, 'Who Shot Mr. Burns (1)'),
          s1e2: ep(1, 2, 'Who Shot Mr. Burns (2)'),
          s2e1: ep(2, 1, 'Something Else'),
        },
      },
    }
    const wrapper = mount(HomeScreen)
    await drawAndSettle(wrapper)

    const parts = wrapper.vm.pick.parts
    await wrapper.find('.result__drop').trigger('click')
    await vi.advanceTimersByTimeAsync(700)
    await flushPromises()

    // Unticking half a two-parter would strand the other half: multipart deals
    // always start at part one, so an orphaned part two can never be drawn.
    for (const part of parts) {
      expect(pooledSlots()).not.toContain(`s${part.season}e${part.episode}`)
    }
  })
})
