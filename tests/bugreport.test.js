import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// The token helper is the one piece of Firebase this module touches.
const getToken = vi.fn()
vi.mock('../src/lib/firebase.js', () => ({
  bugReportToken: (options) => getToken(options),
}))

const { buildReport, sendReport, flushStash } = await import('../src/lib/bugreport.js')

const STASH_KEY = 'rewatchr.pendingBugReports'
const stashed = () => JSON.parse(localStorage.getItem(STASH_KEY) ?? '[]')

const ok = () => ({ ok: true, text: async () => '' })
const denied = () => ({
  ok: false,
  status: 401,
  text: async () => '{\n  "error" : "Permission denied"\n}',
})

beforeEach(() => {
  localStorage.clear()
  getToken.mockReset()
  getToken.mockResolvedValue('token-abc')
  vi.stubGlobal('fetch', vi.fn())
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('buildReport', () => {
  it('clamps both fields to the caps the database rules enforce', () => {
    const report = buildReport('x'.repeat(6000), { blob: 'y'.repeat(20000) })
    expect(report.transcript).toHaveLength(5000)
    expect(report.state).toHaveLength(10000)
    // The rules refuse anything longer, and refuse it as an unattributable
    // 401 — clamping is what keeps the payload from being a suspect.
    expect(report.transcript.endsWith('…')).toBe(true)
  })

  it('leaves reports that already fit alone', () => {
    const report = buildReport('the button did nothing', { screen: 'home' })
    expect(report.transcript).toBe('the button did nothing')
    expect(report.state).toBe('{"screen":"home"}')
  })
})

describe('sendReport', () => {
  it('sends with a cached token and reports success', async () => {
    fetch.mockResolvedValue(ok())
    await expect(sendReport('it broke', {})).resolves.toBe('sent')
    expect(getToken).toHaveBeenCalledWith({ fresh: false })
    expect(stashed()).toEqual([])
  })

  it('retries a 401 once with a force-refreshed token', async () => {
    fetch.mockResolvedValueOnce(denied()).mockResolvedValueOnce(ok())
    await expect(sendReport('it broke', {})).resolves.toBe('sent')
    expect(getToken).toHaveBeenNthCalledWith(1, { fresh: false })
    expect(getToken).toHaveBeenNthCalledWith(2, { fresh: true })
  })

  it('surfaces the database’s own words when the retry fails too', async () => {
    fetch.mockResolvedValue(denied())
    await expect(sendReport('it broke', {})).rejects.toThrow(
      'Bug report failed: 401 — Permission denied',
    )
  })

  it('keeps a failed report even when online, and says so', async () => {
    fetch.mockResolvedValue(denied())
    await expect(sendReport('it broke', {})).rejects.toMatchObject({ stashed: true })
    expect(stashed()).toHaveLength(1)
    expect(stashed()[0].transcript).toBe('it broke')
  })

  it('does not stash the same text twice across retries', async () => {
    fetch.mockResolvedValue(denied())
    await expect(sendReport('it broke', {})).rejects.toThrow()
    await expect(sendReport('it broke', {})).rejects.toThrow()
    expect(stashed()).toHaveLength(1)
  })

  it('clears the stashed copy once the same text finally lands', async () => {
    fetch.mockResolvedValue(denied())
    await expect(sendReport('it broke', {})).rejects.toThrow()
    fetch.mockResolvedValue(ok())
    await expect(sendReport('it broke', {})).resolves.toBe('sent')
    expect(stashed()).toEqual([])
  })

  it('stashes quietly when offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    fetch.mockRejectedValue(new Error('offline'))
    await expect(sendReport('it broke', {})).resolves.toBe('stashed')
    expect(stashed()).toHaveLength(1)
  })
})

describe('flushStash', () => {
  it('sends what a previous failure held on to', async () => {
    fetch.mockResolvedValue(denied())
    await expect(sendReport('filed on the old build', {})).rejects.toThrow()

    fetch.mockResolvedValue(ok())
    await flushStash()
    expect(stashed()).toEqual([])
  })
})
