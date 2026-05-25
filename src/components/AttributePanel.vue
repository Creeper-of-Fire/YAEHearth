<script lang="ts" setup>
import {computed} from 'vue'
import type {ContentEntity} from '@/content/types'
import MarkdownView from '@/components/MarkdownView.vue'

const props = defineProps<{ entity: ContentEntity }>()

/** 排除 id/name 后的展示字段 */
const displayFields = computed(() =>
    Object.entries(props.entity.frontmatter).filter(([k]) => k !== 'id' && k !== 'name'),
)
</script>

<template>
  <div class="attr-panel">
    <div class="attr-name">{{ entity.frontmatter.name ?? entity.id }}</div>

    <div
        v-for="[key, val] in displayFields"
        :key="key"
        class="attr-row"
    >
      <span class="attr-label">{{ key }}</span>
      <span class="attr-value">{{ val }}</span>
    </div>

    <div class="spacer"/>
    <div class="attr-section-label">描述</div>
    <MarkdownView :source="entity.body" class="attr-body"/>
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
  margin-bottom: 12px;
}

.attr-row {
  margin-bottom: 8px;
}

.attr-label {
  display: block;
  color: #777777;
  font-size: 12px;
  margin-bottom: 2px;
}

.attr-value {
  color: #cccccc;
}

.spacer {
  height: 16px;
}

.attr-section-label {
  color: #777777;
  font-size: 12px;
  margin-bottom: 4px;
}

.attr-body {
  color: #cccccc;
  line-height: 1.6;
  font-size: 13px;
  white-space: pre-wrap;
}

</style>
