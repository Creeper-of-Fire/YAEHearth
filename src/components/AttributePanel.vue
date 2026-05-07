<script setup lang="ts">
import type { Character } from '@/types/game'

defineProps<{ character: Character }>()
</script>

<template>
  <div class="attr-panel">
    <div class="attr-name">{{ character.name }}</div>
    <div class="attr-role">{{ character.role }}</div>

    <div class="spacer" />

    <div class="attr-label">描述</div>
    <div class="attr-text">{{ character.description }}</div>

    <div class="spacer" />

    <div class="attr-label">性格</div>
    <div class="attr-text">{{ character.personality }}</div>

    <div class="spacer" />

    <div class="attr-label">好感度</div>
    <div class="hearts">
      <span
        v-for="i in 5"
        :key="i"
        class="heart"
        :class="i <= character.affection ? 'heart-filled' : 'heart-empty'"
      >{{ i <= character.affection ? '❤' : '♡' }}</span>
    </div>

    <div class="spacer" />

    <div class="attr-label">心情</div>
    <div class="attr-text">{{ character.mood }}</div>
  </div>
</template>

<style scoped>
.attr-panel {
  padding: 0;
  color: #dddddd;
  font-size: 14px;
}

.attr-name {
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 4px;
}

.attr-role {
  color: #999999;
  font-size: 14px;
}

.spacer {
  height: 16px;
}

.attr-label {
  color: #777777;
  font-size: 12px;
  margin-bottom: 4px;
}

.attr-text {
  color: #cccccc;
  line-height: 1.6;
}

.hearts {
  font-size: 18px;
  letter-spacing: 2px;
}

.heart-filled {
  color: #cc4444;
}

.heart-empty {
  color: #444444;
}
</style>
