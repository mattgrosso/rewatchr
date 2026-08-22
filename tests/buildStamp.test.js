import { describe, it, expect } from 'vitest'
import { formatBuildTime, buildStampText, formatVersion } from '../src/lib/buildStamp.js'

// Fixed local-time instants so these don't drift with the clock or the box's
// timezone: constructed from local parts, read back as local.
const localTime = (y, m, d, h, min) => new Date(y, m - 1, d, h, min)
const NOW = localTime(2026, 8, 22, 9, 0)

describe('formatBuildTime', () => {
  it('reads as a person would say it', () => {
    expect(formatBuildTime(localTime(2026, 8, 22, 1, 32), NOW)).toBe('Aug 22, 1:32 AM')
    expect(formatBuildTime(localTime(2026, 8, 22, 13, 5), NOW)).toBe('Aug 22, 1:05 PM')
  })

  it('handles both ends of the 12-hour clock', () => {
    expect(formatBuildTime(localTime(2026, 8, 22, 0, 7), NOW)).toBe('Aug 22, 12:07 AM')
    expect(formatBuildTime(localTime(2026, 8, 22, 12, 0), NOW)).toBe('Aug 22, 12:00 PM')
  })

  it('adds the year only when it is not this one', () => {
    expect(formatBuildTime(localTime(2025, 12, 31, 23, 59), NOW)).toBe('Dec 31, 2025, 11:59 PM')
    expect(formatBuildTime(localTime(2026, 1, 1, 0, 0), NOW)).toBe('Jan 1, 12:00 AM')
  })

  it('accepts the ISO string the build injects', () => {
    const iso = localTime(2026, 8, 22, 1, 32).toISOString()
    expect(formatBuildTime(iso, NOW)).toBe('Aug 22, 1:32 AM')
  })

  it('returns null rather than a lie when there is no usable time', () => {
    expect(formatBuildTime(null, NOW)).toBeNull()
    expect(formatBuildTime(undefined, NOW)).toBeNull()
    expect(formatBuildTime('not a date', NOW)).toBeNull()
    expect(formatBuildTime('', NOW)).toBeNull()
  })
})

describe('formatVersion', () => {
  it('prefixes a semver with v', () => {
    expect(formatVersion('1.0.0')).toBe('v1.0.0')
    expect(formatVersion('1.96.5')).toBe('v1.96.5')
  })

  it('leaves a git sha bare — "va1b2c3d" would be nonsense', () => {
    expect(formatVersion('a1b2c3d')).toBe('a1b2c3d')
    expect(formatVersion('ae3c5ae-dirty')).toBe('ae3c5ae-dirty')
  })

  it('has nothing to say about a missing version', () => {
    expect(formatVersion(null)).toBeNull()
    expect(formatVersion('')).toBeNull()
  })
})

describe('buildStampText', () => {
  it('renders a sha version without the v prefix', () => {
    expect(
      buildStampText({ version: 'a1b2c3d', buildTime: localTime(2026, 8, 22, 1, 32), now: NOW }),
    ).toBe('a1b2c3d · built Aug 22, 1:32 AM')
  })

  it('is the house format: version, then when it was built', () => {
    expect(
      buildStampText({ version: '1.0.0', buildTime: localTime(2026, 8, 22, 1, 32), now: NOW }),
    ).toBe('v1.0.0 · built Aug 22, 1:32 AM')
  })

  it('degrades instead of disappearing', () => {
    expect(buildStampText({ version: '1.0.0', buildTime: null, now: NOW })).toBe('v1.0.0')
    expect(buildStampText({ buildTime: localTime(2026, 8, 22, 1, 32), now: NOW })).toBe(
      'built Aug 22, 1:32 AM',
    )
    expect(buildStampText({ now: NOW })).toBe('')
    expect(buildStampText()).toBe('')
  })
})
