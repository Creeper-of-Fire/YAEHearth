<script lang="ts" setup>
import {nextTick, ref, watch} from 'vue'
import MarkdownView from '@/shared/ui/MarkdownView.vue'
import type {DisplayMessage} from './prompts'

const props = defineProps<{
  messages: DisplayMessage[]
  busy: boolean
}>()

const logContainer = ref<HTMLElement | null>(null)

watch(
    () => props.messages.length,
    () =>
    {
        nextTick(() =>
        {
            if (logContainer.value)
            {
                logContainer.value.scrollTop = logContainer.value.scrollHeight
            }
        })
    },
)
</script>

<template>
  <div ref="logContainer" class="dialogue-log">
    <div
        v-for="(msg, i) in messages"
        :key="i"
        class="message"
        :class="`msg-${msg.type}`"
    >
      <template v-if="msg.type === 'scene'">
        <MarkdownView :source="msg.text" class="content-block"/>
      </template>
      <template v-else-if="msg.type === 'char-card'">
        <div class="char-card-label">{{ msg.name }}</div>
        <MarkdownView :source="msg.text" class="content-block"/>
      </template>
      <template v-else-if="msg.type === 'player'">
        <span class="speaker-player">你:</span> {{ msg.text }}
      </template>
      <template v-else>
        <span class="speaker-npc">{{ msg.name }}:</span> {{ msg.text }}
      </template>
    </div>
    <div v-if="busy" class="message msg-thinking">
      <span class="thinking">正在思考...</span>
    </div>
  </div>
</template>

<style scoped>
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
  align-self: stretch;
  background: #222226;
  border: 1px solid #434347;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  color: #aaaaaa;
}

.char-card-label {
  font-size: 14px;
  font-weight: bold;
  color: #dddddd;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid #434347;
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
</style>
