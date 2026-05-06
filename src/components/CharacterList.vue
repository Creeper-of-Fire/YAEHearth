<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useLogStore } from '@/stores/log'

const store = useGameStore()
const log = useLogStore()

const menuOptions = computed(() =>
  store.characters.map(c => ({
    label: `${c.name}（${c.role}）`,
    key: c.id,
  })),
)

const recentLogs = computed(() => log.entries.value.slice(-20))

function onSelect(key: string) {
  store.selectCharacter(key)
}
</script>

<template>
  <div class="character-list">
    <n-menu
      :options="menuOptions"
      :value="store.scene.selectedId"
      @update:value="onSelect"
    />
    <div class="event-log">
      <div class="event-log-title">事件日志</div>
      <div class="event-log-content">
        <div v-for="(entry, i) in recentLogs" :key="i" class="log-entry" :class="`log-${entry.level}`">
          <span class="log-time">{{ entry.time }}</span> {{ entry.message }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.character-list {
  width: 280px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.event-log {
  border-top: 1px solid #434347;
  background: #141416;
  padding: 8px;
  height: 150px;
  overflow-y: auto;
  flex-shrink: 0;
}

.event-log-title {
  color: #777777;
  font-size: 12px;
  margin-bottom: 4px;
}

.event-log-content {
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

.log-warn {
  color: #ccaa44;
}

.log-error {
  color: #cc4444;
}
</style>
