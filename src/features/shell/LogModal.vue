<script lang="ts" setup>
import {computed, ref} from 'vue'
import {useLogStore} from './log-store'

const log = useLogStore()
const show = ref(false)

const recentLogs = computed(() => log.entries.value.slice(-500))
</script>

<template>
  <div class="log-trigger" @click="show = true">
    日志
  </div>
  <n-modal v-model:show="show" preset="card" style="max-width: 500px; max-height: 70vh;" title="事件日志">
    <div class="log-content">
      <div v-for="(entry, i) in recentLogs" :key="i" :class="`log-${entry.level}`" class="log-entry">
        <span class="log-time">{{ entry.time }}</span> {{ entry.message }}
      </div>
    </div>
  </n-modal>
</template>

<style scoped>
.log-trigger {
  position: fixed;
  bottom: 12px;
  right: 12px;
  background: #2a2a2a;
  color: #888888;
  border: 1px solid #434347;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  z-index: 100;
  transition: color 0.15s, border-color 0.15s;
}

.log-trigger:hover {
  color: #cccccc;
  border-color: #666666;
}

.log-content {
  max-height: 50vh;
  overflow-y: auto;
  font-size: 12px;
}

.log-entry {
  margin-bottom: 2px;
  line-height: 1.4;
  color: #666666;
}

.log-time {
  color: #555555;
}

.log-info {
  color: #888888;
}

.log-debug {
  color: #558866;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: monospace;
  font-size: 11px;
}

.log-warn {
  color: #ccaa44;
}

.log-error {
  color: #cc4444;
}
</style>
