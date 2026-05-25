<script lang="ts" setup>
import type {ContentEntity} from '@/content/types'

defineProps<{ entity: ContentEntity }>()
</script>

<template>
  <div class="attr-panel">
    <div class="attr-name">{{ entity.frontmatter.name ?? entity.id }}</div>
    <div class="attr-role">{{ entity.frontmatter.role ?? '' }}</div>

    <div class="spacer"/>

    <div class="attr-label">描述</div>
    <div class="attr-text">{{ entity.body }}</div>

    <div class="spacer"/>

    <div class="attr-label">好感度</div>
    <div class="hearts">
      <span
          v-for="i in 5"
          :key="i"
          :class="i <= (entity.frontmatter.affection ?? 0) ? 'heart-filled' : 'heart-empty'"
          class="heart"
      >{{ i <= (entity.frontmatter.affection ?? 0) ? '❤' : '♡' }}</span>
    </div>

    <div class="spacer"/>

    <div class="attr-label">心情</div>
    <div class="attr-text">{{ entity.frontmatter.mood ?? '未知' }}</div>
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
