<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'

const store = useGameStore()
const inputText = ref('')
const logContainer = ref<HTMLElement | null>(null)

watch(
  () => store.dialogueHistory.length,
  () => {
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight
      }
    })
  },
)

function send() {
  const text = inputText.value.trim()
  if (!text || store.busy) return
  inputText.value = ''
  store.sendMessage(text)
}
</script>

<template>
  <div class="scene-panel">
    <div class="scene-desc">
      {{ store.sceneDescription }}
    </div>
    <div ref="logContainer" class="dialogue-log">
      <div
        v-for="(msg, i) in store.dialogueHistory"
        :key="i"
        class="message"
        :class="{
          'msg-narrator': !msg.speaker,
          'msg-player': msg.speaker === '玩家',
          'msg-npc': msg.speaker && msg.speaker !== '玩家',
        }"
      >
        <template v-if="!msg.speaker">
          {{ msg.text }}
        </template>
        <template v-else-if="msg.speaker === '玩家'">
          <span class="speaker-player">你:</span> {{ msg.text }}
        </template>
        <template v-else>
          <span class="speaker-npc">{{ msg.speaker }}:</span> {{ msg.text }}
        </template>
      </div>
      <div v-if="store.busy" class="message msg-system">
        <span class="thinking">正在思考...</span>
      </div>
    </div>
    <div class="input-bar">
      <input
        v-model="inputText"
        :disabled="store.busy"
        class="msg-input"
        placeholder="说点什么…"
        @keyup.enter="send"
      />
    </div>
  </div>
</template>

<style scoped>
.scene-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.scene-desc {
  padding: 12px 16px;
  background: #19191a;
  color: #999999;
  font-style: italic;
  font-size: 14px;
  border-bottom: 1px solid #434347;
  line-height: 1.5;
}

.dialogue-log {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  scrollbar-width: thin;
  scrollbar-color: #444444 transparent;
}

.message {
  margin-bottom: 8px;
  line-height: 1.6;
  word-break: break-word;
}

.msg-narrator {
  color: #999999;
  font-style: italic;
}

.msg-player {
  color: #dddddd;
}

.msg-npc {
  color: #dddddd;
}

.msg-system {
  color: #666666;
  font-style: italic;
}

.speaker-player {
  color: #4db8ff;
  font-weight: bold;
}

.speaker-npc {
  color: #ffcc44;
  font-weight: bold;
}

.thinking {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

.input-bar {
  padding: 8px 12px;
  background: #2a2a2a;
  border-top: 1px solid #434347;
}

.msg-input {
  width: 100%;
  padding: 8px 12px;
  background: #cccccc;
  color: #111111;
  border: 1px solid #888888;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
}

.msg-input:focus {
  border-color: #666666;
}

.msg-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
