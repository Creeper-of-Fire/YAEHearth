<script setup lang="ts">
import { nextTick, ref, computed, watch, onMounted } from 'vue'
import { useDialogueStore } from '@/stores/dialogue'
import { useGameStore } from '@/stores/game'
import { usePanelParams } from '@/viewer/usePanelParams'
import { usePanelStore } from '@/stores/panel'
import MarkdownView from '@/components/MarkdownView.vue'

const { params, navigate } = usePanelParams()
const panelStore = usePanelStore()
const dialogueStore = useDialogueStore()
const gameStore = useGameStore()
const inputText = ref('')
const logContainer = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const characterId = computed(() => params.value.characterId)
const character = computed(() =>
  gameStore.characters.find(c => c.id === characterId.value) ?? null,
)

async function initOrSwitchDialogue(charId: string) {
  await dialogueStore.initDialogue(charId)
}

onMounted(() => {
  if (characterId.value) initOrSwitchDialogue(characterId.value)
})

watch(characterId, (newId) => {
  if (newId) initOrSwitchDialogue(newId)
})

watch(
  () => dialogueStore.displayMessages.length,
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
  if (!text || dialogueStore.busy) return
  inputText.value = ''
  resizeTextarea()
  dialogueStore.sendMessage(text)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

function resizeTextarea() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}

function endConversation() {
  dialogueStore.endConversation()
  panelStore.navigate('right', 'char-list')
  if (characterId.value) {
    navigate('scene')
  }
}
</script>

<template>
  <div class="dialogue-view">
    <div class="dialogue-header">
      <span class="dialogue-target">正在与 {{ character?.frontmatter.name ?? '???' }} 对话</span>
      <n-button size="small" type="warning" ghost @click="endConversation">
        结束对话
      </n-button>
    </div>
    <div v-if="dialogueStore.cumulativeUsage.turnCount > 0" class="stats-bar">
      <span>缓存命中: {{ (dialogueStore.cacheHitRate * 100).toFixed(1) }}%</span>
      <span>提示: {{ dialogueStore.cumulativeUsage.promptTokens.toLocaleString() }}</span>
      <span>补全: {{ dialogueStore.cumulativeUsage.completionTokens.toLocaleString() }}</span>
      <span>回合: {{ dialogueStore.cumulativeUsage.turnCount }}</span>
    </div>
    <div ref="logContainer" class="dialogue-log">
      <div
        v-for="(msg, i) in dialogueStore.displayMessages"
        :key="i"
        class="message"
        :class="`msg-${msg.type}`"
      >
        <template v-if="msg.type === 'scene'">
          <MarkdownView :source="msg.text" class="content-block"/>
        </template>
        <template v-else-if="msg.type === 'char-card'">
          <MarkdownView :source="msg.text" class="content-block"/>
        </template>
        <template v-else-if="msg.type === 'player'">
          <span class="speaker-player">你:</span> {{ msg.text }}
        </template>
        <template v-else>
          <span class="speaker-npc">{{ msg.name }}:</span> {{ msg.text }}
        </template>
      </div>
      <div v-if="dialogueStore.busy" class="message msg-thinking">
        <span class="thinking">正在思考...</span>
      </div>
    </div>
    <div class="input-bar">
      <textarea
        ref="textareaRef"
        v-model="inputText"
        class="msg-input"
        placeholder="输入你的回应..."
        rows="1"
        :disabled="dialogueStore.busy"
        @keydown="onKeydown"
        @input="resizeTextarea"
      />
    </div>
  </div>
</template>

<style scoped>
.dialogue-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialogue-header {
  padding: 12px 24px;
  background: #222226;
  border-bottom: 1px solid #434347;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dialogue-target {
  color: #ffcc44;
  font-size: 15px;
  font-weight: bold;
}

.stats-bar {
  padding: 4px 24px;
  background: #1a1a1e;
  border-bottom: 1px solid #434347;
  display: flex;
  gap: 16px;
  font-size: 11px;
  color: #777777;
}

.dialogue-log {
  flex: 1;
  min-height: 0;
  padding: 16px 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message {
  color: #cccccc;
  line-height: 1.6;
  white-space: pre-wrap;
}

.msg-scene {
  align-self: center;
  font-style: italic;
  color: #888888;
  font-size: 13px;
}

.msg-char-card {
  align-self: center;
  background: #222226;
  border: 1px solid #434347;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  color: #aaaaaa;
  max-width: 80%;
}

.msg-player {
  align-self: flex-end;
  background: #2a3a4a;
  border-radius: 8px;
  padding: 8px 12px;
  max-width: 75%;
}

.msg-assistant {
  align-self: flex-start;
  max-width: 75%;
}

.speaker-player {
  color: #88bbdd;
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
  resize: none;
  max-height: 120px;
  line-height: 1.4;
  font-family: inherit;
}

.msg-input:focus {
  border-color: #666666;
}

.msg-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
