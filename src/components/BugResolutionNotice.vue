<script setup>
// "A bug you reported is fixed" - the reply half of the bug button, ported
// from Cinema Roll (2026-09-21). Shown once per notice, on the launch after
// `yarn resolve-bug-report` wrote it; any dismissal marks every notice on
// screen as seen. The point is "your report mattered, here's what
// happened", not a task to acknowledge.
import { ref, watch } from 'vue';
import { store } from '../lib/store.js';
import { fetchUnseenResolutions, markResolutionsSeen } from '../lib/bugResolutions.js';

const notices = ref([]);
let checked = false;

// Notices are keyed by the Firebase uid, so nothing can be looked up until
// Auth has said who this is - including a silent anonymous session left
// over from filing the report.
watch(() => store.authReady, async (ready) => {
  if (!ready || checked) return;
  checked = true;
  notices.value = await fetchUnseenResolutions();
}, { immediate: true });

const dismiss = () => {
  const ids = notices.value.map((n) => n.id);
  notices.value = [];
  markResolutionsSeen(ids);
};

const formatDate = (timestamp) => new Date(timestamp).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
</script>

<template>
  <Teleport to="body">
    <div v-if="notices.length" class="bug-resolution-backdrop" @click.self="dismiss">
      <div class="bug-resolution-panel" role="dialog" aria-label="A bug you reported was fixed">
        <h2>{{ notices.length === 1 ? 'A bug you reported is fixed' : 'Bugs you reported are fixed' }}</h2>
        <p class="bug-resolution-panel__thanks">Thanks for telling us &mdash; here&rsquo;s what happened.</p>
        <div v-for="notice in notices" :key="notice.id" class="bug-resolution-notice">
          <p v-if="notice.reportSnippet" class="bug-resolution-notice__quote">You said: &ldquo;{{ notice.reportSnippet }}&rdquo;</p>
          <p v-if="notice.understood" class="bug-resolution-notice__section">
            <span class="bug-resolution-notice__label">What was going wrong</span>{{ notice.understood }}
          </p>
          <p v-if="notice.fixed" class="bug-resolution-notice__section">
            <span class="bug-resolution-notice__label">What we did about it</span>{{ notice.fixed }}
          </p>
          <p v-if="notice.resolvedAt" class="bug-resolution-notice__date">Fixed {{ formatDate(notice.resolvedAt) }}</p>
        </div>
        <div class="bug-resolution-panel__actions">
          <button type="button" class="bug-resolution-panel__ok" @click="dismiss">Got it, thanks</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Neutral dark dress: the app talking about itself. :active only, no :hover. */
.bug-resolution-backdrop {
  position: fixed; inset: 0; z-index: 955;
  background: rgba(0, 0, 0, 0.65);
  display: grid; place-items: center; padding: 1.25rem;
}
.bug-resolution-panel {
  width: min(440px, 100%); max-height: 85vh; overflow-y: auto;
  border-radius: 14px; background: #1c1c1c; border: 1px solid rgba(255, 255, 255, 0.18);
  color: #f4f4f4; padding: 1.1rem 1.2rem;
  display: flex; flex-direction: column; gap: 0.7rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
}
.bug-resolution-panel h2 { margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; }
.bug-resolution-panel h2::before { content: ''; width: 0.7rem; height: 0.7rem; border-radius: 50%; background: #7ac97a; flex: 0 0 auto; }
.bug-resolution-panel__thanks { margin: 0; font-size: 0.9rem; color: #cfcfcf; }
.bug-resolution-notice {
  border-radius: 10px; background: #101010; border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 0.75rem 0.9rem; display: flex; flex-direction: column; gap: 0.5rem;
}
.bug-resolution-notice p { margin: 0; }
.bug-resolution-notice__quote { font-style: italic; font-size: 0.9rem; color: #cfcfcf; }
.bug-resolution-notice__section { font-size: 0.95rem; }
.bug-resolution-notice__label { display: block; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: #cfcfcf; margin-bottom: 0.15rem; }
.bug-resolution-notice__date { font-size: 0.75rem; color: #cfcfcf; }
.bug-resolution-panel__actions { display: flex; justify-content: flex-end; }
.bug-resolution-panel__ok {
  min-height: 40px; padding: 0 1rem; border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.25); background: #2a2a2a; color: #f4f4f4; font: inherit;
}
.bug-resolution-panel__ok:active { background: #3a3a3a; }
</style>
