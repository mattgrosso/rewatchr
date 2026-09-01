// In-app bug reporting, the hub-standard pattern (Cinema Roll -> Meal Hat ->
// Thunderstoner -> Blockout -> Every Street): a small always-visible button,
// a plain textarea, and a write-only Firebase node read back by a CLI script.
//
// Unlike the newer apps, Rewatchr has its own Firebase project, so reports go
// to its own `bugReports` node (write-only under database.rules.json). Triage
// with `yarn fetch-bug-reports`.

import { bugReportToken } from './firebase.js'

const ENDPOINT = 'https://rewatchr-85473-default-rtdb.firebaseio.com/bugReports.json'

const STASH_KEY = 'rewatchr.pendingBugReports'
const STASH_LIMIT = 10

const readStash = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STASH_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeStash = (reports) => {
  try {
    localStorage.setItem(STASH_KEY, JSON.stringify(reports.slice(-STASH_LIMIT)))
  } catch {
    // Storage full or blocked; a best-effort stash has nothing more to do.
  }
}

// The Realtime Database answers EVERY refused write with the same opaque
// `401 {"error":"Permission denied"}` — no token, an expired token, and a
// `.validate` rejection are indistinguishable from out here. That ambiguity
// is what made the 401 of 2026-09-01 so slow to pin down, so this module now
// removes the causes it can and names the ones it can't.
const describeFailure = (status, body) => {
  let detail = body?.trim() ?? ''
  try {
    detail = JSON.parse(detail)?.error ?? detail
  } catch {
    // Not JSON — the raw body is still better than nothing.
  }
  return `Bug report failed: ${status}${detail ? ` — ${detail}` : ''}`
}

const attempt = async (report, { freshToken }) => {
  // The rules require auth != null; the token is the signed-in user's, or a
  // silent anonymous session's for reports filed from the splash.
  const token = await bugReportToken({ fresh: freshToken })
  const response = await fetch(`${ENDPOINT}?auth=${encodeURIComponent(token)}`, {
    method: 'POST',
    body: JSON.stringify({ ...report, createdAt: { '.sv': 'timestamp' } }),
  })
  if (response.ok) return
  const error = new Error(describeFailure(response.status, await response.text().catch(() => '')))
  error.status = response.status
  throw error
}

const post = async (report) => {
  try {
    await attempt(report, { freshToken: false })
  } catch (error) {
    // A stale token is the one half of that 401 we can do something about:
    // `getIdToken()` hands back a cached token until it is nearly expired, and
    // a PWA resumed after hours in the background is exactly where that goes
    // wrong. Spend one forced refresh before believing the refusal.
    if (error.status !== 401) throw error
    await attempt(report, { freshToken: true })
  }
}

export const flushStash = async () => {
  const stash = readStash()
  if (!stash.length || !navigator.onLine) return
  let sent = 0
  for (const report of stash) {
    try {
      await post(report)
      sent += 1
    } catch {
      break // Still unreachable - keep the rest for next time.
    }
  }
  if (sent) writeStash(stash.slice(sent))
}

// Mirrors the caps in database.rules.json. They necessarily live in two
// places, so clamp here rather than hand the rules something they will refuse:
// an oversize field comes back as the same unattributable 401 as a missing
// token, and a truncated report still says what happened.
const MAX_TRANSCRIPT = 5000
const MAX_STATE = 10000

const clamp = (value, limit) => (value.length <= limit ? value : `${value.slice(0, limit - 1)}…`)

export const buildReport = (transcript, state) => {
  const serialized = JSON.stringify(state)
  return {
    transcript: clamp(transcript, MAX_TRANSCRIPT),
    clientCreatedAt: Date.now(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    online: navigator.onLine,
    state: typeof serialized === 'string' ? clamp(serialized, MAX_STATE) : undefined,
  }
}

// Send, stashing whatever doesn't land. Resolves to 'sent' | 'stashed';
// rejects when online but the write failed — and even then the report is in
// the stash, so the caller reports the error rather than the loss.
export const sendReport = async (transcript, state) => {
  const report = buildReport(transcript, state)
  try {
    await post(report)
    // Drop any earlier stashed copy of the same text: a retry after a visible
    // failure would otherwise file it twice.
    const others = readStash().filter((stashed) => stashed.transcript !== report.transcript)
    if (others.length !== readStash().length) writeStash(others)
    void flushStash()
    return 'sent'
  } catch (error) {
    // The typed text exists nowhere else, so it gets stashed whatever went
    // wrong — offline was only ever the obvious case, and a permissions 401
    // used to drop the report on the floor.
    const stash = readStash()
    if (!stash.some((stashed) => stashed.transcript === report.transcript)) {
      writeStash([...stash, report])
    }
    if (!navigator.onLine) return 'stashed'
    error.stashed = true
    throw error
  }
}
