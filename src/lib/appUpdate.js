// New-version auto-reload, ported from Cinema Roll (its src/utils/appUpdate.js
// and the App.vue wiring). The page should quietly become the new build soon
// after a deploy — without ever yanking itself out from under the user (the
// July 2026 Cinema Roll lesson: an unconditional reload-on-update broke a
// long-running operation mid-run).
//
// Detection doesn't trust service-worker lifecycle hooks (with autoUpdate the
// new worker activates immediately and the classic `updated` hook is a race).
// Instead it compares deploys directly: fetch index.html with a cache-busting
// param, read the entry bundle filename out of it, and compare against the
// bundle THIS page actually loaded. Vite's hashed `assets/index-*.js` makes
// the filename a version fingerprint.
//
// Applying is polite: one attempt per detected bundle (sessionStorage guard,
// so a stuck worker can't reload-loop), immediately if the app was opened or
// foregrounded moments ago, otherwise only after a 25s quiet stretch — and
// never while an input is focused, a modal is open, or a dealt episode is on
// screen (the deal lives only in memory; a reload would eat it).

const BUNDLE_RE = /assets\/index-[A-Za-z0-9_-]+\.js/
const ATTEMPT_KEY = 'rewatchr.auto-update-attempted-for'
const FRESH_MS = 5000
const QUIET_MS = 25000
const POLL_MS = 5000
const CHECK_INTERVAL_MS = 30 * 60 * 1000

export const extractBundleName = (html) => html?.match?.(BUNDLE_RE)?.[0] ?? null

export const currentBundleName = (doc = document) => {
  for (const script of doc.querySelectorAll('script[src]')) {
    const match = (script.getAttribute('src') || '').match(BUNDLE_RE)
    if (match) return match[0]
  }
  return null
}

// Is RIGHT NOW a safe moment to reload out from under the user?
export const isSafeMomentForReload = ({
  activeElement = document.activeElement,
  hasBlockingUi = Boolean(document.querySelector('.modal-backdrop, .result')),
} = {}) => {
  const tag = activeElement?.tagName || ''
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return false
  if (hasBlockingUi) return false
  return true
}

// One auto-attempt per detected target bundle, ever — if the reload doesn't
// actually land on the new version, do nothing rather than loop.
export const shouldAutoAttempt = (targetBundle, storage) => {
  const store = storage ?? window.sessionStorage
  try {
    if (store.getItem(ATTEMPT_KEY) === targetBundle) return false
    store.setItem(ATTEMPT_KEY, targetBundle)
    return true
  } catch {
    return true // storage unavailable: still better to try once than never
  }
}

// Waits until no service worker install is in flight, so the reload lands on
// the NEW app instead of a mixed old/new state. Capped; failures never block.
export const waitForNewWorker = async (timeoutMs = 15000) => {
  try {
    const registration = await navigator.serviceWorker?.getRegistration?.()
    if (!registration) return
    await registration.update().catch(() => {})
    const deadline = Date.now() + timeoutMs
    while ((registration.installing || registration.waiting) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  } catch {
    // Any surprise here must never eat the reload itself.
  }
}

export const setupAutoUpdate = () => {
  if (!import.meta.env.PROD) return

  let lastActivityAt = Date.now()
  let lastBecameVisibleAt = Date.now()
  let pollTimer = null
  let checking = false

  const reloadForUpdate = async () => {
    await waitForNewWorker()
    window.location.reload()
  }

  const armAutoUpdate = (targetBundle) => {
    if (!shouldAutoAttempt(targetBundle)) return

    const fresh = Date.now() - lastBecameVisibleAt < FRESH_MS
    if (fresh && isSafeMomentForReload()) {
      void reloadForUpdate()
      return
    }

    if (pollTimer) clearInterval(pollTimer)
    pollTimer = setInterval(() => {
      const quiet = Date.now() - lastActivityAt > QUIET_MS
      if (quiet && isSafeMomentForReload()) {
        clearInterval(pollTimer)
        pollTimer = null
        void reloadForUpdate()
      }
    }, POLL_MS)
  }

  const checkForUpdate = async () => {
    if (checking) return
    checking = true
    try {
      // Nudge the service worker too; harmless if there's nothing new.
      const registration = await navigator.serviceWorker?.getRegistration?.()
      await registration?.update()?.catch?.(() => {})

      const running = currentBundleName()
      if (!running) return
      // The cache-busting param matters: it misses the precache entry and so
      // goes to the network, which is the point.
      const response = await fetch(`/index.html?updateCheck=${Date.now()}`, { cache: 'no-store' })
      if (!response.ok) return
      const deployed = extractBundleName(await response.text())
      if (deployed && deployed !== running) armAutoUpdate(deployed)
    } catch {
      // Offline or blocked — try again on the next trigger.
    } finally {
      checking = false
    }
  }

  // visibilitychange alone is unreliable on iOS PWAs; pageshow and focus are
  // more consistent, and the interval backstops all three.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      lastBecameVisibleAt = Date.now()
      void checkForUpdate()
    }
  })
  window.addEventListener('pageshow', () => {
    lastBecameVisibleAt = Date.now()
    void checkForUpdate()
  })
  window.addEventListener('focus', () => void checkForUpdate())
  window.addEventListener('online', () => void checkForUpdate())
  setInterval(() => void checkForUpdate(), CHECK_INTERVAL_MS)

  const noteActivity = () => {
    lastActivityAt = Date.now()
  }
  for (const eventName of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']) {
    window.addEventListener(eventName, noteActivity, { passive: true })
  }

  void checkForUpdate()
}
