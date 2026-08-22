// Detecting two-parters, so the app deals them together.
//
// Bug report (Matt, 2026-08-22): "The app should try to identify multi-part
// episodes and recommend them together." Handing out "The Trip (2)" on its
// own is a bad lunchtime: you either watch the back half of a story or you
// go hunting for the front half yourself.
//
// TMDB's naming is the signal, and it is remarkably consistent — checked
// against the shows actually in Matt's pool, every one uses the same shape:
// Seinfeld "The Trip (1)/(2)", "The Pilot (1)/(2)", "The Finale (1)/(2)";
// Always Sunny "Mac and Charlie Die (1)/(2)"; Archer "Palace Intrigue
// (1)/(2)". The "Part N" spelling is supported too for shows that use it.
//
// Grouping only ever considers episodes already in the pool: we hold no
// data about episodes that were never liked, and pulling in an unliked
// half would be putting words in Matt's mouth.

const WORD_PARTS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6,
}

const partNumber = (token) => {
  if (/^\d{1,2}$/.test(token)) return Number(token)
  return WORD_PARTS[token.toLowerCase()] ?? null
}

// Trailing punctuation varies ("The Trip", "The Trip:"), so the base title
// is normalized before titles are compared.
const normalizeBase = (text) =>
  text.trim().replace(/[\s:,;–—-]+$/, '').replace(/\s+/g, ' ').toLowerCase()

// "The Trip (1)" -> { base: 'the trip', part: 1 }; null when not a part.
// A year in parentheses can't match: it caps at two digits.
export const parsePartTitle = (name) => {
  if (typeof name !== 'string') return null
  const trimmed = name.trim()

  const parens = trimmed.match(/^(.+?)\s*\((\d{1,2})\)$/)
  if (parens) return { base: normalizeBase(parens[1]), part: Number(parens[2]) }

  const worded = trimmed.match(/^(.+?)[\s,:;–—-]+(?:part|pt\.?)\s*([a-z]+|\d{1,2})$/i)
  if (worded) {
    const part = partNumber(worded[2])
    if (part) return { base: normalizeBase(worded[1]), part }
  }
  return null
}

// Two episodes that could plausibly be halves of one story. Same season and
// close together, or straddling a season break (finale then premiere) —
// the gap tolerance leaves room for a part that simply wasn't liked.
const airsAdjacent = (a, b) => {
  if (a.season === b.season) return Math.abs(a.episode - b.episode) <= 3
  if (Math.abs(a.season - b.season) !== 1) return false
  const later = a.season < b.season ? b : a
  return later.episode <= 3
}

// Keep only the unbroken run of parts containing the picked episode, so a
// long-running show that reuses a title years later can't glue the two
// occurrences into one "multi-parter".
const contiguousRunAround = (ordered, picked) => {
  const at = ordered.indexOf(picked)
  let first = at
  let last = at
  while (first > 0 && airsAdjacent(ordered[first - 1], ordered[first])) first -= 1
  while (last < ordered.length - 1 && airsAdjacent(ordered[last], ordered[last + 1])) last += 1
  return ordered.slice(first, last + 1)
}

// Returns the parts of `picked`'s story in order, or just [picked] when it
// isn't a multi-parter. `episodes` is the show's liked pool.
export const multiPartGroup = (episodes, picked) => {
  const parsed = parsePartTitle(picked?.name)
  if (!parsed) return [picked]

  // One episode per part number: whichever aired nearest the picked one,
  // which is what disambiguates a reused title.
  const distance = (ep) =>
    Math.abs(ep.season - picked.season) * 1000 + Math.abs(ep.episode - picked.episode)
  const byPart = new Map([[parsed.part, picked]])
  for (const ep of episodes || []) {
    const other = parsePartTitle(ep.name)
    if (!other || other.base !== parsed.base || other.part === parsed.part) continue
    const held = byPart.get(other.part)
    if (!held || distance(ep) < distance(held)) byPart.set(other.part, ep)
  }
  if (byPart.size < 2) return [picked]

  const ordered = [...byPart.entries()].sort(([a], [b]) => a - b).map(([, ep]) => ep)
  const run = contiguousRunAround(ordered, picked)
  return run.length > 1 ? run : [picked]
}
