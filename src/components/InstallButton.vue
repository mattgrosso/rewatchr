<script setup>
// The install pill + the iOS how-to panel (see lib/install.js).
import { installState, promptInstall } from '../lib/install.js'
</script>

<template>
  <button
    v-if="installState.available"
    class="install-pill"
    title="Add Rewatchr to your home screen"
    @click="promptInstall"
  >
    📲 Install
  </button>
  <div
    v-if="installState.showIosSteps"
    class="modal-backdrop"
    @click.self="installState.showIosSteps = false"
  >
    <div class="modal" role="dialog" aria-label="Add to Home Screen">
      <div class="modal__head">
        <h2>Add to Home Screen</h2>
      </div>
      <ol class="install__steps">
        <li>Tap <strong>Share</strong> in Safari's toolbar</li>
        <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
        <li>Tap <strong>Add</strong></li>
      </ol>
      <p class="install__note">Safari only; iOS doesn't let other browsers do this.</p>
      <button class="btn btn--primary" @click="installState.showIosSteps = false">Got it</button>
    </div>
  </div>
</template>

<style scoped>
.install-pill {
  position: fixed;
  bottom: calc(14px + env(safe-area-inset-bottom));
  left: 14px;
  z-index: 1050;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 9px 14px;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}

.install__steps {
  margin: 0;
  padding-left: 22px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 15px;
}

.install__note {
  font-size: 12px;
  color: var(--ink-soft);
}
</style>
