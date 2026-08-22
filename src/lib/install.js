// Add-to-home-screen, ported from the hub apps (Thunderstoner -> Blockout ->
// Every Street) so every app behaves the same way.
//
// There is no single API for this. Android/Chrome fires
// `beforeinstallprompt`, which can be captured and replayed for a genuine
// one-tap install. iOS Safari has no JS hook at all — Apple keeps "Add to
// Home Screen" a manual Share-sheet action on purpose — so the closest a page
// can get is showing exactly which taps to make.

import { reactive } from 'vue'

export const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)

// `navigator.standalone` is iOS Safari's own non-standard flag for "launched
// from a home-screen icon"; matchMedia covers everything else.
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true

let deferred = null

export const installState = reactive({
  available: false,
  showIosSteps: false,
})

export const promptInstall = async () => {
  if (deferred) {
    await deferred.prompt()
    await deferred.userChoice
    deferred = null
    installState.available = false
  } else if (isIos()) {
    installState.showIosSteps = true
  }
}

export const setupInstall = () => {
  if (isStandalone()) return

  // Set by a link like rewatchr-85473.web.app/?install=1 — skips straight to
  // the install flow rather than making people hunt for the button.
  const wantsAutoInstall = new URLSearchParams(window.location.search).get('install') === '1'

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event
    installState.available = true
    if (wantsAutoInstall) void promptInstall()
  })

  if (isIos()) {
    installState.available = true
    if (wantsAutoInstall) installState.showIosSteps = true
  }
}
