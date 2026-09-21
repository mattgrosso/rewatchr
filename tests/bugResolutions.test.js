import { describe, it, expect } from 'vitest'
import { unseenResolutions } from '../src/lib/bugResolutions.js'

// The reply half of the bug button (2026-09-21): notices live in a node
// that could be shared, so this shows only this app's, only the unseen
// ones, oldest first.
describe('unseenResolutions', () => {
  const entries = {
    a: { app: 'rewatchr', understood: 'x', fixed: 'y', resolvedAt: 300, seen: false },
    b: { app: 'rewatchr', understood: 'x', fixed: 'y', resolvedAt: 100, seen: true },
    c: { app: 'another-app', understood: 'x', fixed: 'y', resolvedAt: 200, seen: false },
    d: { understood: 'legacy', fixed: 'no app named', resolvedAt: 50, seen: false },
    e: null,
  }

  it("keeps this app's unseen notices, oldest first, and carries the id", () => {
    expect(unseenResolutions(entries).map((n) => n.id)).toEqual(['d', 'a'])
  })

  it("never shows another app's notice", () => {
    expect(unseenResolutions(entries, 'another-app').map((n) => n.id)).toEqual(['d', 'c'])
  })

  it('is empty for nothing', () => {
    expect(unseenResolutions(null)).toEqual([])
  })
})
