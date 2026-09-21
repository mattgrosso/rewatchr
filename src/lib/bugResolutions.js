// The reply half of the bug button (2026-09-21, ported from Cinema Roll):
// `yarn resolve-bug-report <id> --understood ... --fixed ...` writes a
// plain-language notice under the reporter's uid at bugReportResolutions,
// and BugResolutionNotice.vue shows it once on their next launch. The uid is
// whoever filed the report - the signed-in user, or the silent anonymous
// session lib/bugreport.js minted, which persists on the device. Rules: only
// that uid can read its node; the only client write is flipping `seen`.

import { currentUid, readResolutions, markResolutionsSeen as markSeen } from './firebase.js'

const APP = 'rewatchr'

/** This app's unseen notices, oldest first. */
export const unseenResolutions = (entries, app = APP) =>
  Object.entries(entries || {})
    .filter(([, value]) => value && !value.seen && (!value.app || value.app === app))
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => (a.resolvedAt || 0) - (b.resolvedAt || 0))

export const fetchUnseenResolutions = async () => {
  const uid = currentUid()
  if (!uid) return []
  try {
    return unseenResolutions(await readResolutions(uid))
  } catch {
    // Offline or refused - the notice simply waits for another launch.
    return []
  }
}

export const markResolutionsSeen = async (ids) => {
  const uid = currentUid()
  if (!uid || !ids?.length) return
  try {
    await markSeen(uid, ids)
  } catch {
    // Marked on a later dismissal instead.
  }
}
