<script setup>
// The library: search TMDB for shows, and per show check off the episodes
// worth rewatching.
import { computed, ref } from 'vue'
import { store, addShow, removeShow } from '../lib/store.js'
import { searchShows, img } from '../lib/tmdb.js'
import ShowEditor from './ShowEditor.vue'

const emit = defineEmits(['done'])

const query = ref('')
const results = ref([])
const searching = ref(false)
const searchError = ref('')
const editing = ref(null) // show id open in the editor
const confirmingRemove = ref(null)

let searchTimer = null
const onQuery = () => {
  clearTimeout(searchTimer)
  const q = query.value.trim()
  if (!q) {
    results.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    searching.value = true
    searchError.value = ''
    try {
      results.value = (await searchShows(q)).slice(0, 8)
    } catch (error) {
      searchError.value = 'Search failed — is the network up?'
    } finally {
      searching.value = false
    }
  }, 350)
}

const add = (show) => {
  addShow(show)
  query.value = ''
  results.value = []
  editing.value = show.id
}

const myShows = computed(() =>
  Object.values(store.shows).sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0)),
)

const likedCount = (show) => Object.keys(show.episodes || {}).length

const remove = (showId) => {
  confirmingRemove.value = null
  if (editing.value === showId) editing.value = null
  removeShow(showId)
}
</script>

<template>
  <main class="shows">
    <section class="shows__search">
      <input
        v-model="query"
        type="search"
        placeholder="Add a show — try “Seinfeld”"
        @input="onQuery"
      />
      <p v-if="searchError" class="shows__error">{{ searchError }}</p>
      <ul v-if="results.length" class="shows__results">
        <li v-for="r in results" :key="r.id">
          <button class="shows__result" :disabled="Boolean(store.shows[r.id])" @click="add(r)">
            <img v-if="r.poster" :src="img(r.poster, 'w92')" alt="" />
            <span class="shows__result-name">
              {{ r.name }} <span v-if="r.year" class="shows__result-year">({{ r.year }})</span>
            </span>
            <span class="shows__result-add">{{ store.shows[r.id] ? 'Added' : '+ Add' }}</span>
          </button>
        </li>
      </ul>
    </section>

    <section class="shows__list">
      <p v-if="!myShows.length" class="shows__empty">
        No shows yet — search above to start the pool.
      </p>
      <article v-for="show in myShows" :key="show.id" class="shows__card">
        <button class="shows__card-head" @click="editing = editing === show.id ? null : show.id">
          <img v-if="show.poster" :src="img(show.poster, 'w154')" alt="" />
          <span class="shows__card-title">
            <strong>{{ show.name }}</strong>
            <span class="shows__card-count">
              {{ likedCount(show) }} episode{{ likedCount(show) === 1 ? '' : 's' }} in the pool
            </span>
          </span>
          <span class="shows__card-chevron">{{ editing === show.id ? '▾' : '▸' }}</span>
        </button>
        <ShowEditor v-if="editing === show.id" :show="show" />
        <div v-if="editing === show.id" class="shows__card-foot">
          <button
            v-if="confirmingRemove !== show.id"
            class="shows__remove"
            @click="confirmingRemove = show.id"
          >
            Remove show
          </button>
          <template v-else>
            <span class="shows__remove-ask">Remove {{ show.name }} and its picks?</span>
            <button class="shows__remove shows__remove--yes" @click="remove(show.id)">Remove</button>
            <button class="shows__remove" @click="confirmingRemove = null">Keep</button>
          </template>
        </div>
      </article>
    </section>

    <button v-if="myShows.length" class="btn btn--primary shows__done" @click="emit('done')">
      Done — back to the button
    </button>
  </main>
</template>

<style scoped>
.shows {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px;
  max-width: 560px;
  width: 100%;
  margin: 0 auto;
}

.shows__search {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shows__search input {
  width: 100%;
}

.shows__error {
  color: var(--danger);
  font-size: 13px;
}

.shows__results {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.shows__result {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 8px 12px;
  text-align: left;
}

.shows__result img {
  width: 32px;
  border-radius: 6px;
}

.shows__result-name {
  flex: 1;
}

.shows__result-year {
  color: var(--ink-soft);
}

.shows__result-add {
  color: var(--amber);
  font-weight: 700;
  font-size: 14px;
}

.shows__result:disabled .shows__result-add {
  color: var(--ink-soft);
}

.shows__empty {
  color: var(--ink-soft);
  text-align: center;
  padding: 30px 0;
}

.shows__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.shows__card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  overflow: hidden;
}

.shows__card-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  text-align: left;
}

.shows__card-head img {
  width: 44px;
  border-radius: 8px;
}

.shows__card-title {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.shows__card-count {
  color: var(--ink-soft);
  font-size: 13px;
}

.shows__card-chevron {
  color: var(--ink-soft);
}

.shows__card-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px 12px;
}

.shows__remove {
  color: var(--ink-soft);
  font-size: 13px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 6px 10px;
}

.shows__remove--yes {
  color: #fff;
  background: var(--danger);
  border-color: var(--danger);
}

.shows__remove-ask {
  font-size: 13px;
  color: var(--ink-soft);
}

.shows__done {
  margin-top: auto;
}
</style>
