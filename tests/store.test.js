import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Opening straight into the app (2026-11-05). Rewatchr used to sit on
// "Warming up…" until Firebase Auth answered, though the shows were already
// cached on the phone. Now it remembers who was signed in, shows their
// cached shows at once, and lets Auth confirm in the background.
const fetchUserData = vi.fn()
const writeUserData = vi.fn()
vi.mock('../src/lib/firebase.js', () => ({
  fetchUserData: (uid) => fetchUserData(uid),
  writeUserData: (uid, data) => writeUserData(uid, data),
}))

const { store, startFromCache, loadForUser, clearUser, addShow } = await import('../src/lib/store.js')

const MATT = { uid: 'uid-matt', email: 'matt@example.com', name: 'Matt', photo: null }
const SAM = { uid: 'uid-sam', email: 'sam@example.com', name: 'Sam', photo: null }
const show = (id, name) => ({ id, name, poster: null, addedAt: 1, episodes: {} })
const cache = (uid, shows) =>
  localStorage.setItem(`rewatchr.data.${uid}`, JSON.stringify({ shows, watched: {}, history: [] }))
const remember = (user) => localStorage.setItem('rewatchr.lastUser', JSON.stringify(user))

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  clearUser()
  fetchUserData.mockReset()
  fetchUserData.mockResolvedValue(null)
  writeUserData.mockReset()
  writeUserData.mockResolvedValue()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('opening the app', () => {
  it('shows the last signed-in person their cached shows before Auth answers', () => {
    remember(MATT)
    cache(MATT.uid, { 1: show(1, 'Seinfeld') })
    expect(startFromCache()).toBe(true)
    expect(store.user.uid).toBe(MATT.uid)
    expect(store.shows[1].name).toBe('Seinfeld')
    expect(store.confirmed).toBe(false)
  })

  it('waits for Auth as before on a browser nobody has signed in on', () => {
    expect(startFromCache()).toBe(false)
    expect(store.user).toBe(null)
  })

  it('remembers whoever Auth confirms, for next time', async () => {
    await loadForUser(MATT)
    expect(JSON.parse(localStorage.getItem('rewatchr.lastUser')).uid).toBe(MATT.uid)
  })
})

describe('Auth confirming in the background', () => {
  it('sends nothing to the cloud until Auth confirms', async () => {
    remember(MATT)
    cache(MATT.uid, {})
    startFromCache()
    addShow({ id: 2, name: 'Archer' })
    await vi.advanceTimersByTimeAsync(5000)
    expect(writeUserData).not.toHaveBeenCalled()
    // ...but the edit is safe on the phone.
    expect(JSON.parse(localStorage.getItem(`rewatchr.data.${MATT.uid}`)).shows[2].name).toBe('Archer')
  })

  it('same person: keeps edits made before confirming, merges the cloud copy, then pushes', async () => {
    remember(MATT)
    cache(MATT.uid, { 1: show(1, 'Seinfeld') })
    startFromCache()
    addShow({ id: 2, name: 'Archer' })
    fetchUserData.mockResolvedValue({ shows: { 3: show(3, 'Louie') }, watched: {}, history: [] })
    await loadForUser(MATT)
    expect(Object.keys(store.shows).sort()).toEqual(['1', '2', '3'])
    expect(store.confirmed).toBe(true)
    await vi.advanceTimersByTimeAsync(5000)
    expect(writeUserData).toHaveBeenCalledTimes(1)
    expect(Object.keys(writeUserData.mock.calls[0][1].shows).sort()).toEqual(['1', '2', '3'])
  })

  it('signed out (elsewhere, or expired): back to sign-in, and not remembered next launch', async () => {
    remember(MATT)
    cache(MATT.uid, { 1: show(1, 'Seinfeld') })
    startFromCache()
    addShow({ id: 2, name: 'Archer' })
    clearUser()
    expect(store.user).toBe(null)
    expect(store.shows).toEqual({})
    await vi.advanceTimersByTimeAsync(5000)
    expect(writeUserData).not.toHaveBeenCalled()
    expect(startFromCache()).toBe(false)
  })

  it('someone else: switches to their shows and remembers them instead', async () => {
    remember(MATT)
    cache(MATT.uid, { 1: show(1, 'Seinfeld') })
    cache(SAM.uid, { 5: show(5, 'Community') })
    startFromCache()
    await loadForUser(SAM)
    expect(store.user.uid).toBe(SAM.uid)
    expect(Object.keys(store.shows)).toEqual(['5'])
    await vi.advanceTimersByTimeAsync(5000)
    expect(writeUserData.mock.calls.map((c) => c[0])).toEqual([SAM.uid])
    expect(JSON.parse(localStorage.getItem('rewatchr.lastUser')).uid).toBe(SAM.uid)
  })
})

describe('Firebase setup', () => {
  const source = readFileSync(resolve(__dirname, '../src/lib/firebase.js'), 'utf8')

  it('loads the sign-in popup machinery only when signing in, not at startup', () => {
    expect(source).not.toMatch(/^\s*getAuth,$/m)
    expect(source).toMatch(/initializeAuth\(app, \{[^}]*persistence/)
    expect(source).not.toMatch(/initializeAuth\(app, \{[^}]*popupRedirectResolver/)
    expect(source).toMatch(/signInWithPopup\(auth, new GoogleAuthProvider\(\), browserPopupRedirectResolver\)/)
  })

  it('keeps the same places a sign-in is saved, so nobody is signed out by the change', () => {
    expect(source).toMatch(/persistence: \[indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence\]/)
  })
})
