<script setup>
// The dealt episode: art, title, and where it's streaming right now.
import { computed } from 'vue'
import { img } from '../lib/tmdb.js'
import { formatRating } from '../lib/rating.js'

const props = defineProps({
  pick: { type: Object, required: true },
  providers: { type: Object, default: null }, // null = still loading
})

const emit = defineEmits(['again', 'watched', 'close'])

const art = computed(
  () => img(props.pick.ep.still, 'w780') || img(props.pick.show.poster, 'w500'),
)
const epCode = computed(() => `S${props.pick.ep.season} · E${props.pick.ep.episode}`)

// A two-parter arrives as several episodes; everything else as one.
const parts = computed(() => props.pick.parts || [props.pick.ep])
const partLabel = computed(() =>
  parts.value.length === 2 ? 'Two-parter' : `${parts.value.length}-part story`,
)
const code = (ep) => `S${ep.season} · E${ep.episode}`
</script>

<template>
  <section class="result">
    <p class="result__deal">Today's episode</p>
    <div class="result__card">
      <img v-if="art" class="result__art" :src="art" alt="" />
      <div class="result__body">
        <h2 class="result__show">{{ pick.show.name }}</h2>
        <template v-if="parts.length > 1">
          <p class="result__multi">{{ partLabel }} — watch them back to back</p>
          <ol class="result__parts">
            <li v-for="part in parts" :key="code(part)">
              <span class="result__code">{{ code(part) }}</span>
              {{ part.name }}
              <span v-if="formatRating(part.rating)" class="result__rating">
                ★ {{ formatRating(part.rating) }}
              </span>
            </li>
          </ol>
        </template>
        <p v-else class="result__ep">
          <span class="result__code">{{ epCode }}</span>
          {{ pick.ep.name }}
          <span v-if="formatRating(pick.ep.rating)" class="result__rating">
            ★ {{ formatRating(pick.ep.rating) }}
          </span>
        </p>
        <p v-if="pick.recycled" class="result__recycled">
          Fresh lap — you've seen the whole pool, so everything's back in play.
        </p>

        <div class="result__where">
          <p v-if="providers === null" class="result__where-loading">Checking where to stream…</p>
          <template v-else-if="providers.flatrate.length">
            <p class="result__where-label">Streaming on</p>
            <div class="result__providers">
              <a
                v-for="p in providers.flatrate"
                :key="p.name"
                class="result__provider"
                :href="providers.link || undefined"
                target="_blank"
                rel="noopener"
              >
                <img v-if="p.logo" :src="img(p.logo, 'w92')" :alt="p.name" />
                <span>{{ p.name }}</span>
              </a>
            </div>
          </template>
          <p v-else class="result__where-none">
            Not on a subscription service right now —
            <a v-if="providers.link" :href="providers.link" target="_blank" rel="noopener"
              >check rentals</a
            ><span v-else>try your usual sources</span>.
          </p>
        </div>
      </div>
    </div>

    <div class="result__actions">
      <button class="btn btn--ghost" @click="emit('again')">🔁 Deal again</button>
      <button class="btn btn--primary" @click="emit('watched')">✓ I'm watching it</button>
    </div>
    <button class="result__back" @click="emit('close')">Back</button>
  </section>
</template>

<style scoped>
.result {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}

.result__deal {
  color: var(--ink-soft);
  text-transform: uppercase;
  letter-spacing: 2px;
  font-size: 12px;
  padding-top: 8px;
}

.result__card {
  width: 100%;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
}

.result__art {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  display: block;
}

.result__body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result__show {
  font-size: 22px;
}

.result__ep {
  font-size: 16px;
}

.result__code {
  color: var(--amber);
  font-weight: 700;
  margin-right: 8px;
}

.result__multi {
  font-size: 13px;
  font-weight: 700;
  color: var(--amber);
}

.result__parts {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result__parts li {
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 15px;
}

.result__rating {
  color: var(--amber);
  font-weight: 700;
  font-size: 14px;
  margin-left: 6px;
  white-space: nowrap;
}

.result__recycled {
  color: var(--amber);
  font-size: 13px;
}

.result__where {
  border-top: 1px solid var(--line);
  padding-top: 12px;
}

.result__where-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--ink-soft);
  margin-bottom: 8px;
}

.result__where-loading,
.result__where-none {
  color: var(--ink-soft);
  font-size: 14px;
}

.result__where-none a {
  color: var(--amber);
}

.result__providers {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.result__provider {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--panel-2);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 7px 12px;
  color: var(--ink);
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
}

.result__provider img {
  width: 26px;
  height: 26px;
  border-radius: 6px;
}

.result__actions {
  display: flex;
  gap: 10px;
}

.result__back {
  color: var(--ink-soft);
  font-size: 14px;
  padding: 6px;
}
</style>
