<script lang="ts" setup>
defineProps<{
  characterName: string
  turnCount: number
  promptTokens: number
  completionTokens: number
  cacheHitRate: number
}>()

const emit = defineEmits<{
  end: []
}>()
</script>

<template>
  <div class="dialogue-header">
    <span class="dialogue-target">正在与 {{ characterName }} 对话</span>
    <n-button size="small" type="warning" ghost @click="emit('end')">
      结束对话
    </n-button>
  </div>
  <div v-if="turnCount > 0" class="stats-bar">
    <span>缓存命中: {{ (cacheHitRate * 100).toFixed(1) }}%</span>
    <span>提示: {{ promptTokens.toLocaleString() }}</span>
    <span>补全: {{ completionTokens.toLocaleString() }}</span>
    <span>回合: {{ turnCount }}</span>
  </div>
</template>

<style scoped>
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
</style>
