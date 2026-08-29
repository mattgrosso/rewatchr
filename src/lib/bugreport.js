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

const post = async (report) => {
  // The rules require auth != null; the token is the signed-in user's, or a
  // silent anonymous session's for reports filed from the splash.
  const token = await bugReportToken()
  const response = await fetch(`${ENDPOINT}?auth=${encodeURIComponent(token)}`, {
    method: 'POST',
    body: JSON.stringify({ ...report, createdAt: { '.sv': 'timestamp' } }),
  })
  if (!response.ok) throw new Error(`Bug report failed: ${response.status}`)
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

export const buildReport = (transcript, state) => ({
  transcript,
  clientCreatedAt: Date.now(),
  url: window.location.href,
  userAgent: navigator.userAgent,
  viewport: `${window.innerWidth}x${window.innerHeight}`,
  online: navigator.onLine,
  state: JSON.stringify(state),
})

// Send, with the offline-stash fallback. Resolves to 'sent' | 'stashed';
// rejects when online but the write failed (caller keeps the text visible).
export const sendReport = async (transcript, state) => {
  const report = buildReport(transcript, state)
  try {
    await post(report)
    void flushStash()
    return 'sent'
  } catch (error) {
    if (!navigator.onLine) {
      writeStash([...readStash(), report])
      return 'stashed'
    }
    throw error
  }
}
