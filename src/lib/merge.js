// Two-device reconciliation, same philosophy as Every Street's sync: pure,
// tested, and generous — a merge never loses a liked episode or a watch
// record from either side.
//
//   shows:   union; a show present on both sides unions its episode sets
//   watched: union, keeping the EARLIEST timestamp (first watch wins)
//   history: union deduped by (key, at), newest first, capped

export const HISTORY_CAP = 200

const emptyData = () => ({ shows: {}, watched: {}, history: [] })

export const normalizeData = (raw) => {
  const data = emptyData()
  if (!raw || typeof raw !== 'object') return data
  data.shows = raw.shows && typeof raw.shows === 'object' ? raw.shows : {}
  data.watched = raw.watched && typeof raw.watched === 'object' ? raw.watched : {}
  // RTDB may hand an array back as an object with numeric keys.
  data.history = Array.isArray(raw.history)
    ? raw.history.filter(Boolean)
    : Object.values(raw.history || {})
  return data
}

export const mergeData = (a, b) => {
  const left = normalizeData(a)
  const right = normalizeData(b)
  const merged = emptyData()

  for (const source of [left, right]) {
    for (const [id, show] of Object.entries(source.shows)) {
      const existing = merged.shows[id]
      if (!existing) {
        merged.shows[id] = { ...show, episodes: { ...(show.episodes || {}) } }
      } else {
        existing.episodes = { ...(show.episodes || {}), ...existing.episodes }
        existing.addedAt = Math.min(existing.addedAt || Infinity, show.addedAt || Infinity)
      }
    }
    for (const [key, at] of Object.entries(source.watched)) {
      merged.watched[key] = Math.min(merged.watched[key] ?? Infinity, at)
    }
  }

  const seen = new Set()
  merged.history = [...left.history, ...right.history]
    .filter((entry) => {
      const id = `${entry.key}@${entry.at}`
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
    .sort((x, y) => y.at - x.at)
    .slice(0, HISTORY_CAP)

  return merged
}
