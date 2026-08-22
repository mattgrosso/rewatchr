// TMDB community episode scores (0–10), formatted for the picker so the
// classics jump out at a glance. Tier thresholds are tuned to episode
// averages, which run hot: on TMDB an all-timer sits ~8.5+, a solidly liked
// episode ~7.5+, and anything under that is background noise.

export const formatRating = (rating) =>
  typeof rating === 'number' && rating > 0 ? rating.toFixed(1) : null

export const ratingTier = (rating) => {
  if (typeof rating !== 'number' || rating <= 0) return 'none'
  if (rating >= 8.5) return 'great'
  if (rating >= 7.5) return 'good'
  return 'meh'
}
