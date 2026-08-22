<script setup>
// Per-show episode picker: seasons load lazily from TMDB; each episode is a
// checkbox, with a whole-season toggle for the "honestly, all of season 4"
// cases.
import { computed, nextTick, onMounted, ref } from 'vue'
import { showSeasons, seasonEpisodes } from '../lib/tmdb.js'
import { setEpisodeLiked, setEpisodesLiked, isEpisodeLiked } from '../lib/store.js'
import { formatRating, ratingTier } from '../lib/rating.js'

const props = defineProps({
  show: { type: Object, required: true },
})

const seasons = ref([])
const openSeason = ref(null)
const episodes = ref({}) // seasonNumber -> [{season, episode, name, still}]
const loading = ref(false)
const error = ref('')
const wholeShowBusy = ref(false)
const seasonEls = ref({})

const setSeasonEl = (number, el) => {
  if (el) seasonEls.value[number] = el
}

onMounted(async () => {
  loading.value = true
  try {
    const details = await showSeasons(props.show.id)
    seasons.value = details.seasons
    // A one-season show opens itself, but must not yank the page around:
    // the card was just tapped and is already where the eye is.
    if (details.seasons.length === 1) {
      await toggleSeason(details.seasons[0].number, { scroll: false })
    }
  } catch {
    error.value = 'Could not load seasons — is the network up?'
  } finally {
    loading.value = false
  }
})

// Bug report (Matt, 2026-08-22): opening a second season closes the first,
// which pulls the page up and can leave the season you just opened above the
// fold. Scroll its header to just under the sticky top bar — measured rather
// than hard-coded, since the bar grows by the phone's safe-area inset.
const scrollSeasonIntoView = async (number) => {
  await nextTick()
  const el = seasonEls.value[number]
  if (!el?.getBoundingClientRect) return
  const bar = document.querySelector('.topbar')
  const offset = (bar?.getBoundingClientRect().height ?? 0) + 8
  const top = el.getBoundingClientRect().top + window.scrollY - offset
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}

const toggleSeason = async (number, { scroll = true } = {}) => {
  if (openSeason.value === number) {
    openSeason.value = null
    return
  }
  openSeason.value = number
  if (!episodes.value[number]) {
    try {
      episodes.value = { ...episodes.value, [number]: await seasonEpisodes(props.show.id, number) }
    } catch {
      error.value = 'Could not load that season.'
      openSeason.value = null
      return
    }
  }
  // After the episodes render — they're what moves everything below.
  if (scroll) await scrollSeasonIntoView(number)
}

// --- the whole show, in one tap -----------------------------------------
// Bug report (Matt, 2026-08-22): "We have whole season buttons, let's get a
// whole show button." Seinfeld is nine seasons of tapping otherwise.

const totalEpisodes = computed(() =>
  seasons.value.reduce((sum, season) => sum + (season.episodeCount || 0), 0),
)
const allSeasonsLoaded = computed(
  () => seasons.value.length > 0 && seasons.value.every((s) => episodes.value[s.number]),
)
const knownEpisodes = computed(() => seasons.value.flatMap((s) => episodes.value[s.number] || []))

// Once every season is loaded the answer is exact; before that, fall back to
// TMDB's per-season counts so the button can label itself without 9 fetches.
const wholeShowLiked = computed(() => {
  if (allSeasonsLoaded.value && knownEpisodes.value.length) {
    return knownEpisodes.value.every((ep) => isEpisodeLiked(props.show.id, ep))
  }
  const liked = Object.keys(props.show.episodes || {}).length
  return totalEpisodes.value > 0 && liked >= totalEpisodes.value
})

const toggleWholeShow = async () => {
  if (wholeShowBusy.value || !seasons.value.length) return
  const turnOn = !wholeShowLiked.value
  wholeShowBusy.value = true
  error.value = ''
  try {
    if (turnOn) {
      const missing = seasons.value.filter((season) => !episodes.value[season.number])
      const fetched = await Promise.all(
        missing.map((season) => seasonEpisodes(props.show.id, season.number)),
      )
      const merged = { ...episodes.value }
      missing.forEach((season, i) => {
        merged[season.number] = fetched[i]
      })
      episodes.value = merged
      setEpisodesLiked(
        props.show.id,
        seasons.value.flatMap((season) => merged[season.number] || []),
        true,
      )
    } else {
      // Turning it off needs no fetching at all — the pool already lists
      // exactly what to remove.
      setEpisodesLiked(props.show.id, Object.values(props.show.episodes || {}), false)
    }
  } catch {
    error.value = 'Could not load every season — try that again?'
  } finally {
    wholeShowBusy.value = false
  }
}

const likedInSeason = (number) =>
  (episodes.value[number] || []).filter((ep) => isEpisodeLiked(props.show.id, ep)).length

const seasonAllLiked = (number) => {
  const eps = episodes.value[number] || []
  return eps.length > 0 && likedInSeason(number) === eps.length
}

const toggleWholeSeason = (number) => {
  const eps = episodes.value[number] || []
  setEpisodesLiked(props.show.id, eps, !seasonAllLiked(number))
}

const toggleEpisode = (ep) => {
  setEpisodeLiked(props.show.id, ep, !isEpisodeLiked(props.show.id, ep))
}
</script>

<template>
  <div class="editor">
    <p v-if="loading" class="editor__note">Loading seasons…</p>
    <p v-if="error" class="editor__error">{{ error }}</p>
    <button
      v-if="seasons.length"
      class="editor__whole-show"
      :class="{ 'editor__whole-show--on': wholeShowLiked }"
      :disabled="wholeShowBusy"
      @click="toggleWholeShow"
    >
      <template v-if="wholeShowBusy">Loading every season…</template>
      <template v-else-if="wholeShowLiked">✓ The whole show is in — tap to clear it</template>
      <template v-else>+ Add the whole show{{ totalEpisodes ? ` (${totalEpisodes})` : '' }}</template>
    </button>
    <div
      v-for="season in seasons"
      :key="season.number"
      :ref="(el) => setSeasonEl(season.number, el)"
      class="editor__season"
    >
      <button class="editor__season-head" @click="toggleSeason(season.number)">
        <span>{{ season.name }}</span>
        <span class="editor__season-meta">
          <template v-if="episodes[season.number]">
            {{ likedInSeason(season.number) }}/{{ episodes[season.number].length }}
          </template>
          <template v-else>{{ season.episodeCount }} eps</template>
          {{ openSeason === season.number ? '▾' : '▸' }}
        </span>
      </button>
      <div v-if="openSeason === season.number && episodes[season.number]" class="editor__eps">
        <label class="editor__ep editor__ep--all">
          <input
            type="checkbox"
            :checked="seasonAllLiked(season.number)"
            @change="toggleWholeSeason(season.number)"
          />
          <span>The whole season</span>
        </label>
        <label v-for="ep in episodes[season.number]" :key="ep.episode" class="editor__ep">
          <input
            type="checkbox"
            :checked="isEpisodeLiked(show.id, ep)"
            @change="toggleEpisode(ep)"
          />
          <span class="editor__ep-num">{{ ep.episode }}</span>
          <span class="editor__ep-name">{{ ep.name }}</span>
          <span
            v-if="formatRating(ep.rating)"
            class="editor__ep-rating"
            :class="`editor__ep-rating--${ratingTier(ep.rating)}`"
          >
            ★ {{ formatRating(ep.rating) }}
          </span>
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor {
  border-top: 1px solid var(--line);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.editor__note,
.editor__error {
  font-size: 13px;
  color: var(--ink-soft);
}

.editor__error {
  color: var(--danger);
}

.editor__whole-show {
  width: 100%;
  border: 1px dashed var(--amber);
  border-radius: 10px;
  padding: 10px;
  font-weight: 700;
  font-size: 14px;
  color: var(--amber);
}

.editor__whole-show--on {
  border-style: solid;
  background: rgba(245, 158, 11, 0.12);
}

.editor__whole-show:disabled {
  opacity: 0.6;
  border-color: var(--line);
  color: var(--ink-soft);
}

.editor__season {
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}

.editor__season-head {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 12px;
  font-weight: 600;
}

.editor__season-meta {
  color: var(--ink-soft);
  font-size: 13px;
  display: flex;
  gap: 8px;
}

.editor__eps {
  border-top: 1px solid var(--line);
  display: flex;
  flex-direction: column;
}

.editor__ep {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 50%, transparent);
  cursor: pointer;
  font-size: 14px;
}

.editor__ep:last-child {
  border-bottom: none;
}

.editor__ep--all {
  font-weight: 700;
  color: var(--amber);
}

.editor__ep input {
  width: 18px;
  height: 18px;
  accent-color: var(--amber);
}

.editor__ep-num {
  color: var(--ink-soft);
  min-width: 22px;
  text-align: right;
}

.editor__ep-name {
  flex: 1;
}

.editor__ep-rating {
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.editor__ep-rating--great {
  color: var(--amber);
}

.editor__ep-rating--good {
  color: var(--ink);
}

.editor__ep-rating--meh {
  color: var(--ink-soft);
}
</style>
