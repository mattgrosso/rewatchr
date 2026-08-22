<script setup>
// Per-show episode picker: seasons load lazily from TMDB; each episode is a
// checkbox, with a whole-season toggle for the "honestly, all of season 4"
// cases.
import { onMounted, ref } from 'vue'
import { showSeasons, seasonEpisodes } from '../lib/tmdb.js'
import { setEpisodeLiked, isEpisodeLiked } from '../lib/store.js'

const props = defineProps({
  show: { type: Object, required: true },
})

const seasons = ref([])
const openSeason = ref(null)
const episodes = ref({}) // seasonNumber -> [{season, episode, name, still}]
const loading = ref(false)
const error = ref('')

onMounted(async () => {
  loading.value = true
  try {
    const details = await showSeasons(props.show.id)
    seasons.value = details.seasons
    if (details.seasons.length === 1) await toggleSeason(details.seasons[0].number)
  } catch {
    error.value = 'Could not load seasons — is the network up?'
  } finally {
    loading.value = false
  }
})

const toggleSeason = async (number) => {
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
    }
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
  const turnOn = !seasonAllLiked(number)
  for (const ep of eps) setEpisodeLiked(props.show.id, ep, turnOn)
}

const toggleEpisode = (ep) => {
  setEpisodeLiked(props.show.id, ep, !isEpisodeLiked(props.show.id, ep))
}
</script>

<template>
  <div class="editor">
    <p v-if="loading" class="editor__note">Loading seasons…</p>
    <p v-if="error" class="editor__error">{{ error }}</p>
    <div v-for="season in seasons" :key="season.number" class="editor__season">
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
</style>
