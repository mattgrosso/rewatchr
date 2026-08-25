<script setup>
// The hub-standard 🐛 button (see lib/bugreport.js for where reports go).
import { ref } from 'vue'
import { sendReport, flushStash } from '../lib/bugreport.js'

const props = defineProps({
  snapshot: { type: Function, required: true },
})

const open = ref(false)
const text = ref('')
const sending = ref(false)
const error = ref('')
const sentMessage = ref('')

void flushStash()

const close = () => {
  if (!sending.value) {
    open.value = false
    error.value = ''
  }
}

const send = async () => {
  const transcript = text.value.trim()
  if (!transcript || sending.value) return
  sending.value = true
  error.value = ''
  try {
    const outcome = await sendReport(transcript, props.snapshot())
    sentMessage.value =
      outcome === 'sent' ? 'Sent — thanks!' : 'Saved — it’ll send when you’re back online.'
    text.value = ''
    setTimeout(() => {
      sentMessage.value = ''
      open.value = false
    }, 2200)
  } catch (err) {
    // Keep the text; they just typed it and it exists nowhere else.
    error.value = err.message || 'Could not send that report.'
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <button class="bug-trigger" title="Report a bug" aria-label="Report a bug" @click="open = true">
    <!-- Bootstrap Icons bug-fill, inlined. The house bug glyph (Cinema Roll
         is the reference); inlined rather than pulling in the icon font for
         one character. Sized in em so the button's font-size still governs. -->
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.978.855a.5.5 0 1 0-.956.29l.41 1.352A5 5 0 0 0 3 6h10a5 5 0 0 0-1.432-3.503l.41-1.352a.5.5 0 1 0-.956-.29l-.291.956A5 5 0 0 0 8 1a5 5 0 0 0-2.731.811l-.29-.956z"/>
      <path d="M13 6v1H8.5v8.975A5 5 0 0 0 13 11h.5a.5.5 0 0 1 .5.5v.5a.5.5 0 1 0 1 0v-.5a1.5 1.5 0 0 0-1.5-1.5H13V9h1.5a.5.5 0 0 0 0-1H13V7h.5A1.5 1.5 0 0 0 15 5.5V5a.5.5 0 0 0-1 0v.5a.5.5 0 0 1-.5.5zm-5.5 9.975V7H3V6h-.5a.5.5 0 0 1-.5-.5V5a.5.5 0 0 0-1 0v.5A1.5 1.5 0 0 0 2.5 7H3v1H1.5a.5.5 0 0 0 0 1H3v1h-.5A1.5 1.5 0 0 0 1 11.5v.5a.5.5 0 1 0 1 0v-.5a.5.5 0 0 1 .5-.5H3a5 5 0 0 0 4.5 4.975"/>
    </svg>
  </button>
  <div v-if="open" class="modal-backdrop" @click.self="close">
    <div class="modal" role="dialog" aria-modal="true" aria-label="Report a bug">
      <div class="modal__head">
        <h2>Report a bug</h2>
      </div>
      <template v-if="!sentMessage">
        <textarea v-model="text" rows="5" placeholder="What happened?"></textarea>
        <p v-if="error" class="bug__error">{{ error }}</p>
        <div class="bug__actions">
          <button class="btn btn--ghost" @click="close">Cancel</button>
          <button class="btn btn--primary" :disabled="sending" @click="send">
            {{ sending ? 'Sending…' : 'Send report' }}
          </button>
        </div>
      </template>
      <p v-else class="bug__sent">{{ sentMessage }}</p>
    </div>
  </div>
</template>

<style scoped>
.bug-trigger {
  position: fixed;
  bottom: calc(14px + env(safe-area-inset-bottom));
  right: 14px;
  z-index: 1050;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: var(--panel);
  border: 1px solid var(--line);
  color: var(--ink);
  font-size: 19px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}

.bug__error {
  color: var(--danger);
  font-size: 13px;
}

.bug__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.bug__sent {
  text-align: center;
  padding: 18px 0;
  font-weight: 600;
  color: var(--amber);
}
</style>
