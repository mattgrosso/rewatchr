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
    🐛
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
