<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'

const store = useGameStore()
const character = computed(() => store.selectedCharacter)
</script>

<template>
  <div class="character-detail">
    <template v-if="character">
      <div class="char-name">{{ character.name }}</div>
      <div class="char-role">{{ character.role }}</div>

      <div class="spacer" />

      <div class="char-desc">{{ character.description }}</div>

      <div class="spacer" />

      <div class="label">好感度</div>
      <div class="hearts">
        <span
          v-for="i in 5"
          :key="i"
          class="heart"
          :class="i <= character.affection ? 'heart-filled' : 'heart-empty'"
        >{{ i <= character.affection ? '❤' : '♡' }}</span>
      </div>

      <div class="spacer" />

      <div class="label">心情</div>
      <div class="mood">{{ character.mood }}</div>
    </template>
    <template v-else>
      <div class="no-selection">选择一个角色查看详情</div>
    </template>
  </div>
</template>

<style scoped>
.character-detail {
  padding: 0;
  color: #dddddd;
  font-size: 14px;
}

.char-name {
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 4px;
}

.char-role {
  color: #999999;
  font-size: 14px;
}

.char-desc {
  color: #dddddd;
  line-height: 1.6;
}

.spacer {
  height: 16px;
}

.label {
  color: #777777;
  font-size: 12px;
  margin-bottom: 4px;
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

.mood {
  color: #aaaaaa;
}

.no-selection {
  color: #666666;
  font-style: italic;
  padding-top: 32px;
}
</style>
