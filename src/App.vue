<script setup>
// Shell: sign-in gate, then Home (the button) / Shows (the library).
import { onMounted, ref } from 'vue'
import { watchAuth, signInWithGoogle, signOutUser } from './lib/firebase.js'
import { store, loadForUser, clearUser } from './lib/store.js'
import HomeScreen from './components/HomeScreen.vue'
import ShowsScreen from './components/ShowsScreen.vue'
import BugButton from './components/BugButton.vue'
import InstallButton from './components/InstallButton.vue'
import { buildStamp } from './lib/buildStamp.js'

const screen = ref('home') // 'home' | 'shows'
const signInError = ref('')
const menuOpen = ref(false)

onMounted(async () => {
  // The dev sign-in bypass (lib/devAuth.js). Every reference to it sits
  // behind `import.meta.env.DEV`, which Vite replaces with `false` in a
  // production build — so the whole branch, and the modules it reaches, are
  // dropped from the shipped bundle rather than merely disabled. A test
  // greps the build to keep it that way.
  if (import.meta.env.DEV) {
    const dev = await import('./lib/devAuth.js')
    if (dev.devAuthEnabled()) {
      await dev.startDevSession()
      return
    }
  }
  watchAuth((user) => {
    store.authReady = true
    if (user) void loadForUser(user)
    else clearUser()
  })
})

const signIn = async () => {
  signInError.value = ''
  try {
    await signInWithGoogle()
  } catch (error) {
    if (error?.code !== 'auth/popup-closed-by-user') {
      signInError.value = error.message || 'Sign-in failed.'
    }
  }
}

const signOut = async () => {
  menuOpen.value = false
  if (import.meta.env.DEV && store.localOnly) {
    const dev = await import('./lib/devAuth.js')
    dev.endDevSession()
    return
  }
  await signOutUser()
}

const bugSnapshot = () => ({
  screen: screen.value,
  shows: Object.values(store.shows).map((s) => `${s.name}(${Object.keys(s.episodes || {}).length})`),
  watchedCount: Object.keys(store.watched).length,
  user: store.user?.email ?? null,
})
</script>

<template>
  <template v-if="!store.user">
    <main class="splash">
      <div class="splash__tv">📺</div>
      <h1 class="splash__title">Rewatchr</h1>
      <p class="splash__tag">One great episode of a show you already love.</p>
      <button v-if="store.authReady" class="btn btn--primary splash__cta" @click="signIn">
        Sign in with Google
      </button>
      <p v-else class="splash__tag">Warming up…</p>
      <p v-if="signInError" class="splash__error">{{ signInError }}</p>
      <p class="build-stamp">{{ buildStamp() }}</p>
    </main>
  </template>
  <template v-else>
    <header class="topbar">
      <button class="topbar__brand" @click="screen = 'home'">📺 Rewatchr</button>
      <nav class="topbar__nav">
        <button
          class="topbar__tab"
          :class="{ 'topbar__tab--on': screen === 'shows' }"
          @click="screen = screen === 'shows' ? 'home' : 'shows'"
        >
          My shows
        </button>
        <button class="topbar__avatar" aria-label="Account" @click="menuOpen = !menuOpen">
          <img v-if="store.user.photo" :src="store.user.photo" alt="" referrerpolicy="no-referrer" />
          <span v-else>{{ (store.user.name || '?')[0] }}</span>
        </button>
      </nav>
      <div v-if="menuOpen" class="topbar__menu" @click.self="menuOpen = false">
        <p class="topbar__who">{{ store.user.name }}</p>
        <p class="topbar__email">{{ store.user.email }}</p>
        <p v-if="store.syncError" class="topbar__sync">⚠️ {{ store.syncError }}</p>
        <button class="btn btn--ghost" @click="signOut">Sign out</button>
        <p class="build-stamp">{{ buildStamp() }}</p>
      </div>
    </header>
    <HomeScreen v-if="screen === 'home'" @manage="screen = 'shows'" />
    <ShowsScreen v-else @done="screen = 'home'" />
    <InstallButton />
  </template>
  <BugButton :snapshot="bugSnapshot" />
</template>

<style scoped>
.splash {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 24px;
  text-align: center;
}

.splash__tv {
  font-size: 64px;
}

.splash__title {
  font-size: 40px;
  letter-spacing: 0.5px;
}

.splash__tag {
  color: var(--ink-soft);
  max-width: 300px;
}

.splash__cta {
  margin-top: 10px;
}

.splash__error {
  color: var(--danger);
  font-size: 13px;
  max-width: 320px;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(10px + env(safe-area-inset-top)) 14px 10px;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--line);
}

.topbar__brand {
  font-size: 18px;
  font-weight: 800;
}

.topbar__nav {
  display: flex;
  align-items: center;
  gap: 10px;
}

.topbar__tab {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 7px 14px;
  font-weight: 600;
  color: var(--ink-soft);
}

.topbar__tab--on {
  background: var(--amber);
  border-color: var(--amber);
  color: var(--amber-ink);
}

.topbar__avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--panel-2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.topbar__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.topbar__menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 12px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 220px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.topbar__who {
  font-weight: 700;
}

.topbar__email {
  color: var(--ink-soft);
  font-size: 13px;
}

.topbar__sync {
  color: var(--danger);
  font-size: 12px;
}

/* The house build stamp: present, readable, never competing for attention. */
.build-stamp {
  font-size: 11px;
  color: var(--ink-soft);
  opacity: 0.75;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
</style>
