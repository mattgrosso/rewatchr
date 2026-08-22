import { describe, it, expect } from 'vitest'
import {
  extractBundleName,
  isSafeMomentForReload,
  shouldAutoAttempt,
} from '../src/lib/appUpdate.js'

describe('extractBundleName', () => {
  it('finds the Vite entry bundle in served html', () => {
    const html = '<script type="module" crossorigin src="/assets/index-C3PWKidO.js"></script>'
    expect(extractBundleName(html)).toBe('assets/index-C3PWKidO.js')
  })

  it('returns null when nothing matches', () => {
    expect(extractBundleName('<html>maintenance page</html>')).toBeNull()
    expect(extractBundleName(null)).toBeNull()
  })
})

describe('isSafeMomentForReload', () => {
  it('is unsafe while typing', () => {
    expect(
      isSafeMomentForReload({ activeElement: { tagName: 'INPUT' }, hasBlockingUi: false }),
    ).toBe(false)
    expect(
      isSafeMomentForReload({ activeElement: { tagName: 'TEXTAREA' }, hasBlockingUi: false }),
    ).toBe(false)
  })

  it('is unsafe while a modal or a dealt episode is up', () => {
    expect(isSafeMomentForReload({ activeElement: null, hasBlockingUi: true })).toBe(false)
  })

  it('is safe on an idle page', () => {
    expect(
      isSafeMomentForReload({ activeElement: { tagName: 'BODY' }, hasBlockingUi: false }),
    ).toBe(true)
    expect(isSafeMomentForReload({ activeElement: null, hasBlockingUi: false })).toBe(true)
  })
})

describe('shouldAutoAttempt', () => {
  const memoryStorage = () => {
    const data = new Map()
    return {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => data.set(k, v),
    }
  }

  it('allows one attempt per target bundle', () => {
    const storage = memoryStorage()
    expect(shouldAutoAttempt('assets/index-AAA.js', storage)).toBe(true)
    expect(shouldAutoAttempt('assets/index-AAA.js', storage)).toBe(false)
  })

  it('a new deploy gets a fresh attempt', () => {
    const storage = memoryStorage()
    expect(shouldAutoAttempt('assets/index-AAA.js', storage)).toBe(true)
    expect(shouldAutoAttempt('assets/index-BBB.js', storage)).toBe(true)
  })

  it('still tries when storage is unavailable', () => {
    const broken = {
      getItem: () => {
        throw new Error('nope')
      },
      setItem: () => {
        throw new Error('nope')
      },
    }
    expect(shouldAutoAttempt('assets/index-AAA.js', broken)).toBe(true)
  })
})
