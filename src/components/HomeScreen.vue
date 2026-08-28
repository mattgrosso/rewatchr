<script setup>
// The lunchtime screen: one big button, and the result it deals.
import { computed, ref } from 'vue'
import { store, markWatched } from '../lib/store.js'
import { pickEpisode, poolCounts } from '../lib/picker.js'
import { watchProviders, img } from '../lib/tmdb.js'
import ResultCard from './ResultCard.vue'

const emit = defineEmits(['manage'])

const pick = ref(null)
const providers = ref(null)
const drawing = ref(false)

// Episodes dealt but passed on ("Deal again") this session — the redraw
// shouldn't hand back what you just turned down. Capped, session-only;
// actual no-repeat tracking is the watched ledger.
const passedKeys = ref([])

// null = deal from everything, the default. Not persisted: variety is the
// point of the app, so a one-off "I want Seinfeld today" shouldn't quietly
// become every day.
const onlyShowId = ref(null)

const allShows = computed(() =>
  Object.values(store.shows || {})
    .filter((show) => Object.keys(show.episodes || {}).length > 0)
    .sort((a, b) => String(a.name).localeCompare(String(b.name))),
)

// The whole library, for "is there anything at all to draw".
const libraryCounts = computed(() => poolCounts(store.shows, store.watched))
// The pool actually being drawn from, which is what the caption should report.
const counts = computed(() => poolCounts(store.shows, store.watched, onlyShowId.value))
const hasPool = computed(() => libraryCounts.value.total > 0)
const onlyShowName = computed(
  () => allShows.value.find((show) => String(show.id) === String(onlyShowId.value))?.name || null,
)

const draw = async () => {
  if (drawing.value) return
  drawing.value = true
  providers.value = null
  if (pick.value) {
    passedKeys.value = [...passedKeys.value, ...(pick.value.keys || [pick.value.key])].slice(-15)
  }
  // A beat of suspense: the shuffle is instant, the anticipation shouldn't be.
  const result = pickEpisode(
    store.shows, store.watched, Math.random, passedKeys.value, onlyShowId.value,
  )
  await new Promise((resolve) => setTimeout(resolve, 650))
  pick.value = result
  drawing.value = false
  if (result) {
    try {
      providers.value = await watchProviders(result.show.id)
    } catch {
      providers.value = { link: null, flatrate: [] }
    }
  }
}

const watchedIt = () => {
  if (pick.value) markWatched(pick.value)
  pick.value = null
}

const recent = computed(() => store.history.slice(0, 8))
const epLabel = (h) =>
  h.partCount > 1 ? `S${h.season}E${h.episode} +${h.partCount - 1}` : `S${h.season}E${h.episode}`
</script>

<template>
  <main class="home">
    <template v-if="!pick">
      <section v-if="hasPool" class="home__stage">
        <p class="home__count">
          {{ counts.unwatched }} of {{ counts.total }} episodes left
          {{ onlyShowName ? `in ${onlyShowName}` : 'in the pool' }}
        </p>

        <!-- Deliberately a plain select rather than a row of chips: the pool
             can be a dozen shows, and a chip row would push the one big
             button below the fold on a phone. -->
        <label v-if="allShows.length > 1" class="home__scope">
          <span class="home__scope-label">Draw from</span>
          <select v-model="onlyShowId" class="home__scope-select">
            <option :value="null">Any show</option>
            <option v-for="show in allShows" :key="show.id" :value="String(show.id)">
              {{ show.name }}
            </option>
          </select>
        </label>
        <button
          class="home__draw"
          :class="{ 'home__draw--spin': drawing }"
          :disabled="counts.total === 0"
          @click="draw"
        >
          <span class="home__draw-emoji">{{ drawing ? '🎲' : '📺' }}</span>
          <span>{{ drawing ? 'Picking…' : 'What should I watch?' }}</span>
        </button>
        <p v-if="counts.total === 0" class="home__recycle">
          No episodes ticked in {{ onlyShowName }} yet — pick another show, or add some.
        </p>
        <p v-else-if="counts.unwatched === 0" class="home__recycle">
          You've watched {{ onlyShowName ? `every ${onlyShowName} episode` : 'the whole pool' }} —
          the next draw starts a fresh lap.
        </p>
      </section>
      <section v-else class="home__stage">
        <p class="home__empty-emoji">🍿</p>
        <h2>Load up the pool</h2>
        <p class="home__empty-copy">
          Add the shows you love and check off the episodes worth rewatching.
          Then lunchtime is one button.
        </p>
        <button class="btn btn--primary" @click="emit('manage')">Add your shows</button>
      </section>

      <section v-if="recent.length" class="home__history">
        <h3>Recently watched</h3>
        <ul>
          <li v-for="h in recent" :key="h.key + h.at">
            <span class="home__history-show">{{ h.showName }}</span>
            <span class="home__history-ep">{{ epLabel(h) }} · {{ h.epName }}</span>
          </li>
        </ul>
      </section>
    </template>

    <ResultCard
      v-else
      :pick="pick"
      :providers="providers"
      @again="draw"
      @watched="watchedIt"
      @close="pick = null"
    />
  </main>
</template>

<style scoped>
.home__scope {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  margin-top: -10px;
}

.home__scope-label {
  font-size: 0.78rem;
  opacity: 0.7;
}

.home__scope-select {
  font: inherit;
  font-size: 0.85rem;
  padding: 6px 10px;
  min-height: 40px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  max-width: 60vw;
}

.home__draw:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.home {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 18px;
  gap: 26px;
  max-width: 560px;
  width: 100%;
  margin: 0 auto;
}

.home__stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
  /* Breathing room under the topbar, not a chasm. This was a flat 8dvh,
     which reads fine on a laptop and is 65px of nothing on a phone — on top
     of .home's own 18px, it pushed the episode count and the show picker
     most of an inch down the screen (Matt, 2026-08-28). Capped so a tall
     desktop window doesn't reintroduce the same gap. */
  padding-top: clamp(4px, 2dvh, 20px);
}

.home__count {
  color: var(--ink-soft);
  font-size: 14px;
}

.home__draw {
  width: min(300px, 78vw);
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, #fbbf24, var(--amber) 55%, var(--amber-deep));
  color: var(--amber-ink);
  font-size: 21px;
  font-weight: 800;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  box-shadow:
    0 0 60px rgba(245, 158, 11, 0.25),
    0 12px 30px rgba(0, 0, 0, 0.45);
  transition: transform 0.15s;
}

.home__draw:active {
  transform: scale(0.96);
}

.home__draw-emoji {
  font-size: 52px;
}

.home__draw--spin .home__draw-emoji {
  animation: wobble 0.5s infinite;
}

@keyframes wobble {
  0%,
  100% {
    transform: rotate(-14deg);
  }
  50% {
    transform: rotate(14deg);
  }
}

.home__recycle {
  color: var(--amber);
  font-size: 13px;
  max-width: 300px;
}

.home__empty-emoji {
  font-size: 54px;
}

.home__empty-copy {
  color: var(--ink-soft);
  max-width: 320px;
}

.home__history h3 {
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--ink-soft);
  margin-bottom: 10px;
}

.home__history ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.home__history li {
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 10px 12px;
}

.home__history-show {
  font-weight: 700;
}

.home__history-ep {
  color: var(--ink-soft);
  font-size: 13px;
}
</style>
