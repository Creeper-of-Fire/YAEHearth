<script lang="ts" setup>
import {shallowRef} from 'vue'

const props = defineProps<{
  busy: boolean
}>()

const emit = defineEmits<{
  send: [text: string]
}>()

const inputText = shallowRef('')
const textareaRef = shallowRef<HTMLTextAreaElement | null>(null)

function send()
{
    const text = inputText.value.trim()
    if (!text || props.busy) return
    inputText.value = ''
    resizeTextarea()
    emit('send', text)
}

function onKeydown(e: KeyboardEvent)
{
    if (e.key === 'Enter' && !e.shiftKey)
    {
        e.preventDefault()
        send()
    }
}

function resizeTextarea()
{
    const el = textareaRef.value
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}
</script>

<template>
  <div class="input-bar">
    <textarea
        ref="textareaRef"
        v-model="inputText"
        class="msg-input"
        placeholder="输入你的回应..."
        rows="1"
        :disabled="busy"
        @keydown="onKeydown"
        @input="resizeTextarea"
    />
  </div>
</template>

<style scoped>
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
